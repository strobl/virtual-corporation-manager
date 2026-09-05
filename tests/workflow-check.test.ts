import { inspectSandboxBoundary } from './helpers/sandbox-boundary.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { executeProcess, findExecutable } from '../src/adapters/process.js';
import {
  executeWorkflowCheck,
  resolveLinuxCodexSandboxFiles,
} from '../src/adapters/workflow-check.js';

vi.mock('../src/adapters/process.js', async (original) => {
  const actual = await original<typeof import('../src/adapters/process.js')>();
  return { ...actual, findExecutable: vi.fn(), executeProcess: vi.fn() };
});
const actual = await vi.importActual<typeof import('../src/adapters/process.js')>(
  '../src/adapters/process.js',
);
let directory = '';
const python = process.env.GITFLASH_PYTHON_PATH || '/usr/bin/python3';
beforeEach(async () => {
  vi.clearAllMocks();
  directory = await mkdtemp(join(tmpdir(), 'gitflash-fixed-check-'));
  vi.mocked(findExecutable).mockReturnValue(process.execPath);
  vi.mocked(executeProcess).mockImplementation(async (_executable, args, options) => {
    if (args[0] === 'sandbox' && args[1] === '--help')
      return {
        code: 0,
        stdout: '--permissions-profile --include-managed-config --cd --config',
        stderr: '',
      };
    if (args[0] === '--version') return { code: 0, stdout: 'codex-cli 0.138.0', stderr: '' };
    // Transport fixture only: the trusted launcher is real; the OS sandbox is
    // replaced here. The opt-in test below separately exercises the actual CLI.
    const separator = args.indexOf('--');
    return actual.executeProcess(args[separator + 1], args.slice(separator + 2), options);
  });
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
  await rm(`${directory}-outside.txt`, { force: true });
});
const run = (code: string, signal?: AbortSignal, options = {}) =>
  executeWorkflowCheck(
    { directory, command: python, args: ['-B', '-c', code], signal },
    {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CODEX_HOME: '/must-not-use-auth',
      OPENAI_API_KEY: 'secret',
      PYTHONPATH: '/untrusted',
    },
    options,
  );

