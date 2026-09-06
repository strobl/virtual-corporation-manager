import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { executeProcess, findExecutable } from '../src/adapters/process.js';
import {
  executeWorkflowCodex,
  WorkflowCodexCollector,
  WORKFLOW_EXECUTION_FILE,
} from '../src/adapters/workflow-codex.js';

vi.mock('../src/adapters/process.js', async (original) => {
  const actual = await original<typeof import('../src/adapters/process.js')>();
  return { ...actual, findExecutable: vi.fn(), executeProcess: vi.fn() };
});
const actualProcess = (
  await vi.importActual<typeof import('../src/adapters/process.js')>('../src/adapters/process.js')
).executeProcess;
const features = [
  'apps',
  'plugins',
  'hooks',
  'browser_use',
  'browser_use_external',
  'in_app_browser',
  'computer_use',
  'image_generation',
  'multi_agent',
  'memories',
  'chronicle',
  'shell_snapshot',
];
const supportedHelp =
  '--json --ephemeral --ignore-user-config --sandbox --skip-git-repo-check --strict-config --cd --disable';
const thread = { type: 'thread.started', thread_id: 'isolated-session' };
const started = {
  type: 'item.started',
  item: {
    id: 'check-1',
    type: 'command_execution',
    command: 'python -B oracle.py',
    status: 'in_progress',
  },
};
const completed = {
  type: 'item.completed',
  item: {
    ...started.item,
    status: 'completed',
    aggregated_output: 'Ran 4 tests\nOK\n',
    exit_code: 0,
  },
};
const message = {
  type: 'item.completed',
  item: { id: 'answer', type: 'agent_message', text: 'Files saved. Köln ✓\nExact final output.' },
};
let directory = '';
let fixtureRoot = '';
let fixture = '';
const emitted = (...events: unknown[]) =>
  `process.stdout.write(${JSON.stringify(events.map((event) => JSON.stringify(event)).join('\n') + '\n')});`;
beforeEach(async () => {
  vi.clearAllMocks();
  directory = await mkdtemp(join(tmpdir(), 'gitflash-workflow-adapter-'));
  fixtureRoot = directory;
  fixture = emitted(thread, started, completed, message, { type: 'turn.completed' });
  vi.mocked(findExecutable).mockReturnValue(process.execPath);
  vi.mocked(executeProcess).mockImplementation(async (executable, args, options) => {
    if (args[0] === 'exec' && args[1] === '--help')
      return { code: 0, stdout: supportedHelp, stderr: '' };
    if (args[0] === '--help') return { code: 0, stdout: '--ask-for-approval', stderr: '' };
    if (args[0] === '--version') return { code: 0, stdout: 'codex-cli 0.138.0\n', stderr: '' };
    if (args.at(-2) === 'features' && args.at(-1) === 'list')
      return {
        code: 0,
        stdout: features.map((name) => `${name} stable false`).join('\n'),
        stderr: '',
      };
    return actualProcess(executable, ['-e', fixture], options);
  });
});
afterEach(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});
async function nextStage() {
  directory = join(fixtureRoot, 'next-stage');
  await mkdir(directory);
}
const run = (signal?: AbortSignal, options = {}) =>
  executeWorkflowCodex(
    { directory, prompt: 'Create the requested local artifact.', signal },
    {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      OPENAI_API_KEY: 'must-not-inherit',
      SLACK_BOT_TOKEN: 'must-not-inherit',
      NODE_OPTIONS: '--untrusted-hook',
      PYTHONPATH: '/untrusted',
    },
    options,
  );

