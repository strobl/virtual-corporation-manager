import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createWorkspaceStore, restoreWorkspaceBackup } from '../src/db/store.js';
import {
  createIntegrationService,
  exportBuzzTeam,
  validateBuzzTeam,
} from '../src/adapters/index.js';
import { CodexEventCollector } from '../src/adapters/codex.js';
import { executeProcess, runtimeEnvironment } from '../src/adapters/process.js';
import * as runtimeProcess from '../src/adapters/process.js';
import { redactError } from '../src/adapters/types.js';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'gitflash-adapter-test-'));
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
  const store = createWorkspaceStore(directory);
  cleanups.push(() => store.close());
  let preview = store.preview(
    [
      {
        type: 'company.create',
        input: {
          name: 'Test Company',
          shortCode: 'TEST',
          description: 'Fixture company',
          color: '#eab308',
        },
      },
    ],
    0,
  );
  store.apply(preview.id);
  const companyId = store.snapshot().companies[0]!.id;
  preview = store.preview(
    [
      {
        type: 'agent.create',
        companyId,
        input: {
          name: 'Product Analyst',
          role: 'Analyst',
          kind: 'agent',
          instructions: 'Analyze supplied evidence.',
          responsibilities: ['Make source-grounded recommendations'],
          departmentId: null,
          managerId: null,
        },
      },
    ],
    store.snapshot().revision,
  );
  store.apply(preview.id);
  return { directory, store, agentId: store.snapshot().agents[0]!.id, companyId };
}
async function until(condition: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out awaiting test fixture');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('optional task service (fixture execution; not live inference evidence)', () => {
  it('persists an actual supplied executor result and deduplicates repeated request IDs', async () => {
    const { directory, store, agentId } = fixture();
    let calls = 0;
    const service = createIntegrationService(store, directory, {
      env: {},
      executeCodex: async () => {
        calls++;
        return {
          output: 'Fixture result with a concrete recommendation.',
          runtimeVersion: 'fixture-1',
          sessionId: 'fixture-session',
        };
      },
    });
    cleanups.push(() => service.close());
    const request = { agentId, task: 'Review the company scope', requestId: 'request-test-1' };
    const run = await service.run(request);
    expect(run.status).toBe('queued');
    const replay = await service.run(request);
    expect(replay.id).toBe(run.id);
    await until(() => service.getRun(run.id)?.status === 'completed');
    expect(calls).toBe(1);
    expect(store.snapshot().work).toHaveLength(1);
    expect(store.snapshot().work[0]).toMatchObject({
      provenance: 'codex',
      status: 'submitted',
      runId: run.id,
    });
    expect(service.getRun(run.id)?.outputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(join(directory, 'runs', run.id, 'result.md'), 'utf8')).toContain(
      'concrete recommendation',
    );
    await expect(service.run({ ...request, task: 'Different task' })).rejects.toMatchObject({
      code: 'request-conflict',
    });
  });
  it('bounds concurrent runtime executions to one and keeps results tied to their task', async () => {
    const { directory, store, agentId } = fixture();
    let active = 0;
    let maximum = 0;
    const service = createIntegrationService(store, directory, {
      env: {},
      executeCodex: async (input) => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active--;
        return { output: input.run.task, runtimeVersion: null, sessionId: null };
      },
    });
    cleanups.push(() => service.close());
    const first = await service.run({
      agentId,
      task: 'First deliverable',
      requestId: 'request-one',
    });
    const second = await service.run({
      agentId,
      task: 'Second deliverable',
      requestId: 'request-two',
    });
    await until(() => service.getRun(second.id)?.status === 'completed');
    expect(maximum).toBe(1);
    expect(service.getRun(first.id)?.output).toBe('First deliverable');
    expect(service.getRun(second.id)?.output).toBe('Second deliverable');
  });
  it('records runtime failure honestly without manufacturing accepted work or leaking tokens', async () => {
    const { directory, store, agentId } = fixture();
    const service = createIntegrationService(store, directory, {
      env: { SLACK_BOT_TOKEN: 'xoxb-test-private-token' },
      executeCodex: async () => {
        throw new Error('failed with xoxb-test-private-token');
      },
    });
    cleanups.push(() => service.close());
    const run = await service.run({
      agentId,
      task: 'Task that fails',
      requestId: 'request-failed',
    });
    await until(() => service.getRun(run.id)?.status === 'failed');
    expect(service.getRun(run.id)?.error).toContain('[redacted]');
    expect(service.getRun(run.id)?.error).not.toContain('private-token');
    expect(store.snapshot().work).toHaveLength(0);
  });
  it('retains completed work and idempotency across a service restart', async () => {
    const { directory, store, agentId } = fixture();
    const service = createIntegrationService(store, directory, {
      env: {},
      executeCodex: async () => ({
        output: 'Persisted output',
        runtimeVersion: null,
        sessionId: null,
      }),
    });
    const request = { agentId, task: 'Persistent task', requestId: 'request-persist' };
    const run = await service.run(request);
    await until(() => service.getRun(run.id)?.status === 'completed');
    await service.close();
    const resumed = createIntegrationService(store, directory, {
      env: {},
      executeCodex: async () => {
        throw new Error('Must not execute again');
      },
    });
    cleanups.push(() => resumed.close());
    expect((await resumed.run(request)).id).toBe(run.id);
    expect(resumed.getRun(run.id)?.output).toBe('Persisted output');
  });
  it('restores the task ledger, usable outputs and request deduplication with the workspace backup', async () => {
    const { directory, store, agentId } = fixture();
    const service = createIntegrationService(store, directory, {
      env: {},
      executeCodex: async () => ({
        output: 'A recoverable deliverable',
        runtimeVersion: 'fixture-runtime',
        sessionId: 'fixture-session',
      }),
    });
    const request = { agentId, task: 'Generate recoverable work', requestId: 'request-backup' };
    const run = await service.run(request);
    await until(() => service.getRun(run.id)?.status === 'completed');
    await service.close();
    const backup = join(directory, 'backup.sqlite');
    await store.backup(backup);
    const restoredDirectory = mkdtempSync(join(tmpdir(), 'gitflash-adapter-restore-'));
    cleanups.push(() => rmSync(restoredDirectory, { recursive: true, force: true }));
    await restoreWorkspaceBackup(restoredDirectory, backup);
    const restoredStore = createWorkspaceStore(restoredDirectory);
    cleanups.push(() => restoredStore.close());
    const restoredService = createIntegrationService(restoredStore, restoredDirectory, {
      env: {},
      executeCodex: async () => {
        throw new Error('Must not rerun restored work');
      },
    });
    cleanups.push(() => restoredService.close());
    expect((await restoredService.run(request)).id).toBe(run.id);
    expect(restoredService.getRun(run.id)?.output).toBe('A recoverable deliverable');
    expect(restoredStore.snapshot().work[0]?.runId).toBe(run.id);
  });
  it('recovers interrupted work without silently repeating an external effect', async () => {
    const { directory, store } = fixture();
    const service = createIntegrationService(store, directory, { env: {} });
    await service.close();
    const db = new DatabaseSync(join(directory, 'workspace.sqlite'));
    db.prepare(
      'INSERT INTO integration_runs (id, request_id, info, context) VALUES (?, ?, ?, ?)',
    ).run(
      'interrupted',
      'request-interrupted',
      JSON.stringify({ id: 'interrupted', status: 'running', output: '' }),
      '{}',
    );
    db.close();
    const resumed = createIntegrationService(store, directory, { env: {} });
    cleanups.push(() => resumed.close());
    expect(resumed.getRun('interrupted')).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('Review any external activity'),
    });
  });
  it('rejects invalid requests and does not silently connect Slack', async () => {
    const { directory, store, agentId } = fixture();
    const service = createIntegrationService(store, directory, { env: {} });
    cleanups.push(() => service.close());
    await expect(
      service.run({ agentId, task: 'A task', requestId: '../escape' }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
    await expect(
      service.run({ agentId: 'missing', task: 'A task', requestId: 'request-missing' }),
    ).rejects.toMatchObject({ code: 'agent-not-found' });
    expect((await service.status()).slack.state).toBe('not-configured');
    await expect(service.connectSlack()).rejects.toMatchObject({ code: 'slack-not-configured' });
    expect(service.runs()).toHaveLength(0);
  });
  it('discards provider stderr and error payloads instead of exposing private diagnostics', async () => {
    const { directory, store, agentId } = fixture();
    const script = join(directory, 'fake-codex.cjs');
    const privateDiagnostic = 'provider-private-context-and-credential';
    writeFileSync(
      script,
      `const a=process.argv.slice(2);if(a.includes('--help')){console.log('--json --ephemeral --ignore-user-config --sandbox --skip-git-repo-check');}else if(a.includes('--version')){console.log('codex-cli 0.138.0');}else{console.error('${privateDiagnostic}');console.log(JSON.stringify({type:'error',message:'${privateDiagnostic}'}));process.exitCode=1;}\n`,
    );
    // Windows cannot execute a POSIX shebang. Prefix this test's JS fixture with
    // Node while retaining the real subprocess, stderr stream, and Codex parser.
    const realExecuteProcess = runtimeProcess.executeProcess;
    const receivedStderr: string[] = [];
    const launch = vi
      .spyOn(runtimeProcess, 'executeProcess')
      .mockImplementation(async (_executable, args, options) => {
        const result = await realExecuteProcess(process.execPath, [script, ...args], options);
        receivedStderr.push(result.stderr);
        return result;
      });
    cleanups.push(() => {
      launch.mockRestore();
    });
    const service = createIntegrationService(store, directory, {
      env: { ...runtimeEnvironment(process.env), GITFLASH_CODEX_PATH: process.execPath },
    });
    cleanups.push(() => service.close());
    const run = await service.run({
      agentId,
      task: 'Exercise failure reporting',
      requestId: 'request-provider-error',
    });
    await until(() => service.getRun(run.id)?.status === 'failed');
    expect(receivedStderr.some((stderr) => stderr.includes(privateDiagnostic))).toBe(true);
    expect(JSON.stringify(service.getRun(run.id))).not.toContain(privateDiagnostic);
    expect(service.getRun(run.id)?.error).toContain('did not return a successful');
    expect(store.snapshot().work).toHaveLength(0);
  });
  it('closes its database and emits no private record content when startup validation fails', () => {
    const { directory, store } = fixture();
    const db = new DatabaseSync(join(directory, 'workspace.sqlite'));
    db.prepare(
      'INSERT INTO integration_runs (id, request_id, info, context) VALUES (?, ?, ?, ?)',
    ).run('malformed', 'malformed-request', JSON.stringify('private-record-content'), '{}');
    db.close();
    const close = vi.spyOn(DatabaseSync.prototype, 'close');
    try {
      expect(() => createIntegrationService(store, directory, { env: {} })).toThrow(
        'could not be read safely',
      );
      expect(close).toHaveBeenCalledOnce();
    } finally {
      close.mockRestore();
    }
  });
});

