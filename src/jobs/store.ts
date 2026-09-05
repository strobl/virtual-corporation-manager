import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError } from '../domain/errors.js';
import type { JobArtifact, JobInfo } from './contracts.js';

export const JOB_MIGRATION = `CREATE TABLE workflow_jobs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, info TEXT NOT NULL CHECK(json_valid(info)), context TEXT NOT NULL CHECK(json_valid(context)));
CREATE TABLE workflow_artifacts (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES workflow_jobs(id), stage_id TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, source TEXT NOT NULL, content TEXT NOT NULL);
CREATE INDEX workflow_artifacts_job ON workflow_artifacts(job_id);
CREATE TABLE workflow_requests (request_id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES workflow_jobs(id), action TEXT NOT NULL);`;

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function safeArtifactPath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 240 &&
    path.split('/').every((p) => /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(p)) &&
    /\.(py|json|md|txt|csv)$/.test(path)
  );
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
        const chain = ['intake', 'requirements', 'build', 'qa', 'handoff'].map((kind) =>
          info.stages.findLast(
            (s) =>
              s.kind === kind &&
              s.status === 'completed' &&
              (kind === 'intake' || kind === 'requirements' || s.attempt === info.candidate),
          ),
        );
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
    for (const row of db.prepare('SELECT job_id,action FROM workflow_requests').all())
      if (!jobs.has(String(row.job_id)) || row.action !== 'retry') return fail();
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return fail();
  }
}