describe('file-producing Codex stage boundary', () => {
  it('captures actual streamed command completions separately from exact final output and files', async () => {
    // This is a controlled local Node protocol fixture, not a model execution claim.
    const stream = [thread, started, completed, message, { type: 'turn.completed' }]
      .map((event) => JSON.stringify(event))
      .join('\n');
    const cut = Buffer.from(stream).indexOf(Buffer.from('ö')) + 1;
    fixture = `const fs=require('node:fs'); fs.writeFileSync('artifact.txt','fixture runtime file'); const b=Buffer.from(${JSON.stringify(stream)}); process.stdout.write(b.subarray(0,${cut})); setTimeout(()=>process.stdout.write(b.subarray(${cut})),25);`;
    const result = await run();
    expect(result).toMatchObject({
      status: 'completed',
      output: message.item.text,
      sessionId: 'isolated-session',
      runtimeVersion: 'codex-cli 0.138.0',
      exitCode: 0,
    });
    expect(result.commands).toEqual([
      expect.objectContaining({
        id: 'check-1',
        command: started.item.command,
        exitCode: 0,
        status: 'completed',
        output: completed.item.aggregated_output,
      }),
    ]);
    expect(await readFile(join(directory, 'artifact.txt'), 'utf8')).toBe('fixture runtime file');
    expect(Number.isNaN(Date.parse(result.commands[0].observedAt))).toBe(false);
    const identity = JSON.parse(await readFile(join(directory, WORKFLOW_EXECUTION_FILE), 'utf8'));
    expect(identity).toEqual({
      format: 'gitflash-observed-runtime-session',
      sessionId: result.sessionId,
      runtimeVersion: result.runtimeVersion,
      observedAt: expect.any(String),
    });
    expect(Date.parse(identity.observedAt)).toBeGreaterThanOrEqual(Date.parse(result.startedAt));
    expect(Date.parse(identity.observedAt)).toBeLessThanOrEqual(Date.parse(result.finishedAt));
  });

  it('passes explicit scoped permission flags, isolated shell environment and stdin without a shell', async () => {
    const prompt = 'literal $(touch NEVER) `false`\n--dangerously-bypass-approvals-and-sandbox';
    fixture =
      "require('node:fs').writeFileSync(require('node:path').join(process.env.TMPDIR,'xcrun_db-fixture'),'runtime cache');" +
      fixture;
    const result = await executeWorkflowCodex(
      { directory, prompt },
      {
        PATH: '/safe/bin',
        HOME: '/original/home',
        CODEX_HOME: '/original/auth',
        OPENAI_API_KEY: 'secret',
        NODE_OPTIONS: 'hook',
        PYTHONPATH: 'hook',
      },
    );
    expect(result.status).toBe('completed');
    const call = vi.mocked(executeProcess).mock.calls.find(([, args]) => args.includes('--json'))!;
    const [, args, options] = call;
    expect(args.slice(0, 3)).toEqual(['--ask-for-approval', 'never', 'exec']);
    expect(args).toContain('workspace-write');
    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--strict-config');
    expect(args).toContain('sandbox_workspace_write.network_access=false');
    expect(args).toContain('sandbox_workspace_write.writable_roots=[]');
    expect(args).toContain('shell_environment_policy.inherit="none"');
    expect(args).toContain('shell_environment_policy.experimental_use_profile=false');
    expect(args).toContain('web_search="disabled"');
    expect(args).not.toContain('--ignore-rules');
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(args).not.toContain('--full-auto');
    expect(args).not.toContain(prompt);
    expect(options.input).toContain(prompt);
    expect(options.input).toContain(
      'Before making any claim about your own execution identity, read WORKFLOW-EXECUTION.json',
    );
    expect(options.env).toEqual({
      PATH: '/safe/bin',
      HOME: '/original/home',
      CODEX_HOME: '/original/auth',
      NO_COLOR: '1',
      TMPDIR: join(options.cwd!, '.runtime', 'tmp'),
      TMP: join(options.cwd!, '.runtime', 'tmp'),
      TEMP: join(options.cwd!, '.runtime', 'tmp'),
    });
    const shell = args.find((arg) => arg.startsWith('shell_environment_policy.set='))!;
    expect(shell).toContain(
      `GIT_CEILING_DIRECTORIES=${JSON.stringify([options.cwd, dirname(options.cwd!)].join(delimiter))}`,
    );
    expect(shell).toContain('GIT_CONFIG_NOSYSTEM="1"');
    for (const key of ['HOME', 'USERPROFILE'])
      expect(shell).toContain(`${key}=${JSON.stringify(join(options.cwd!, '.runtime', 'home'))}`);
    for (const key of ['TMPDIR', 'TMP', 'TEMP'])
      expect(shell).toContain(`${key}=${JSON.stringify(join(options.cwd!, '.runtime', 'tmp'))}`);
    expect(shell).not.toContain('/original/home');
    expect(shell).not.toContain('/original/auth');
    expect((await stat(join(directory, '.runtime', 'home'))).isDirectory()).toBe(true);
    expect(await readFile(join(directory, '.runtime', 'tmp', 'xcrun_db-fixture'), 'utf8')).toBe(
      'runtime cache',
    );
    await expect(stat(join(directory, 'xcrun_db-fixture'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    for (const feature of features) expect(args).toContain(feature);
  });

  it('prevents actual parent repository discovery from the stage root and nested directories', async () => {
    const gitEnv = {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      HOME: fixtureRoot,
      USERPROFILE: fixtureRoot,
      GIT_CONFIG_NOSYSTEM: '1',
    };
    expect(
      (await actualProcess('git', ['init', '--quiet'], { cwd: fixtureRoot, env: gitEnv })).code,
    ).toBe(0);
    directory = join(fixtureRoot, 'stage');
    await mkdir(directory);
    expect(
      (
        await actualProcess('git', ['rev-parse', '--show-toplevel'], {
          cwd: directory,
          env: gitEnv,
        })
      ).code,
    ).toBe(0);
    expect((await run()).status).toBe('completed');
    const [, args] = vi
      .mocked(executeProcess)
      .mock.calls.find(([, args]) => args.includes('--json'))!;
    const setting = args.find((arg) => arg.startsWith('shell_environment_policy.set='))!;
    const ceiling = JSON.parse(setting.match(/GIT_CEILING_DIRECTORIES=("(?:[^"\\]|\\.)*")/)![1]);
    const nested = join(directory, 'nested');
    await mkdir(nested);
    for (const cwd of [directory, nested]) {
      const result = await actualProcess('git', ['rev-parse', '--show-toplevel'], {
        cwd,
        env: { ...gitEnv, GIT_CEILING_DIRECTORIES: ceiling },
      });
      expect(result.code).not.toBe(0);
      expect(result.stdout).toBe('');
    }
  });

  it('does not turn model assertions or a failing command into passing command evidence', async () => {
    fixture = emitted(
      thread,
      { ...message, item: { ...message.item, text: '{"testsPassed":true,"exit_code":0}' } },
      { type: 'turn.completed' },
    );
    expect((await run()).commands).toEqual([]);
    await nextStage();
    fixture = emitted(
      thread,
      started,
      {
        ...completed,
        item: {
          ...completed.item,
          status: 'failed',
          exit_code: 1,
          aggregated_output: 'FAILED (failures=1)',
        },
      },
      message,
      { type: 'turn.completed' },
    );
    const result = await run();
    expect(result.status).toBe('completed'); // Model turn completed, checker did not pass.
    expect(result.commands[0]).toMatchObject({
      status: 'failed',
      exitCode: 1,
      output: 'FAILED (failures=1)',
    });
  });

  it('preserves partial evidence on process failure and never exposes provider stderr', async () => {
    fixture =
      emitted(thread, started, completed) +
      `process.stderr.write('API_KEY=secret task text');process.exitCode=1;`;
    const result = await run();
    expect(result).toMatchObject({
      status: 'failed',
      exitCode: 1,
      error: { code: 'runtime-failed' },
    });
    expect(result.commands).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('task text');
  });

  it('cancels a live fixture process while retaining observed unfinished commands', async () => {
    const controller = new AbortController();
    fixture = emitted(thread, started) + 'setInterval(()=>{},1000);';
    const timer = setTimeout(() => controller.abort(), 200);
    try {
      const result = await run(controller.signal);
      expect(result).toMatchObject({
        status: 'cancelled',
        exitCode: null,
        error: { code: 'cancelled' },
      });
      expect(result.commands[0]).toMatchObject({ status: 'in_progress', exitCode: null });
    } finally {
      clearTimeout(timer);
    }
  });

  it('stops timeout and output overflow without inventing a completed result', async () => {
    fixture = emitted(thread, started) + 'setInterval(()=>{},1000);';
    expect(await run(undefined, { timeoutMs: 200 })).toMatchObject({
      status: 'failed',
      error: { code: 'timeout' },
    });
    await nextStage();
    fixture = emitted(thread, started) + "process.stdout.write('x'.repeat(2048));";
    expect(await run(undefined, { maxBytes: 1024 })).toMatchObject({
      status: 'failed',
      error: { code: 'output-limit' },
    });
  });

  it('fails closed before model execution when a required CLI capability is absent', async () => {
    vi.mocked(executeProcess).mockResolvedValue({
      code: 0,
      stdout: '--json --sandbox',
      stderr: '',
    });
    expect(await run()).toMatchObject({ status: 'failed', error: { code: 'runtime-version' } });
    expect(vi.mocked(executeProcess).mock.calls).toHaveLength(1);
  });

  it('writes execution identity synchronously before processing later events and refuses another session', async () => {
    const implementation = vi.mocked(executeProcess).getMockImplementation()!;
    let observedImmediately: unknown;
    const onSession = vi.fn((identity) => {
      expect(JSON.parse(readFileSync(join(directory, WORKFLOW_EXECUTION_FILE), 'utf8'))).toEqual(
        identity,
      );
    });
    vi.mocked(executeProcess).mockImplementation((executable, args, options) => {
      if (!args.includes('--json')) return implementation(executable, args, options);
      options.onLine!(JSON.stringify(thread));
      observedImmediately = JSON.parse(
        readFileSync(join(directory, WORKFLOW_EXECUTION_FILE), 'utf8'),
      );
      expect(onSession).toHaveBeenCalledExactlyOnceWith(observedImmediately);
      options.onLine!(JSON.stringify(thread));
      expect(onSession).toHaveBeenCalledTimes(1);
      options.onLine!(JSON.stringify(message));
      options.onLine!(JSON.stringify({ type: 'turn.completed' }));
      return Promise.resolve({ code: 0, stdout: '', stderr: '' });
    });
    expect(
      (await executeWorkflowCodex({ directory, prompt: 'Local stage', onSession }, {})).status,
    ).toBe('completed');
    expect(observedImmediately).toMatchObject({
      sessionId: 'isolated-session',
      runtimeVersion: 'codex-cli 0.138.0',
    });
    await nextStage();
    vi.mocked(executeProcess).mockImplementation(implementation);
    fixture = emitted(thread, { ...thread, thread_id: 'different-session' });
    expect(await run()).toMatchObject({
      status: 'failed',
      sessionId: 'isolated-session',
      error: { code: 'runtime-protocol' },
    });
    expect(
      JSON.parse(await readFile(join(directory, WORKFLOW_EXECUTION_FILE), 'utf8')).sessionId,
    ).toBe('isolated-session');
  });

  it('stops after a persistence hook failure without exposing its error or losing observed identity', async () => {
    const onSession = vi.fn(() => {
      throw new Error('private database path and token=secret');
    });
    const result = await executeWorkflowCodex({ directory, prompt: 'Local stage', onSession }, {});
    expect(result).toMatchObject({
      status: 'failed',
      sessionId: 'isolated-session',
      runtimeVersion: 'codex-cli 0.138.0',
      error: { code: 'runtime-evidence' },
    });
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('private database');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(
      JSON.parse(await readFile(join(directory, WORKFLOW_EXECUTION_FILE), 'utf8')).sessionId,
    ).toBe('isolated-session');
  });

  it('refuses a preexisting reserved runtime subtree before any CLI call', async () => {
    await mkdir(join(directory, '.runtime'));
    await writeFile(join(directory, '.runtime', 'existing'), 'preserve');
    expect(await run()).toMatchObject({ status: 'failed', error: { code: 'runtime-evidence' } });
    expect(executeProcess).not.toHaveBeenCalled();
    expect(await readFile(join(directory, '.runtime', 'existing'), 'utf8')).toBe('preserve');
  });

  it('never overwrites a reserved identity file, including a creation race', async () => {
    await writeFile(join(directory, WORKFLOW_EXECUTION_FILE), 'existing evidence');
    expect(await run()).toMatchObject({ status: 'failed', error: { code: 'runtime-evidence' } });
    expect(executeProcess).not.toHaveBeenCalled();
    expect(await readFile(join(directory, WORKFLOW_EXECUTION_FILE), 'utf8')).toBe(
      'existing evidence',
    );
    await nextStage();
    fixture =
      `require('node:fs').writeFileSync(${JSON.stringify(WORKFLOW_EXECUTION_FILE)},'racing evidence');` +
      emitted(thread, message, { type: 'turn.completed' });
    expect(await run()).toMatchObject({ status: 'failed', error: { code: 'runtime-evidence' } });
    expect(await readFile(join(directory, WORKFLOW_EXECUTION_FILE), 'utf8')).toBe(
      'racing evidence',
    );
  });

  it('rejects malformed completion evidence, changed command identity and external tool events', () => {
    for (const item of [
      { ...completed.item, exit_code: '0' },
      { ...completed.item, exit_code: null },
      { ...completed.item, command: 'different command' },
    ]) {
      const collector = new WorkflowCodexCollector();
      collector.consume(JSON.stringify(started));
      expect(() =>
        collector.consume(JSON.stringify({ type: 'item.completed', item })),
      ).toThrowError(expect.objectContaining({ code: 'runtime-protocol' }));
    }
    const collector = new WorkflowCodexCollector();
    expect(() => collector.consume('{bad')).toThrowError(
      expect.objectContaining({ code: 'runtime-protocol' }),
    );
    expect(() =>
      collector.consume(JSON.stringify({ type: 'item.started', item: { type: 'mcp_tool_call' } })),
    ).toThrowError(expect.objectContaining({ code: 'runtime-policy' }));
  });
});