describe('Buzz canonical team snapshot', () => {
  it('exports role instructions without existing identities, memory or automatic activation', () => {
    const { store, companyId } = fixture();
    const team = exportBuzzTeam(store.snapshot(), companyId);
    expect(team.format).toBe('buzz-team-snapshot');
    expect(team.members).toHaveLength(1);
    expect(team.members[0]!.definition).toMatchObject({
      parallelism: 1,
      respondTo: 'owner-only',
      runtime: 'codex',
    });
    expect(team.members[0]!.memory).toEqual({ level: 'none', entries: [] });
    expect(() => validateBuzzTeam(team)).not.toThrow();
    expect(JSON.stringify(team)).not.toMatch(/privateKey|authTag|envVars|start_on_app_launch/);
  });
  it('fails closed on leaked credentials and invalid memory/permission data', () => {
    const { store } = fixture();
    const team = exportBuzzTeam(store.snapshot());
    expect(() => validateBuzzTeam({ ...team, privateKey: 'secret' })).toThrow('credentials');
    const member = team.members[0]!;
    expect(() =>
      validateBuzzTeam({
        ...team,
        members: [{ ...member, memory: { level: 'none', entries: [{ body: 'private data' }] } }],
      }),
    ).toThrow('invalid');
    expect(() => exportBuzzTeam(store.snapshot(), 'missing')).toThrow('active company');
  });
});

