import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError } from '../domain/errors.js';
import {
  completedJobStage,
  JOB_REQUIRED_OUTPUTS,
  JOB_STAGE_ORDER,
  safeArtifactPath,
  type JobArtifact,
  type JobInfo,
  type JobStage,
} from './contracts.js';
import type { Files } from './files.js';
import { filesZip } from './zip.js';
export { safeArtifactPath } from './contracts.js';

export const JOB_MIGRATION = `CREATE TABLE workflow_jobs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, info TEXT NOT NULL CHECK(json_valid(info)), context TEXT NOT NULL CHECK(json_valid(context)));
CREATE TABLE workflow_artifacts (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES workflow_jobs(id), stage_id TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, source TEXT NOT NULL, content TEXT NOT NULL);
CREATE INDEX workflow_artifacts_job ON workflow_artifacts(job_id);
CREATE TABLE workflow_requests (request_id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES workflow_jobs(id), action TEXT NOT NULL);`;

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Stage bookkeeping stays in provenance/evidence, outside the runnable file set. */
const stageMetadata = (path: string) =>
  /^(?:STAGE\.json|WORKFLOW-CONTEXT\.json|WORKFLOW-EXECUTION\.json|prompt\.txt|oracle-result\.json|ps001-oracle\.py|REPAIR-NOTES\.md)$/i.test(
    path,
  );

/** Merge portable artifact paths without silently overwriting another role's bytes. */
export function mergeWorkflowFiles(...groups: Files[]): Files {
  const files: Files = {};
  const paths = new Map<string, string>();
  for (const group of groups)
    for (const [path, text] of Object.entries(group)) {
      if (
        !safeArtifactPath(path) ||
        typeof text !== 'string' ||
        path
          .split('/')
          .some(
            (part) =>
              part.endsWith('.') || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part),
          )
      )
        throw new DomainError(
          'INVALID_ARTIFACT',
          'A workflow file is missing or has an unsafe or nonportable path.',
        );
      // safeArtifactPath already limits names to ASCII. Case aliases and file/
      // directory prefix collisions cannot be extracted consistently on all hosts.
      const portable = path.toLowerCase();
      for (const [existing, original] of paths)
        if (
          (existing === portable && (original !== path || files[original] !== text)) ||
          existing.startsWith(`${portable}/`) ||
          portable.startsWith(`${existing}/`)
        )
          throw new DomainError(
            'INVALID_ARTIFACT',
            `Workflow files conflict at ${original} and ${path}. Preserve the stage evidence.`,
          );
      paths.set(portable, path);
      files[path] = text;
    }
  return files;
}

/** Actual outputs from one completed candidate stage, including its support files. */
export function workflowStageOutputFiles(db: DatabaseSync, jobId: string, stage: JobStage): Files {
  const groups = db
    .prepare(
      'SELECT path,content,source FROM workflow_artifacts WHERE job_id=? AND stage_id=? ORDER BY rowid',
    )
    .all(jobId, stage.id)
    .filter((artifact) => {
      const path = String(artifact.path);
      if (/^(?:PROVENANCE\.json$|BUNDLE-README\.md$|STAGE-EVIDENCE(?:\/|$))/i.test(path))
        throw new DomainError('INVALID_ARTIFACT', 'Workflow output uses a reserved bundle path.');
      return artifact.source !== 'verifier' && !stageMetadata(path);
    })
    .map((artifact) => ({ [String(artifact.path)]: String(artifact.content) }));
  return mergeWorkflowFiles(...groups);
}

export function assertStageInputFiles(stage: JobStage, files: Files): void {
  for (const [path, text] of Object.entries(files))
    if (stage.inputHashes[path] !== sha256(text))
      throw new DomainError(
        'EVIDENCE_CHANGED',
        `The completed ${stage.kind} stage did not receive the captured ${path}. Preserve this job and start a new reviewed candidate.`,
      );
}

