import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceStore, restoreWorkspaceBackup } from '../src/db/store.js';
import { createJobService, type JobServiceOptions } from '../src/jobs/service.js';
import type { StudioContent } from '../src/jobs/content.js';
import type { JobInfo, StageId } from '../src/jobs/contracts.js';
import { captureFiles, type Files } from '../src/jobs/files.js';
import { sha256 } from '../src/jobs/store.js';
import type {
  WorkflowCodexInput,
  WorkflowCodexResult,
  WorkflowExecutionIdentity,
} from '../src/adapters/workflow-codex.js';

// Synthetic content deliberately contains no finished implementation. These tests
// exercise orchestration and durable evidence; they do not claim provider or
// Python-oracle acceptance of the shipped Product Studio example.
const kinds: StageId[] = ['intake', 'requirements', 'build', 'qa', 'handoff'];
const content: StudioContent = {
  version: 'test-1',
  sha256: sha256('synthetic test content'),
  rolePrompts: {},
  stages: Object.fromEntries(
    kinds.map((kind) => [
      kind,
      {
        title: kind,
        role: `test.role.${kind}`,
        prompt: `Perform the ${kind} stage for a synthetic integration test.`,
      },
    ]),
  ) as StudioContent['stages'],
  files: {
    'brief.md': 'Synthetic inventory utility. Owner review is required.',
    'requirements.md': 'Strict integer inputs; booleans are invalid.',
    'input.json': '[{"sku":"a","stock":0,"reorder_point":1}]',
    'expected.json': '[{"sku":"a","quantity":1}]',
  },
  oracle: '# immutable independent test oracle fixture\n',
  operatingContract:
    'Initial candidate plus at most two repair candidates. No automatic owner acceptance.',
  help: 'Create five roles, start PS-001, inspect files and explicitly review.',
};

const TEST_OWNER = 'Synthetic test owner';
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function directory(prefix = 'gitflash-jobs-test-') {
  const path = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

interface Call {
  kind: StageId;
  input: WorkflowCodexInput;
  files: Files;
}
interface FixtureOptions {
  execute?: (
    call: Call,
    result: WorkflowCodexResult,
    index: number,
  ) => Promise<WorkflowCodexResult | void>;
  report?: (call: Call) => { status: string; criteria: Record<string, string>; summary: string };
  check?: JobServiceOptions['check'];
  preflight?: JobServiceOptions['check'];
  writeOutputs?: boolean;
  writeReceipt?: boolean;
  afterReceipt?: (call: Call, result: WorkflowCodexResult) => Promise<void>;
}
async function executionReceipt(input: WorkflowCodexInput, result: WorkflowCodexResult) {
  const identity: WorkflowExecutionIdentity = {
    format: 'gitflash-observed-runtime-session',
    sessionId: result.sessionId!,
    runtimeVersion: result.runtimeVersion!,
    observedAt: result.startedAt,
  };
  await writeFile(
    join(input.directory, 'WORKFLOW-EXECUTION.json'),
    JSON.stringify(identity, null, 2) + '\n',
    { flag: 'wx' },
  );
  input.onSession?.(identity);
}
function success(): WorkflowCodexResult {
  const timestamp = new Date().toISOString();
  return {
    status: 'completed',
    output: 'Created the requested files.',
    sessionId: randomUUID(),
    runtimeVersion: 'codex-cli 0.138.0',
    startedAt: timestamp,
    finishedAt: timestamp,
    exitCode: 0,
    commands: [
      {
        id: randomUUID(),
        command: `'${process.execPath}' -B -m unittest -v`,
        status: 'completed',
        exitCode: 0,
        output: 'Observed local test output.',
        observedAt: timestamp,
      },
    ],
  };
}
const report = (status = 'pass', criterion = 'PASS') => ({
  status,
  criteria: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`PS-A${n}`, criterion])),
  summary: 'Synthetic criterion evidence.',
});
const buildFiles: Files = {
  'stock_alert.py':
    '# Actual runtime-created file in the test stage directory.\ndef reorder_items(products):\n    return []\n',
  'test_stock_alert.py':
    '# Synthetic test file; service tests do not claim this proves PS-A1–A5.\n',
  'expected.json': '[{"sku":"a","quantity":1}]',
  'USAGE.md': 'Run python3 -B -m unittest -v. Owner acceptance is pending.\n',
};