describe('process and Codex event boundaries', () => {
  it('requires successful terminal events and a usable final response', () => {
    const collector = new CodexEventCollector();
    collector.consume('{"type":"thread.started","thread_id":"test-thread"}');
    collector.consume(
      '{"type":"item.completed","item":{"type":"agent_message","text":"Real output contract"}}',
    );
    expect(() => collector.result(0)).toThrow('successful');
    collector.consume('{"type":"turn.completed"}');
    expect(collector.result(0)).toMatchObject({
      output: 'Real output contract',
      sessionId: 'test-thread',
    });
    collector.consume('{"type":"turn.failed"}');
    expect(() => collector.result(0)).toThrow('successful');
  });
  it('passes arguments and stdin literally without a shell', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'gitflash-process-test-'));
    cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
    const file = join(directory, 'fixture.cjs');
    writeFileSync(
      file,
      "let input='';process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>console.log(JSON.stringify({arg:process.argv[2],input})));\n",
    );
    const literal = '$(touch should-not-exist); `echo unsafe`';
    const result = await executeProcess(process.execPath, [file, literal], {
      cwd: directory,
      env: runtimeEnvironment(process.env),
      input: literal,
    });
    expect(JSON.parse(result.stdout)).toEqual({ arg: literal, input: literal });
    expect(result.code).toBe(0);
  });
  it('bounds output and excludes unrelated connector credentials', async () => {
    expect(
      runtimeEnvironment({
        HOME: '/tmp/test',
        PATH: '/bin',
        SLACK_BOT_TOKEN: 'secret',
        CODEX_APP_TOOLS_PIPE_PATH: '/private/pipe',
      }),
    ).toEqual({ HOME: '/tmp/test', PATH: '/bin', NO_COLOR: '1' });
    await expect(
      executeProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(5000))'], {
        env: {},
        maxBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'output-limit' });
    expect(redactError('Bearer abc123 sk-secretvalue', {})).not.toContain('abc123');
  });
  it('preserves UTF-8 across chunks and terminates cancelled child processes', async () => {
    const unicode = await executeProcess(
      process.execPath,
      [
        '-e',
        "const b=Buffer.from('Grüße 東京');let i=0;const t=setInterval(()=>{process.stdout.write(b.subarray(i,i+1));if(++i===b.length)clearInterval(t)},1)",
      ],
      { env: {} },
    );
    expect(unicode.stdout).toBe('Grüße 東京');
    const controller = new AbortController();
    const child = executeProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
      env: {},
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    await expect(child).rejects.toMatchObject({ code: 'cancelled' });
  });
});