/** Reconstruct the exact ZIP from captured bytes, never from disposable run directories. */
export function workflowBundleBytes(
  db: DatabaseSync,
  job: JobInfo,
  provenance = job.bundle?.provenance ?? JSON.stringify(job, null, 2),
  version: 1 | 2 = job.bundle?.version ?? 1,
): Buffer {
  if (version !== 1 && version !== 2)
    throw new DomainError('INVALID_DATABASE', 'The reviewed bundle version is unsupported.');
  const row = db.prepare('SELECT context FROM workflow_jobs WHERE id=?').get(job.id);
  const pinned = JSON.parse(String(row?.context)).content.files;
  if (version === 2) {
    try {
      const { ['expected.json']: reference, ...inputs } = pinned;
      let files = mergeWorkflowFiles(inputs, { 'EXPECTED-REFERENCE.json': reference });
      const evidence: Files[] = [];
      for (const kind of JOB_STAGE_ORDER) {
        const stage = completedJobStage(job, kind);
        if (!stage) throw new Error('The reviewed stage is missing.');
        if (kind === 'qa' || kind === 'handoff') assertStageInputFiles(stage, files);
        const outputs = workflowStageOutputFiles(db, job.id, stage);
        for (const path of JOB_REQUIRED_OUTPUTS[kind])
          if (typeof outputs[path] !== 'string') throw new Error('A reviewed output is missing.');
        files = mergeWorkflowFiles(files, outputs);
        if (kind === 'qa') {
          const oracle = db
            .prepare(
              "SELECT content FROM workflow_artifacts WHERE job_id=? AND stage_id=? AND path='oracle-result.json' AND source='verifier'",
            )
            .get(job.id, stage.id);
          if (!oracle) throw new Error('The reviewed oracle is missing.');
          files = mergeWorkflowFiles(files, { 'oracle-result.json': String(oracle.content) });
        }
        const stageEvidence = db
          .prepare(
            'SELECT path,content,source FROM workflow_artifacts WHERE job_id=? AND stage_id=? ORDER BY rowid',
          )
          .all(job.id, stage.id)
          .filter(
            (artifact) => artifact.source === 'verifier' || stageMetadata(String(artifact.path)),
          )
          .map((artifact) => ({
            [`STAGE-EVIDENCE/${kind}/${stage.id}/${String(artifact.path)}`]: String(
              artifact.content,
            ),
          }));
        evidence.push(...stageEvidence);
      }
      return filesZip(
        mergeWorkflowFiles(files, ...evidence, {
          'PROVENANCE.json': provenance,
          'BUNDLE-README.md':
            '# Reviewed workflow bundle, format 2\n\n' +
            'Product files and supporting files keep their original relative paths. ' +
            'EXPECTED-REFERENCE.json is the pinned expected-output input; expected.json is the producer output.\n\n' +
            'Captured stage receipts, readiness records and prompts are under STAGE-EVIDENCE/<stage-kind>/<stage-id>/. ' +
            'These are historical stage evidence, not product modules or a single shared runtime identity. ' +
            'Stage-local receipt paths in original agent documents refer to that stage directory; ' +
            'the original documents and their hashes are unchanged. PROVENANCE.json identifies each stage and artifact.\n',
        }),
      );
    } catch {
      throw new DomainError('INVALID_DATABASE', 'The complete reviewed bundle is inconsistent.');
    }
  }
  // Preserve v1 order and selection byte for byte, including unsealed historical
  // downloads. A new seal must never reinterpret an earlier owner's archive.
  const files: Record<string, string> = Object.fromEntries(
    ['input.json', 'brief.md', 'requirements.md'].map((path) => [path, pinned[path]]),
  );
  for (const kind of JOB_STAGE_ORDER) {
    const stage = completedJobStage(job, kind);
    if (!stage) throw new DomainError('INVALID_DATABASE', 'The reviewed stage is missing.');
    const captured = Object.fromEntries(
      db
        .prepare(
          'SELECT path,content FROM workflow_artifacts WHERE job_id=? AND stage_id=? ORDER BY rowid',
        )
        .all(job.id, stage.id)
        .map((artifact) => [String(artifact.path), String(artifact.content)]),
    );
    for (const path of JOB_REQUIRED_OUTPUTS[kind]) files[path] = captured[path];
    if (kind === 'qa') files['oracle-result.json'] = captured['oracle-result.json'];
  }
  files['PROVENANCE.json'] = provenance;
  if (Object.values(files).some((value) => typeof value !== 'string'))
    throw new DomainError('INVALID_DATABASE', 'A reviewed bundle file is missing.');
  return filesZip(files);
}
/** Integrity includes ownership, exact content, captured context and both directions of references. */
export function validateJobData(db: DatabaseSync): void {
  const fail = (): never => {
    throw new DomainError(
      'INVALID_DATABASE',
      'Workflow evidence is inconsistent. Preserve this database and restore a verified backup.',
    );
  };
  const jobs = new Map<string, JobInfo>();
  const stageOwners = new Map<string, string>();
  const references = new Map<string, { jobId: string; artifact: JobArtifact }>();
  try {
    for (const row of db.prepare('SELECT id, request_id, info, context FROM workflow_jobs').all()) {
      const info: JobInfo = JSON.parse(String(row.info));
      const ctx = JSON.parse(String(row.context));
      if (
        info.id !== row.id ||
        info.requestId !== row.request_id ||
        !Array.isArray(info.stages) ||
        sha256(String(row.context)) !== info.contextSha256 ||
        ctx.content?.sha256 !== info.contentSha256 ||
        ctx.acceptanceOwner !== info.acceptanceOwner ||
        ![
          'queued',
          'running',
          'waiting_owner',
          'accepted',
          'rejected',
          'blocked',
          'failed',
          'cancelled',
        ].includes(info.status) ||
        !Number.isInteger(info.candidate) ||
        info.candidate < 0 ||
        info.candidate > 2 ||
        info.maxRepairCandidates !== 2 ||
        !Number.isInteger(info.retryCount) ||
        info.retryCount < 0 ||
        info.retryCount > 2 ||
        Object.keys(ctx.agents ?? {}).length !== 5 ||
        new Set(Object.values(ctx.agents).map((a: any) => a.id)).size !== 5 ||
        ((info.status === 'accepted' || info.status === 'rejected') &&
          info.ownerReview?.decision !== info.status)
      )
        return fail();
      if (['waiting_owner', 'accepted', 'rejected'].includes(info.status)) {
        const chain = JOB_STAGE_ORDER.map((kind) => completedJobStage(info, kind));
        if (
          chain.some((s) => !s?.sessionId || !s.runtimeVersion) ||
          new Set(chain.map((s) => s!.sessionId)).size !== 5
        )
          return fail();
        const qa = chain[3]!;
        const artifactText = (path: string) => {
          const a = qa.artifacts.find((a) => a.path === path);
          if (!a) return fail();
          const row = db
            .prepare(
              'SELECT content FROM workflow_artifacts WHERE id=? AND job_id=? AND stage_id=?',
            )
            .get(a.id, info.id, qa.id);
          if (!row) return fail();
          return JSON.parse(String(row.content));
        };
        const report = artifactText('QA.json'),
          oracle = artifactText('oracle-result.json');
        if (
          report.status !== 'pass' ||
          [1, 2, 3, 4, 5].some((n) => report.criteria?.[`PS-A${n}`] !== 'PASS') ||
          oracle.status !== 'completed' ||
          oracle.exitCode !== 0
        )
          return fail();
      }
      jobs.set(info.id, info);
      for (const stage of info.stages) {
        if (
          stageOwners.has(stage.id) ||
          !Array.isArray(stage.artifacts) ||
          ctx.agents[stage.kind]?.id !== stage.agentId ||
          ctx.agents[stage.kind]?.role !== stage.role
        )
          return fail();
        stageOwners.set(stage.id, info.id);
        const receipts = stage.artifacts.filter((a) => a.path === 'WORKFLOW-EXECUTION.json');
        // Older interrupted stages may predate synchronous receipt capture. They
        // can recover as failed, but completed evidence always needs its receipt.
        if (receipts.length > 1 || (stage.status === 'completed' && receipts.length !== 1))
          return fail();
        if (receipts.length) {
          const artifact = receipts[0]!;
          const row = db
            .prepare(
              'SELECT content FROM workflow_artifacts WHERE id=? AND job_id=? AND stage_id=?',
            )
            .get(artifact.id, info.id, stage.id);
          if (!row || artifact.source !== 'verifier') return fail();
          const receipt = JSON.parse(String(row.content));
          if (
            !receipt ||
            Object.keys(receipt).sort().join(',') !==
              'format,observedAt,runtimeVersion,sessionId' ||
            receipt.format !== 'gitflash-observed-runtime-session' ||
            typeof receipt.sessionId !== 'string' ||
            !receipt.sessionId.trim() ||
            receipt.sessionId !== stage.sessionId ||
            typeof receipt.runtimeVersion !== 'string' ||
            !receipt.runtimeVersion.trim() ||
            receipt.runtimeVersion !== stage.runtimeVersion ||
            typeof receipt.observedAt !== 'string' ||
            !Number.isFinite(Date.parse(receipt.observedAt)) ||
            new Date(receipt.observedAt).toISOString() !== receipt.observedAt
          )
            return fail();
        }
        for (const artifact of stage.artifacts) {
          if (references.has(artifact.id) || artifact.stageId !== stage.id) return fail();
          references.set(artifact.id, { jobId: info.id, artifact });
        }
      }
    }
    for (const row of db.prepare('SELECT * FROM workflow_artifacts').all()) {
      const reference = references.get(String(row.id));
      const artifact = reference?.artifact;
      if (
        !reference ||
        reference.jobId !== row.job_id ||
        stageOwners.get(String(row.stage_id)) !== row.job_id ||
        !artifact ||
        artifact.path !== row.path ||
        artifact.stageId !== row.stage_id ||
        artifact.sha256 !== row.sha256 ||
        artifact.bytes !== row.bytes ||
        artifact.source !== row.source ||
        !safeArtifactPath(String(row.path)) ||
        !['runtime', 'input', 'verifier'].includes(String(row.source)) ||
        sha256(String(row.content)) !== row.sha256 ||
        Buffer.byteLength(String(row.content)) !== row.bytes ||
        Number(row.bytes) > 2_000_000
      )
        return fail();
      references.delete(String(row.id));
    }
    if (references.size) return fail();
    for (const job of jobs.values()) {
      if (job.bundle !== undefined) {
        const bundle = job.bundle;
        if (
          !bundle ||
          ![1, 2].includes(bundle.version) ||
          typeof bundle.provenance !== 'string' ||
          !/^[a-f0-9]{64}$/.test(bundle.sha256) ||
          !Number.isSafeInteger(bundle.bytes) ||
          bundle.bytes <= 0 ||
          !['waiting_owner', 'accepted', 'rejected'].includes(job.status)
        )
          return fail();
        const captured = JSON.parse(bundle.provenance);
        if (
          captured.status !== 'waiting_owner' ||
          captured.ownerReview !== null ||
          captured.bundle !== undefined
        )
          return fail();
        for (const key of [
          'id',
          'requestId',
          'workflowId',
          'title',
          'companyId',
          'companyName',
          'acceptanceOwner',
          'contentVersion',
          'contentSha256',
          'contextSha256',
          'createdAt',
          'candidate',
          'maxRepairCandidates',
          'retryCount',
          'stages',
        ] as const)
          if (JSON.stringify(captured[key]) !== JSON.stringify(job[key])) return fail();
        const bytes = workflowBundleBytes(db, job);
        if (bytes.length !== bundle.bytes || sha256(bytes) !== bundle.sha256) return fail();
        if (job.ownerReview && job.ownerReview.bundleSha256 !== bundle.sha256) return fail();
      } else if (job.ownerReview?.bundleSha256 !== undefined) return fail();
    }
    for (const row of db.prepare('SELECT job_id,action FROM workflow_requests').all())
      if (!jobs.has(String(row.job_id)) || row.action !== 'retry') return fail();
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return fail();
  }
}