function fixture(options: FixtureOptions = {}) {
  const dir = directory();
  const store = createWorkspaceStore(dir);
  let storeClosed = false;
  cleanups.push(() => {
    if (!storeClosed) store.close();
  });
  const company = store.apply(
    store.preview(
      [
        {
          type: 'company.create',
          input: {
            name: 'Synthetic Product Studio',
            shortCode: 'TEST',
            description: 'Test fixture',
            color: '#123456',
          },
        },
      ],
      store.snapshot().revision,
    ).id,
  ).state.companies[0]!;
  for (const kind of kinds) {
    store.apply(
      store.preview(
        [
          {
            type: 'agent.create',
            companyId: company.id,
            input: {
              name: `Synthetic ${kind}`,
              role: content.stages[kind].role,
              kind: 'agent',
              instructions: `Perform ${kind}.`,
              responsibilities: [kind],
              departmentId: null,
              managerId: null,
            },
          },
        ],
        store.snapshot().revision,
      ).id,
    );
  }
  const calls: Call[] = [];
  const checks: Files[] = [];
  const execute: NonNullable<JobServiceOptions['execute']> = async (input) => {
    const kind = /, stage (intake|requirements|build|qa|handoff)\./.exec(
      input.prompt,
    )?.[1] as StageId;
    if (!kind) throw new Error('Missing workflow stage in runtime prompt.');
    const call: Call = { kind, input, files: await captureFiles(input.directory) };
    calls.push(call);
    if (options.writeOutputs !== false) {
      const files =
        kind === 'intake'
          ? { 'INTAKE.md': 'Accepted synthetic scope, pending owner review.' }
          : kind === 'requirements'
            ? { 'SCOPE.md': 'Reject bool inputs. Do not mutate inputs.' }
            : kind === 'build'
              ? buildFiles
              : kind === 'qa'
                ? {
                    'QA.json': JSON.stringify(options.report?.(call) ?? report()),
                    'QA.md': 'Independent synthetic QA review with captured checks.',
                  }
                : {
                    'HANDOFF.md':
                      'Four deliverables and QA evidence are ready for explicit owner review.',
                  };
      for (const [path, text] of Object.entries(files))
        await writeFile(join(input.directory, path), text);
      if (kind !== 'qa')
        await writeFile(
          join(input.directory, 'STAGE.json'),
          JSON.stringify({
            status: 'ready',
            summary: 'Synthetic stage is ready for its next checkpoint.',
          }),
        );
    }
    const initial = success();
    const result = (await options.execute?.(call, initial, calls.length - 1)) ?? initial;
    if (options.writeReceipt !== false) await executionReceipt(input, result);
    await options.afterReceipt?.(call, result);
    return result;
  };
  const check: NonNullable<JobServiceOptions['check']> = async (...args) => {
    if (args[0].args.at(-1) === 'ps001-oracle.py') {
      checks.push(await captureFiles(args[0].directory));
      if (options.check) return options.check(...args);
    } else if (options.preflight) return options.preflight(...args);
    return {
      status: 'completed',
      exitCode: 0,
      output: 'Synthetic independent checker receipt.',
      runtimeVersion: 'codex-cli 0.138.0',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  };
  const service = createJobService(store, dir, {
    content,
    execute,
    check,
    python: process.execPath,
  });
  let serviceClosed = false;
  cleanups.push(async () => {
    if (!serviceClosed) await service.close();
  });
  const start = (requestId: string = randomUUID()) =>
    service.start({
      companyId: company.id,
      workflowId: 'PS-001',
      acceptanceOwner: TEST_OWNER,
      requestId,
    });
  return {
    dir,
    store,
    service,
    calls,
    checks,
    company,
    start,
    close: async () => {
      await service.close();
      serviceClosed = true;
      store.close();
      storeClosed = true;
    },
  };
}

async function settled(service: ReturnType<typeof createJobService>, id: string): Promise<JobInfo> {
  await vi.waitFor(() => expect(['queued', 'running']).not.toContain(service.get(id).status), {
    timeout: 5000,
    interval: 5,
  });
  return service.get(id);
}

describe('Product Studio job orchestration', () => {
  it('captures the trimmed named review owner while production and QA proceed with acceptance pending', async () => {
    const f = fixture();
    const request = {
      companyId: f.company.id,
      workflowId: 'PS-001',
      requestId: 'named-owner-request',
      acceptanceOwner: `  ${TEST_OWNER}  `,
    };
    const started = f.service.start(request);
    expect(started.acceptanceOwner).toBe(TEST_OWNER);
    expect(started.ownerReview).toBeNull();
    const job = await settled(f.service, started.id);
    expect(job.status).toBe('waiting_owner');
    expect(job.acceptanceOwner).toBe(TEST_OWNER);
    expect(job.ownerReview).toBeNull();
    for (const call of f.calls) {
      const context = JSON.parse(call.files['WORKFLOW-CONTEXT.json']);
      expect(context.owner.name).toBe(TEST_OWNER);
      expect(context.owner.acceptance).toMatch(/pending/i);
      expect(call.input.prompt).toMatch(/Owner acceptance remains pending/i);
    }
    expect(f.service.start({ ...request, acceptanceOwner: TEST_OWNER }).id).toBe(job.id);
    expect(() =>
      f.service.start({ ...request, acceptanceOwner: 'Different synthetic owner' }),
    ).toThrow();
    expect(f.calls).toHaveLength(5);
  });

  it.each([undefined, null, 17, '', '   ', 'x', 'x'.repeat(121)])(
    'rejects invalid acceptance owner %j before storing or dispatching work',
    async (acceptanceOwner) => {
      const f = fixture();
      expect(() =>
        f.service.start({
          companyId: f.company.id,
          workflowId: 'PS-001',
          requestId: randomUUID(),
          acceptanceOwner,
        } as Parameters<typeof f.service.start>[0]),
      ).toThrow();
      expect(f.service.list()).toHaveLength(0);
      expect(f.calls).toHaveLength(0);
      expect(f.checks).toHaveLength(0);
    },
  );

  it.each(['SS', 'Synthetic '.padEnd(120, 's')])(
    'accepts trimmed owner names at the supported length boundary',
    async (name) => {
      const f = fixture();
      const started = f.service.start({
        companyId: f.company.id,
        workflowId: 'PS-001',
        requestId: randomUUID(),
        acceptanceOwner: `  ${name}  `,
      });
      const job = await settled(f.service, started.id);
      expect(job.status).toBe('waiting_owner');
      expect(job.acceptanceOwner).toBe(name);
    },
  );

  it('produces real files through five distinct sessions and preserves exact reviewed bytes for owner review', async () => {
    const f = fixture();
    const started = f.start('five-stages-request');
    expect(() =>
      f.service.review(started.id, { decision: 'accepted', note: 'Premature approval' }),
    ).toThrow();
    const job = await settled(f.service, started.id);
    expect(job.status).toBe('waiting_owner');
    expect(job.ownerReview).toBeNull();
    expect(f.calls.map((call) => call.kind)).toEqual(kinds);
    expect(new Set(job.stages.map((stage) => stage.agentId)).size).toBe(5);
    expect(new Set(job.stages.map((stage) => stage.sessionId)).size).toBe(5);
    expect(new Set(f.calls.map((call) => call.input.directory)).size).toBe(5);
    expect(f.calls[2]!.files).not.toHaveProperty('stock_alert.py');
    expect(f.calls[2]!.files).not.toHaveProperty('ps001-oracle.py');
    expect(f.checks).toHaveLength(1);
    expect(f.checks[0]!['ps001-oracle.py']).toBe(content.oracle);
    for (const [path, text] of Object.entries(buildFiles)) {
      expect(f.calls[3]!.files[path]).toBe(text);
      expect(f.calls[4]!.files[path]).toBe(text);
      expect(job.stages[3]!.inputHashes[path]).toBe(sha256(text));
      const artifact = job.stages[2]!.artifacts.find((a) => a.path === path)!;
      expect(artifact.source).toBe('runtime');
      expect(f.service.artifact(job.id, artifact.id)).toEqual({
        path,
        content: text,
        sha256: sha256(text),
      });
    }
    const oracleArtifact = job.stages[3]!.artifacts.find((a) => a.path === 'oracle-result.json')!;
    expect(oracleArtifact.source).toBe('verifier');
    expect(JSON.parse(f.service.artifact(job.id, oracleArtifact.id).content)).toMatchObject({
      status: 'completed',
      exitCode: 0,
      oracleSha256: sha256(content.oracle),
    });
    const accepted = f.service.review(job.id, {
      decision: 'accepted',
      note: 'Inspected downloaded files.',
    });
    expect(accepted.status).toBe('accepted');
    expect(
      f.service.review(job.id, { decision: 'accepted', note: 'Inspected downloaded files.' }),
    ).toEqual(accepted);
    expect(() =>
      f.service.review(job.id, { decision: 'rejected', note: 'Changed decision.' }),
    ).toThrow();
    expect(
      f.service.start({
        companyId: f.company.id,
        workflowId: 'PS-001',
        acceptanceOwner: TEST_OWNER,
        requestId: 'five-stages-request',
      }).id,
    ).toBe(job.id);
    expect(f.calls).toHaveLength(5);
    expect(f.store.time.snapshot().entries).toHaveLength(0);
  });

  it('rejects a final-answer code block as a substitute for actual artifact files', async () => {
    const f = fixture({
      writeOutputs: false,
      execute: async (_call, result) => ({
        ...result,
        output: '```python\n# INTAKE.md exists, trust me.\n```',
      }),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/INTAKE\.md|STAGE\.json/);
    expect(job.stages[0]!.artifacts.every((a) => a.source !== 'runtime')).toBe(true);
    expect(f.calls).toHaveLength(1);
  });

  it('rejects completed prose and files when the observed runtime-session receipt is missing', async () => {
    const f = fixture({ writeReceipt: false });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('runtime session receipt');
    expect(job.ownerReview).toBeNull();
    expect(f.calls).toHaveLength(1);
  });

  it('requires distinct observed runtime sessions even when the seat names differ', async () => {
    const f = fixture({
      execute: async (_call, result) => ({ ...result, sessionId: 'same-provider-session' }),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('distinct observed runtime session');
    expect(f.calls.map((call) => call.kind)).toEqual(['intake', 'requirements']);
    expect(job.ownerReview).toBeNull();
  });

  it.each(['observedAt', 'extra-field', 'formatting', 'removed', 'result-session'])(
    'persists the original session receipt before execution returns and blocks %s changes',
    async (tamper) => {
      let original = '';
      const f = fixture({
        afterReceipt: async (call, result) => {
          const path = join(call.input.directory, 'WORKFLOW-EXECUTION.json');
          original = await readFile(path, 'utf8');
          const current = f.service.list()[0]!;
          expect(current.status).toBe('running');
          const stage = current.stages[0]!;
          expect(stage.sessionId).toBe(result.sessionId);
          expect(stage.runtimeVersion).toBe(result.runtimeVersion);
          const receipt = stage.artifacts.find((a) => a.path === 'WORKFLOW-EXECUTION.json')!;
          expect(receipt.source).toBe('verifier');
          expect(f.service.artifact(current.id, receipt.id).content).toBe(original);
          expect(receipt.sha256).toBe(sha256(original));
          const value = JSON.parse(original);
          if (tamper === 'observedAt') value.observedAt = '2000-01-01T00:00:00.000Z';
          if (tamper === 'extra-field') value.claim = 'Forged model claim';
          if (tamper === 'removed') await rm(path);
          else if (tamper === 'result-session') result.sessionId = randomUUID();
          else
            await writeFile(
              path,
              tamper === 'formatting'
                ? JSON.stringify(value)
                : JSON.stringify(value, null, 2) + '\n',
            );
        },
      });
      const job = await settled(f.service, f.start().id);
      expect(job.status).toBe('blocked');
      expect(job.error).toContain('receipt was changed');
      expect(job.ownerReview).toBeNull();
      expect(job.retryable).toBe(false);
      expect(f.calls).toHaveLength(1);
      const receipts = job.stages[0]!.artifacts.filter((a) => a.path === 'WORKFLOW-EXECUTION.json');
      expect(receipts).toHaveLength(1);
      expect(f.service.artifact(job.id, receipts[0]!.id).content).toBe(original);
      expect(job.stages[0]!.sessionId).toBe(JSON.parse(original).sessionId);
      // The blocked job retains authentic evidence and remains openable.
      await f.close();
      const reopened = createWorkspaceStore(f.dir);
      reopened.close();
    },
  );

  it('does not authenticate a model-created post-run receipt without the observed session callback', async () => {
    const f = fixture({
      writeReceipt: false,
      afterReceipt: async (call, result) => {
        await executionReceipt({ ...call.input, onSession: undefined }, result);
      },
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('at session start');
    expect(job.stages[0]!.artifacts.some((a) => a.path === 'WORKFLOW-EXECUTION.json')).toBe(false);
    expect(f.calls).toHaveLength(1);
  });

  it('treats a QA pass contradicted by failed fixed-oracle evidence as a severe stop without repair', async () => {
    const f = fixture({
      check: async () => ({
        status: 'completed',
        exitCode: 1,
        output: 'FAIL: boolean stock accepted',
        runtimeVersion: 'codex-cli 0.138.0',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.candidate).toBe(0);
    expect(job.retryable).toBe(false);
    expect(f.calls.filter((c) => c.kind === 'build')).toHaveLength(1);
    expect(f.calls.filter((c) => c.kind === 'qa')).toHaveLength(1);
    expect(f.calls.some((c) => c.kind === 'handoff')).toBe(false);
    expect(f.checks).toHaveLength(1);
    expect(() =>
      f.service.review(job.id, { decision: 'accepted', note: 'Ignore failed tests.' }),
    ).toThrow();
    expect(() => f.service.retry(job.id, 'exhausted-repair')).toThrow();
  });

  it('caps ordinary independently confirmed defects at one initial and two repair candidates', async () => {
    const f = fixture({
      report: () => report('repair', 'FAIL'),
      check: async () => ({
        status: 'completed',
        exitCode: 1,
        output: 'FAIL: boolean stock accepted',
        runtimeVersion: 'codex-cli 0.138.0',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.candidate).toBe(2);
    expect(job.retryable).toBe(false);
    expect(f.calls.filter((call) => call.kind === 'build')).toHaveLength(3);
    expect(f.calls.filter((call) => call.kind === 'qa')).toHaveLength(3);
    expect(f.checks).toHaveLength(3);
    expect(f.calls.some((call) => call.kind === 'handoff')).toBe(false);
    expect(() => f.service.retry(job.id, 'exhausted-ordinary-repair')).toThrow();
  });

  it('retains an unchanged deliverable in the exact repaired candidate snapshot', async () => {
    let checks = 0;
    const f = fixture({
      report: (call) =>
        JSON.parse(call.files['oracle-result.json']).exitCode === 0
          ? report()
          : report('repair', 'FAIL'),
      check: async () => ({
        status: 'completed',
        exitCode: checks++ === 0 ? 1 : 0,
        output: checks === 1 ? 'FAIL: threshold' : 'PASS',
        runtimeVersion: 'codex-cli 0.138.0',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('waiting_owner');
    expect(job.candidate).toBe(1);
    const builds = job.stages.filter((stage) => stage.kind === 'build');
    for (const [path, text] of Object.entries(buildFiles)) {
      const artifact = builds[1]!.artifacts.find((a) => a.path === path)!;
      expect(f.service.artifact(job.id, artifact.id).content).toBe(text);
    }
  });

  it.each([
    ['severe_stop', 'FAIL'],
    ['blocked', 'BLOCKED'],
    ['repair', 'NOT RUN'],
  ])('stops %s / %s without spending ordinary repair authority', async (status, criterion) => {
    const f = fixture({ report: () => report(status, criterion) });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.candidate).toBe(0);
    expect(job.retryable).toBe(false);
    expect(f.calls.filter((c) => c.kind === 'build')).toHaveLength(1);
    expect(f.calls.some((c) => c.kind === 'handoff')).toBe(false);
  });

  it.each(['blocked', 'severe_stop'])(
    'honors intake %s before requiring downstream deliverables or using repair authority',
    async (status) => {
      const f = fixture({
        writeOutputs: false,
        execute: async (call) => {
          await writeFile(
            join(call.input.directory, 'STAGE.json'),
            JSON.stringify({ status, summary: 'Required owner authority is unavailable.' }),
          );
        },
      });
      const job = await settled(f.service, f.start().id);
      expect(job.status).toBe('blocked');
      expect(job.error).toContain('owner authority');
      expect(job.retryable).toBe(false);
      expect(job.candidate).toBe(0);
      expect(f.calls.map((call) => call.kind)).toEqual(['intake']);
      expect(f.checks).toHaveLength(0);
    },
  );

  it('honors a handoff block instead of marking the candidate ready for owner review', async () => {
    const f = fixture({
      execute: async (call) => {
        if (call.kind === 'handoff')
          await writeFile(
            join(call.input.directory, 'STAGE.json'),
            JSON.stringify({ status: 'blocked', summary: 'Required handoff evidence is missing.' }),
          );
      },
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.ownerReview).toBeNull();
    expect(job.retryable).toBe(false);
  });

  it('honors a severe QA control report even if the ordinary QA narrative is missing', async () => {
    const f = fixture({
      report: () => report('severe_stop', 'FAIL'),
      execute: async (call) => {
        if (call.kind === 'qa') await rm(join(call.input.directory, 'QA.md'));
      },
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.retryable).toBe(false);
    expect(job.candidate).toBe(0);
    expect(f.calls.some((call) => call.kind === 'handoff')).toBe(false);
  });

  it('does not report an unavailable verifier as ordinary test failure or start QA/repairs', async () => {
    const f = fixture({
      check: async () => ({
        status: 'failed',
        exitCode: null,
        output: '',
        error: { code: 'sandbox-unavailable', message: 'No sandbox; checker NOT RUN.' },
        runtimeVersion: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('NOT RUN');
    expect(job.candidate).toBe(0);
    expect(f.calls.map((call) => call.kind)).toEqual(['intake', 'requirements', 'build']);
    expect(job.ownerReview).toBeNull();
  });

  it('does not spend provider allowance when Python or the local sandbox fails preflight', async () => {
    const f = fixture({
      preflight: async () => ({
        status: 'failed',
        exitCode: null,
        output: '',
        error: {
          code: 'sandbox-unavailable',
          message: 'Prerequisite NOT RUN: supported sandbox is missing.',
        },
        runtimeVersion: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('NOT RUN');
    expect(job.stages).toHaveLength(0);
    expect(job.candidate).toBe(0);
    expect(f.calls).toHaveLength(0);
    expect(f.checks).toHaveLength(0);
  });

  it('requires an observed successful QA command in addition to model-written assertions', async () => {
    const f = fixture({
      execute: async (call, result) => (call.kind === 'qa' ? { ...result, commands: [] } : result),
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('observed local check');
    expect(f.calls.some((c) => c.kind === 'handoff')).toBe(false);
  });

  it('accepts a dedicated trusted test invocation inside one ordinary shell display wrapper', async () => {
    const f = fixture({
      execute: async (call, result) =>
        call.kind === 'qa'
          ? {
              ...result,
              commands: result.commands.map((receipt) => ({
                ...receipt,
                command: `/bin/zsh -lc "'${process.execPath}' -B -m unittest -v"`,
              })),
            }
          : result,
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('waiting_owner');
    expect(f.calls.some((call) => call.kind === 'handoff')).toBe(true);
  });

  it.each([
    'printf \'%s\' \'{"status":"pass"}\' > QA.json',
    `echo '${JSON.stringify(process.execPath)} -B -m unittest -v'`,
    `${JSON.stringify(process.execPath)} -B -m unittest -v || true`,
    `/bin/zsh -lc '${JSON.stringify(process.execPath)} -B -m unittest -v || true'`,
  ])(
    'does not mistake a write-only or masked command for an observed QA test: %s',
    async (command) => {
      const f = fixture({
        execute: async (call, result) =>
          call.kind === 'qa'
            ? { ...result, commands: result.commands.map((receipt) => ({ ...receipt, command })) }
            : result,
      });
      const job = await settled(f.service, f.start().id);
      expect(job.status).toBe('failed');
      expect(job.ownerReview).toBeNull();
      expect(f.calls.some((call) => call.kind === 'handoff')).toBe(false);
    },
  );

  it('requires explicit runtime retries, deduplicates retry requests, and allows at most two', async () => {
    const f = fixture({
      execute: async (call, result) =>
        call.kind === 'build'
          ? {
              ...result,
              status: 'failed',
              error: { code: 'runtime', message: 'Synthetic interrupted runtime.' },
            }
          : result,
    });
    let job = await settled(f.service, f.start('retry-source-request').id);
    expect(job.retryable).toBe(true);
    expect(f.calls.map((call) => call.kind)).toEqual(['intake', 'requirements', 'build']);
    f.service.retry(job.id, 'explicit-retry-one');
    f.service.retry(job.id, 'explicit-retry-one');
    job = await settled(f.service, job.id);
    expect(job.retryCount).toBe(1);
    expect(f.calls.filter((call) => call.kind === 'build')).toHaveLength(2);
    f.service.retry(job.id, 'explicit-retry-two');
    job = await settled(f.service, job.id);
    expect(job.status).toBe('failed');
    expect(job.retryCount).toBe(2);
    expect(job.retryable).toBe(false);
    expect(f.calls.filter((call) => call.kind === 'build')).toHaveLength(3);
    expect(f.calls.filter((call) => call.kind === 'intake')).toHaveLength(1);
    expect(() => f.service.retry(job.id, 'explicit-retry-three')).toThrow();
    expect(
      f.service.start({
        companyId: f.company.id,
        workflowId: 'PS-001',
        acceptanceOwner: TEST_OWNER,
        requestId: 'retry-source-request',
      }).id,
    ).toBe(job.id);
  });

  it('retries a failed handoff without replaying QA or inheriting another stage execution receipt', async () => {
    let handoffs = 0;
    const f = fixture({
      execute: async (call, result) => {
        if (call.kind === 'handoff' && handoffs++ === 0)
          return {
            ...result,
            status: 'failed',
            error: { code: 'runtime', message: 'Synthetic handoff interruption.' },
          };
        if (call.kind === 'handoff')
          expect(call.files).not.toHaveProperty('WORKFLOW-EXECUTION.json');
        return result;
      },
    });
    const initial = await settled(f.service, f.start().id);
    expect(initial.status).toBe('failed');
    f.service.retry(initial.id, 'retry-handoff-request');
    const retried = await settled(f.service, initial.id);
    expect(retried.status).toBe('waiting_owner');
    expect(f.calls.filter((call) => call.kind === 'handoff')).toHaveLength(2);
    expect(f.calls.filter((call) => call.kind === 'qa')).toHaveLength(1);
    expect(retried.retryCount).toBe(1);
  });

  it('stops when a producer changes a required immutable input', async () => {
    const f = fixture({
      execute: async (call) => {
        if (call.kind === 'build') await writeFile(join(call.input.directory, 'input.json'), '[]');
      },
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.error).toContain('input.json');
    expect(job.retryable).toBe(false);
    expect(f.checks).toHaveLength(0);
  });

  it('stops when QA mutates the producer artifact, despite a passing assertion', async () => {
    const f = fixture({
      execute: async (call) => {
        if (call.kind === 'qa')
          await writeFile(join(call.input.directory, 'stock_alert.py'), '# covert QA repair');
      },
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.error).toContain('stock_alert.py');
    expect(job.ownerReview).toBeNull();
    const artifact = job.stages
      .find((s) => s.kind === 'build')!
      .artifacts.find((a) => a.path === 'stock_alert.py')!;
    expect(f.service.artifact(job.id, artifact.id).content).toBe(buildFiles['stock_alert.py']);
  });

  it('stops when the independent checker mutates either candidate or oracle bytes', async () => {
    const f = fixture({
      check: async (input) => {
        await writeFile(join(input.directory, 'ps001-oracle.py'), '# changed independent oracle');
        return {
          status: 'completed',
          exitCode: 0,
          output: 'PASS',
          runtimeVersion: 'codex-cli 0.138.0',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        };
      },
    });
    const job = await settled(f.service, f.start().id);
    expect(job.status).toBe('blocked');
    expect(job.error).toContain('ps001-oracle.py');
    expect(f.calls.some((c) => c.kind === 'qa')).toBe(false);
  });

  it('cancels an in-flight job and never invokes later stages', async () => {
    let entered!: () => void;
    const atRuntime = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const f = fixture({
      execute: async (call, result) => {
        entered();
        await new Promise<void>((resolve) =>
          call.input.signal!.addEventListener('abort', () => resolve(), { once: true }),
        );
        return {
          ...result,
          status: 'cancelled',
          error: { code: 'cancelled', message: 'Cancelled by operator.' },
        };
      },
    });
    const started = f.start();
    await atRuntime;
    f.service.cancel(started.id);
    const job = await settled(f.service, started.id);
    expect(job.status).toBe('cancelled');
    expect(job.retryable).toBe(false);
    expect(job.stages[0]!.status).toBe('cancelled');
    expect(f.calls).toHaveLength(1);
  });

  it('keeps cancellation authoritative even if the final runtime returns a late completed receipt', async () => {
    let entered!: () => void;
    const atHandoff = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const f = fixture({
      execute: async (call, result) => {
        if (call.kind === 'handoff') {
          entered();
          await new Promise<void>((resolve) =>
            call.input.signal!.addEventListener('abort', () => resolve(), { once: true }),
          );
        }
        return result;
      },
    });
    const started = f.start();
    await atHandoff;
    f.service.cancel(started.id);
    const job = await settled(f.service, started.id);
    expect(job.status).toBe('cancelled');
    expect(job.ownerReview).toBeNull();
  });
});

describe('durable workflow recovery', () => {
  it('opens legacy saved jobs without inventing a review-owner name or replaying provider work', async () => {
    const f = fixture();
    const job = await settled(f.service, f.start().id);
    const artifacts = f.service.export(job.id).artifacts;
    await f.close();
    const db = new DatabaseSync(join(f.dir, 'workspace.sqlite'));
    const row = db.prepare('SELECT info,context FROM workflow_jobs WHERE id=?').get(job.id)!;
    const info = JSON.parse(String(row.info));
    const context = JSON.parse(String(row.context));
    delete info.acceptanceOwner;
    delete context.acceptanceOwner;
    const captured = JSON.stringify(context);
    info.contextSha256 = sha256(captured);
    db.prepare('UPDATE workflow_jobs SET info=?,context=? WHERE id=?').run(
      JSON.stringify(info),
      captured,
      job.id,
    );
    db.close();
    const store = createWorkspaceStore(f.dir);
    cleanups.push(() => store.close());
    const execute = vi.fn(async () => {
      throw new Error('Legacy read must not dispatch.');
    });
    const service = createJobService(store, f.dir, { content, execute });
    cleanups.push(() => service.close());
    expect(service.get(job.id).status).toBe('waiting_owner');
    expect(service.get(job.id).acceptanceOwner ?? null).toBeNull();
    expect(service.get(job.id).ownerReview).toBeNull();
    expect(service.export(job.id).artifacts).toEqual(artifacts);
    expect(service.download(job.id).length).toBeGreaterThan(0);
    expect(execute).not.toHaveBeenCalled();
  });

  it('restores all exact artifact bytes, owner decisions and request deduplication from SQLite alone', async () => {
    const f = fixture();
    const job = await settled(f.service, f.start('recoverable-job-request').id);
    f.service.review(job.id, {
      decision: 'rejected',
      note: 'Synthetic owner requested additional scope.',
    });
    const before = f.service.export(job.id);
    const backup = join(f.dir, 'workflow-backup.sqlite');
    await f.store.backup(backup);
    const restoredDirectory = directory('gitflash-job-restore-');
    await restoreWorkspaceBackup(restoredDirectory, backup);
    const store = createWorkspaceStore(restoredDirectory);
    cleanups.push(() => store.close());
    const execute = vi.fn(async () => {
      throw new Error('Restore must not invoke a provider.');
    });
    const service = createJobService(store, restoredDirectory, { content, execute });
    cleanups.push(() => service.close());
    expect(service.export(job.id)).toEqual(before);
    expect(
      service.start({
        companyId: f.company.id,
        workflowId: 'PS-001',
        acceptanceOwner: TEST_OWNER,
        requestId: 'recoverable-job-request',
      }).id,
    ).toBe(job.id);
    for (const artifact of before.artifacts) {
      expect(service.artifact(job.id, String(artifact.id)).content).toBe(artifact.content);
      expect(sha256(String(artifact.content))).toBe(artifact.sha256);
    }
    expect(execute).not.toHaveBeenCalled();
    expect(store.time.snapshot().entries).toHaveLength(0);
  });

  it.each([false, true])(
    'recovers process-loss work (legacy receipt absent: %s) without provider replay, then retries only incomplete stages explicitly',
    async (legacy) => {
      const f = fixture({
        execute: async (call, result) =>
          call.kind === 'qa'
            ? {
                ...result,
                status: 'failed',
                error: { code: 'runtime', message: 'Simulated process loss before completion.' },
              }
            : result,
      });
      const before = await settled(f.service, f.start('process-loss-request').id);
      await f.close();
      const db = new DatabaseSync(join(f.dir, 'workspace.sqlite'));
      before.status = 'running';
      before.stages.at(-1)!.status = 'running';
      if (legacy) {
        const interrupted = before.stages.at(-1)!;
        const receipt = interrupted.artifacts.find((a) => a.path === 'WORKFLOW-EXECUTION.json')!;
        db.prepare('DELETE FROM workflow_artifacts WHERE id=?').run(receipt.id);
        interrupted.artifacts = interrupted.artifacts.filter((a) => a.id !== receipt.id);
      }
      db.prepare('UPDATE workflow_jobs SET info=? WHERE id=?').run(
        JSON.stringify(before),
        before.id,
      );
      db.close();
      const store = createWorkspaceStore(f.dir);
      cleanups.push(() => store.close());
      const calls: string[] = [];
      const service = createJobService(store, f.dir, {
        content,
        python: process.execPath,
        check: async () => ({
          status: 'completed',
          exitCode: 0,
          output: 'Synthetic check PASS',
          runtimeVersion: 'test',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        }),
        execute: async (input) => {
          const kind = input.prompt.includes(', stage qa.') ? 'qa' : 'handoff';
          calls.push(kind);
          const files =
            kind === 'qa'
              ? { 'QA.json': JSON.stringify(report()), 'QA.md': 'Resumed independent review.' }
              : { 'HANDOFF.md': 'Resumed handoff; owner review pending.' };
          for (const [path, text] of Object.entries(files))
            await writeFile(join(input.directory, path), text);
          if (kind !== 'qa')
            await writeFile(
              join(input.directory, 'STAGE.json'),
              JSON.stringify({
                status: 'ready',
                summary: 'Resumed handoff is ready for explicit owner review.',
              }),
            );
          const result = success();
          await executionReceipt(input, result);
          return result;
        },
      });
      cleanups.push(() => service.close());
      expect(service.get(before.id).status).toBe('failed');
      expect(service.get(before.id).error).toContain('stopped during this job');
      expect(calls).toEqual([]);
      service.retry(before.id, 'explicit-after-restart');
      const after = await settled(service, before.id);
      expect(after.status).toBe('waiting_owner');
      expect(calls).toEqual(['qa', 'handoff']);
      expect(after.stages.filter((s) => s.kind === 'build')).toEqual(
        before.stages.filter((s) => s.kind === 'build'),
      );
    },
  );

  it.each([
    'bytes',
    'cross-job',
    'orphan',
    'context',
    'review-stage',
    'session',
    'unique-session',
    'runtime-version',
    'missing-receipt',
  ])('rejects %s evidence corruption before accepting a workspace backup', async (tamper) => {
    const f = fixture();
    const one = await settled(f.service, f.start().id);
    const two = await settled(f.service, f.start().id);
    const backup = join(f.dir, `tampered-${tamper}.sqlite`);
    await f.store.backup(backup);
    const db = new DatabaseSync(backup);
    const artifact = one.stages[2]!.artifacts.find((a) => a.path === 'stock_alert.py')!;
    if (tamper === 'bytes')
      db.prepare('UPDATE workflow_artifacts SET content=? WHERE id=?').run('changed', artifact.id);
    if (tamper === 'cross-job')
      db.prepare('UPDATE workflow_artifacts SET job_id=? WHERE id=?').run(two.id, artifact.id);
    if (tamper === 'orphan')
      db.prepare(
        'INSERT INTO workflow_artifacts SELECT ?,job_id,stage_id,path,sha256,bytes,source,content FROM workflow_artifacts WHERE id=?',
      ).run(randomUUID(), artifact.id);
    if (tamper === 'context')
      db.prepare('UPDATE workflow_jobs SET context=? WHERE id=?').run(
        '{"agents":null,"content":null}',
        one.id,
      );
    if (tamper === 'review-stage') {
      one.stages[3]!.status = 'failed';
      db.prepare('UPDATE workflow_jobs SET info=? WHERE id=?').run(JSON.stringify(one), one.id);
    }
    if (tamper === 'session') {
      one.stages[3]!.sessionId = one.stages[2]!.sessionId;
      db.prepare('UPDATE workflow_jobs SET info=? WHERE id=?').run(JSON.stringify(one), one.id);
    }
    if (tamper === 'unique-session' || tamper === 'runtime-version') {
      if (tamper === 'unique-session') one.stages[3]!.sessionId = randomUUID();
      else one.stages[3]!.runtimeVersion = 'codex-cli invented';
      db.prepare('UPDATE workflow_jobs SET info=? WHERE id=?').run(JSON.stringify(one), one.id);
    }
    if (tamper === 'missing-receipt') {
      const stage = one.stages[3]!;
      const receipt = stage.artifacts.find((a) => a.path === 'WORKFLOW-EXECUTION.json')!;
      db.prepare('DELETE FROM workflow_artifacts WHERE id=?').run(receipt.id);
      stage.artifacts = stage.artifacts.filter((a) => a.id !== receipt.id);
      db.prepare('UPDATE workflow_jobs SET info=? WHERE id=?').run(JSON.stringify(one), one.id);
    }
    db.close();
    if (tamper === 'unique-session') {
      const corruptDirectory = directory('gitflash-job-corrupt-open-');
      copyFileSync(backup, join(corruptDirectory, 'workspace.sqlite'));
      expect(() => createWorkspaceStore(corruptDirectory)).toThrow(
        expect.objectContaining({ code: 'INVALID_DATABASE' }),
      );
    }
    const target = directory('gitflash-job-corrupt-restore-');
    await expect(restoreWorkspaceBackup(target, backup)).rejects.toMatchObject({
      code: 'INVALID_BACKUP',
    });
  });
});
