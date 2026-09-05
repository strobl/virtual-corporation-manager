import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeProcess, findExecutable } from '../src/adapters/process.js';
import { executeWorkflowCheck } from '../src/adapters/workflow-check.js';

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

describe.runIf(process.platform === 'darwin' || process.platform === 'linux')(
  'fixed local workflow checker',
  () => {
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
        const fixture = `
import errno,json,pathlib,socket
pathlib.Path('actual-marker.txt').write_text('local sandbox check')
result={}
try:
 pathlib.Path(${JSON.stringify(`${directory}-outside.txt`)}).write_text('must be blocked')
 result['outside']='allowed'
except OSError as error: result['outside']=errno.errorcode[error.errno]
connection=socket.socket()
try:
 connection.connect(('127.0.0.1',9))
 result['network']='allowed'
except OSError as error: result['network']=errno.errorcode[error.errno]
finally: connection.close()
print(json.dumps(result))
`;
        const result = await executeWorkflowCheck(
          { directory, command: python, args: ['-B', '-c', fixture] },
          process.env,
        );
        expect(result, JSON.stringify(result)).toMatchObject({ status: 'completed', exitCode: 0 });
        expect(JSON.parse(result.output.split('\n')[0])).toEqual({
          outside: 'EPERM',
          network: 'EPERM',
        });
        expect(await readFile(join(directory, 'actual-marker.txt'), 'utf8')).toBe(
          'local sandbox check',
        );
        await expect(access(`${directory}-outside.txt`)).rejects.toMatchObject({ code: 'ENOENT' });
      },
    );
  },
);