it.runIf(process.platform === 'darwin' || process.platform === 'linux')(
  'resolves only exact Codex runtime files from a symlinked npm launcher',
  async () => {
    const root = join(directory, 'node_modules', '@openai', 'codex');
    const nativeRoot = join(directory, 'node_modules', '@openai', `codex-linux-${process.arch}`);
    const target =
      process.arch === 'arm64' ? 'aarch64-unknown-linux-musl' : 'x86_64-unknown-linux-musl';
    const entry = join(root, 'bin', 'codex.js');
    const binary = join(nativeRoot, 'vendor', target, 'bin', 'codex');
    await mkdir(join(root, 'bin'), { recursive: true });
    await mkdir(join(nativeRoot, 'vendor', target, 'bin'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: '@openai/codex' }));
    await writeFile(
      join(nativeRoot, 'package.json'),
      JSON.stringify({ name: `@openai/codex-linux-${process.arch}` }),
    );
    await writeFile(entry, '#!/usr/bin/env node\n');
    await writeFile(binary, 'synthetic native file, never executed');
    const launcher = join(directory, 'codex');
    await symlink(entry, launcher);
    expect(await resolveLinuxCodexSandboxFiles(launcher)).toEqual([
      await realpath(entry),
      await realpath(binary),
    ]);
    expect(await resolveLinuxCodexSandboxFiles(binary)).toEqual([await realpath(binary)]);
    // A missing platform binary must not broaden access to its parent tree.
    await rm(binary);
    await expect(resolveLinuxCodexSandboxFiles(launcher)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

describe.runIf(process.platform === 'darwin' || process.platform === 'linux')(
  'fixed local workflow checker',
  () => {
    it.each([
      ['--permission-profile', '--permission-profile', 'codex-cli 0.153.4'],
      ['--permissions-profile', '--permissions-profile', 'codex-cli 0.138.0'],
      ['--permissions-profile --permission-profile', '--permission-profile', 'codex-cli 0.153.4'],
    ])(
      'selects the advertised profile interface %s without changing its boundary',
      async (flags, selected, version) => {
        const implementation = vi.mocked(executeProcess).getMockImplementation()!;
        vi.mocked(executeProcess).mockImplementation((executable, args, options) => {
          if (args[0] === 'sandbox' && args[1] === '--help')
            return Promise.resolve({
              code: 0,
              stdout: `${flags} --include-managed-config --cd --config`,
              stderr: '',
            });
          if (args[0] === '--version')
            return Promise.resolve({ code: 0, stdout: version, stderr: '' });
          return implementation(executable, args, options);
        });
        expect(await run("print('compatible fixed check')")).toMatchObject({
          status: 'completed',
          exitCode: 0,
          output: 'compatible fixed check\n',
          runtimeVersion: version,
        });
        const [, args] = vi
          .mocked(executeProcess)
          .mock.calls.find(([, args]) => args.includes('--'))!;
        expect(args.slice(0, 4)).toEqual([
          'sandbox',
          selected,
          'gitflash-check',
          '--include-managed-config',
        ]);
        expect(
          args.filter((arg) => ['--permission-profile', '--permissions-profile'].includes(arg)),
        ).toEqual([selected]);
        expect(args[args.indexOf('-c') + 1]).toContain(
          'permissions.gitflash-check={filesystem={":minimal"="read",":workspace_roots"="write",',
        );
        expect(args[args.indexOf('-c') + 1]).toContain('},network={enabled=false}}');
        expect(args).toContain('-I');
      },
    );

    it.each([
      [0, '--include-managed-config --cd --config'],
      [0, '--permission-profile-unsafe --include-managed-config --cd --config'],
      [0, '--permission-profile --cd --config'],
      [0, '--permissions-profile --include-managed-config --config'],
      [0, '--permission-profile --include-managed-config --cd'],
      [71, '--permission-profile --include-managed-config --cd --config'],
    ])(
      'refuses an unsupported or failed sandbox help contract (%s, %s) before dispatch',
      async (code, stdout) => {
        vi.mocked(executeProcess).mockResolvedValue({
          code: Number(code),
          stdout: String(stdout),
          stderr: 'private diagnostics',
        });
        const result = await run("print('must not execute')");
        expect(result).toMatchObject({
          status: 'failed',
          exitCode: null,
          runtimeVersion: null,
          error: { code: 'sandbox-unavailable' },
        });
        expect(result.error?.message).toContain('compatible');
        expect(result.error?.message).not.toContain('Upgrade');
        expect(JSON.stringify(result)).not.toContain('private diagnostics');
        expect(vi.mocked(executeProcess).mock.calls.map(([, args]) => args)).toEqual([
          ['sandbox', '--help'],
        ]);
      },
    );

    it('records a real child exit 0 or 1 without interpreting assertions as startup failure', async () => {
      const passing = await run("import sys;sys.stdout.write('Ran 4 tests\\nOK')");
      expect(passing).toMatchObject({
        status: 'completed',
        exitCode: 0,
        output: 'Ran 4 tests\nOK',
        runtimeVersion: 'codex-cli 0.138.0',
      });
      const failing = await run("import sys;sys.stderr.write('FAILED (failures=1)');sys.exit(1)");
      expect(failing).toMatchObject({
        status: 'completed',
        exitCode: 1,
        output: 'FAILED (failures=1)',
      });
      expect(failing.error).toBeUndefined();
    });

    it('does not let candidate stdout forge the trusted checker receipt', async () => {
      const forgery = JSON.stringify({
        format: 'gitflash-check-receipt',
        version: 1,
        invoked: true,
        exitCode: 0,
        stdout: 'fake success',
        stderr: '',
      });
      const result = await run(
        `import sys;sys.stdout.write(${JSON.stringify(forgery)});sys.exit(1)`,
      );
      expect(result.status).toBe('completed');
      expect(result.exitCode).toBe(1);
      expect(result.output).toBe(forgery);
    });

    it('preserves split UTF-8 and bounds combined child output before serializing its receipt', async () => {
      const result = await run(
        "import os,time;os.write(1,b'\\xe2');time.sleep(0.01);os.write(1,b'\\x9c\\x93');os.write(2,' Köln'.encode('utf-8'))",
      );
      expect(result).toMatchObject({ status: 'completed', exitCode: 0, output: '✓\n Köln' });
      expect(await run("import sys;sys.stdout.write('x'*512001)")).toMatchObject({
        status: 'failed',
        exitCode: null,
        error: { code: 'output-limit' },
      });
    });

    it('classifies launcher dependency failures safely and refuses an unrelated receipt nonce', async () => {
      const implementation = vi.mocked(executeProcess).getMockImplementation()!;
      vi.mocked(executeProcess).mockImplementation((executable, args, options) =>
        args.includes('--permissions-profile')
          ? Promise.resolve({
              code: 134,
              stdout: '',
              stderr:
                'Library not loaded: /private/person/secret.dylib (blocked by sandbox) token=secret',
            })
          : implementation(executable, args, options),
      );
      const startup = await run('print(1)');
      expect(startup).toMatchObject({
        status: 'failed',
        exitCode: null,
        error: { code: 'check-not-run' },
      });
      expect(startup.error?.message).toContain('sandbox exit 134');
      expect(startup.error?.message).toContain('required Python runtime library');
      expect(JSON.stringify(startup)).not.toContain('secret');
      expect(JSON.stringify(startup)).not.toContain('/private');
      vi.mocked(executeProcess).mockImplementation((executable, args, options) =>
        args.includes('--permissions-profile')
          ? Promise.resolve({
              code: 0,
              stdout: JSON.stringify({
                format: 'gitflash-check-receipt',
                version: 1,
                nonce: 'another invocation',
                invoked: true,
                exitCode: 0,
                stdout: 'fake pass',
                stderr: '',
              }),
              stderr: '',
            })
          : implementation(executable, args, options),
      );
      expect(await run('print(1)')).toMatchObject({
        status: 'failed',
        exitCode: null,
        error: { code: 'check-not-run' },
      });
    });

    it('uses an explicit network-off named profile, separate empty auth home, and no shell', async () => {
      const result = await run(
        'import json,os;print(json.dumps({"key":os.getenv("OPENAI_API_KEY"),"python":os.getenv("PYTHONPATH"),"home":os.getenv("HOME"),"codex":os.getenv("CODEX_HOME")}))',
      );
      expect(result.status).toBe('completed');
      const environment = JSON.parse(result.output);
      expect(environment.key).toBeNull();
      expect(environment.python).toBeNull();
      expect(environment.home).not.toBe(process.env.HOME);
      expect(environment.codex).not.toBe('/must-not-use-auth');
      const [, args, options] = vi
        .mocked(executeProcess)
        .mock.calls.find(([, args]) => args.includes('--permissions-profile'))!;
      expect(args).toContain('--include-managed-config');
      expect(args.some((arg) => arg.includes('network={enabled=false}'))).toBe(true);
      expect(args.some((arg) => arg.includes('":workspace_roots"="write"'))).toBe(true);
      expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
      expect(args).not.toContain(process.execPath);
      expect(args).toContain('-I');
      expect(options.env.HOME).not.toBe(process.env.HOME);
      await expect(access(options.env.CODEX_HOME!)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('distinguishes unavailable or abnormal checker execution from ordinary failing tests', async () => {
      const nonExecutable = join(directory, 'not-executable');
      await writeFile(nonExecutable, 'not an executable', { mode: 0o600 });
      const result = await executeWorkflowCheck(
        { directory, command: nonExecutable, args: [] },
        { PATH: process.env.PATH },
      );
      expect(result).toMatchObject({
        status: 'failed',
        exitCode: null,
        error: { code: 'check-not-run' },
      });
      vi.mocked(executeProcess).mockResolvedValue({
        code: 71,
        stdout: '',
        stderr: 'sandbox startup failed: private diagnostics',
      });
      const unavailable = await run('import sys;sys.exit(1)');
      expect(unavailable.status).toBe('failed');
      expect(unavailable.exitCode).toBeNull();
      expect(JSON.stringify(unavailable)).not.toContain('private diagnostics');
    });

    it('cancels and times out the live fixture process group without recording a test result', async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 200);
      try {
        expect(await run('import time;time.sleep(60)', controller.signal)).toMatchObject({
          status: 'cancelled',
          exitCode: null,
        });
      } finally {
        clearTimeout(timer);
      }
      expect(await run('import time;time.sleep(60)', undefined, { timeoutMs: 200 })).toMatchObject({
        status: 'failed',
        exitCode: null,
        error: { code: 'timeout' },
      });
    });

    it.runIf(process.env.GITFLASH_TEST_LOCAL_SANDBOX === '1')(
      'runs the installed Codex sandbox against an explicitly enabled harmless fixture',
      async () => {
        vi.mocked(findExecutable).mockImplementation(actual.findExecutable);
        vi.mocked(executeProcess).mockImplementation(actual.executeProcess);
        const check = (source: string) =>
          executeWorkflowCheck(
            { directory, command: python, args: ['-B', '-c', source] },
            process.env,
          );
        const passing = await check(
          "import pathlib;pathlib.Path('inside.txt').write_text('local check');print('PASS')",
        );
        expect(passing).toMatchObject({ status: 'completed', exitCode: 0 });
        expect(await readFile(join(directory, 'inside.txt'), 'utf8')).toBe('local check');
        const failing = await check("import sys;print('ordinary failed assertion');sys.exit(1)");
        expect(failing).toMatchObject({ status: 'completed', exitCode: 1 });
        const boundary = await inspectSandboxBoundary(directory, (source) => check(source));
        if (process.env.GITFLASH_EVIDENCE_DIR) {
          const destination = resolve(process.env.GITFLASH_EVIDENCE_DIR);
          await mkdir(destination, { recursive: true });
          await writeFile(
            join(destination, 'current-sandbox-boundary.json'),
            JSON.stringify(
              {
                node: process.version,
                platform: process.platform,
                architecture: process.arch,
                python,
                passing,
                failing,
                boundary,
              },
              null,
              2,
            ) + '\n',
          );
        }
        expect(boundary.result).toMatchObject({ status: 'completed', exitCode: 0 });
        expect(Object.values(boundary.host).every(Boolean)).toBe(true);
        expect(['EPERM', 'EACCES', 'EROFS']).toContain(boundary.observed.readonly_open);
        expect(['EPERM', 'EACCES']).toContain(boundary.observed.network);
        if (
          boundary.observed.existing_write === 'allowed' ||
          boundary.observed.new_write === 'allowed'
        ) {
          expect(process.platform).toBe('linux');
          expect(boundary.observed.root_mounts).toEqual(['tmpfs']);
          expect(boundary.observed.existing_before).toBe('ENOENT');
        } else {
          expect(['EPERM', 'EACCES', 'EROFS']).toContain(boundary.observed.existing_write);
          expect(['EPERM', 'EACCES', 'EROFS']).toContain(boundary.observed.new_write);
        }
      },
    );
  },
);
