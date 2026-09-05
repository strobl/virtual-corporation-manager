import { afterEach, expect, it } from 'vitest';
import { access, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { executeProcess, findExecutable, runtimeEnvironment } from '../src/adapters/process.js';
import { executeWorkflowCheck } from '../src/adapters/workflow-check.js';

// Explicit opt-in integration proof. No model invocation or login is required.
// CI must install the pinned CLI and provide an installed Python >=3.8 interpreter.
const enabled = process.env.GITFLASH_LIVE_SANDBOX === '1';
let directory = '';

async function reportSandboxStartupFailure(python: string): Promise<void> {
  // Only after a failed live preflight: observe the primary CLI error using the
  // same permission boundary and a fixed harmless command. No model or login.
  const executable = findExecutable('codex', process.env);
  if (!executable) return;
  const stage = await realpath(directory);
  const command = await realpath(python);
  const home = join(stage, '.diagnostic-home');
  await mkdir(home, { mode: 0o700 });
  const env = {
    ...runtimeEnvironment(process.env),
    HOME: home,
    USERPROFILE: home,
    CODEX_HOME: home,
    TMPDIR: stage,
    TMP: stage,
    TEMP: stage,
  };
  const filesystem = {
    ':minimal': 'read',
    ':workspace_roots': 'write',
    [dirname(command)]: 'read',
  };
  const permissions = `{${Object.entries(filesystem)
    .map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`)
    .join(',')}}`;
  try {
    const diagnostic = await executeProcess(
      executable,
      [
        'sandbox',
        '--permissions-profile',
        'gitflash-check',
        '--include-managed-config',
        '--cd',
        stage,
        '-c',
        `permissions.gitflash-check={filesystem=${permissions},network={enabled=false}}`,
        '--',
        command,
        '-I',
        '-B',
        '-c',
        'import json,sys;print(json.dumps({"format":"gitflash-sandbox-startup-diagnostic","python":sys.version_info[:3]}))',
      ],
      { env, cwd: stage, timeoutMs: 5000, maxBytes: 16000 },
    );
    const redact = (value: string) =>
      value
        .split(home)
        .join('<isolated-auth>')
        .split(stage)
        .join('<isolated-stage>')
        .slice(0, 4000);
    const namespacePrerequisites =
      process.platform === 'linux'
        ? Object.fromEntries(
            await Promise.all(
              [
                'kernel/unprivileged_userns_clone',
                'kernel/apparmor_restrict_unprivileged_userns',
                'user/max_user_namespaces',
              ].map(async (key) => [
                key,
                await readFile(`/proc/sys/${key}`, 'utf8')
                  .then((value) => value.trim().slice(0, 80))
                  .catch(() => 'unavailable'),
              ]),
            ),
          )
        : undefined;
    console.error(
      'Fixed local sandbox startup diagnostic: ' +
        JSON.stringify({
          node: process.version,
          platform: process.platform,
          exitCode: diagnostic.code,
          stdout: redact(diagnostic.stdout),
          stderr: redact(diagnostic.stderr),
          namespacePrerequisites,
        }),
    );
  } catch {
    console.error('Fixed local sandbox startup diagnostic was unavailable or exceeded its bound.');
  }
}
afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    await rm(`${directory}-outside.txt`, { force: true });
  }
});
it.runIf(enabled)(
  'runs fixed Python checks in the actual pinned network-off Codex sandbox',
  async () => {
    expect(['darwin', 'linux']).toContain(process.platform);
    const python = process.env.GITFLASH_PYTHON_PATH || '/usr/bin/python3';
    const version = await executeProcess(
      python,
      [
        '-I',
        '-c',
        'import json,sys;print(json.dumps({"major":sys.version_info.major,"minor":sys.version_info.minor}))',
      ],
      { env: runtimeEnvironment(process.env), timeoutMs: 5000 },
    );
    expect(version.code).toBe(0);
    const pythonVersion = JSON.parse(version.stdout);
    expect(pythonVersion.major === 3 && pythonVersion.minor >= 8).toBe(true);
    directory = await mkdtemp(join(tmpdir(), 'gitflash-live-oracle-'));
    const run = (source: string) =>
      executeWorkflowCheck({ directory, command: python, args: ['-B', '-c', source] }, process.env);
    const passing = await run(
      "import pathlib;pathlib.Path('check-output.txt').write_text('actual local check');print('PASS')",
    );
    if (passing.status !== 'completed') await reportSandboxStartupFailure(python);
    expect(passing, JSON.stringify(passing)).toMatchObject({
      status: 'completed',
      exitCode: 0,
      runtimeVersion: 'codex-cli 0.138.0',
    });
    expect(passing.output).toContain('PASS');
    expect(await readFile(join(directory, 'check-output.txt'), 'utf8')).toBe('actual local check');
    const failing = await run("import sys;print('assertion failed',file=sys.stderr);sys.exit(1)");
    expect(failing, JSON.stringify(failing)).toMatchObject({ status: 'completed', exitCode: 1 });
    expect(failing.output).toContain('assertion failed');
    const restricted = await run(`
import errno,json,pathlib,socket
result={}
try:
 pathlib.Path(${JSON.stringify(`${directory}-outside.txt`)}).write_text('must be blocked')
 result['outside_denied']=False
except OSError as error: result['outside_denied']=error.errno in (errno.EPERM,errno.EACCES,errno.EROFS)
connection=socket.socket()
try:
 connection.connect(('127.0.0.1',9))
 result['network_denied']=False
except OSError as error: result['network_denied']=error.errno in (errno.EPERM,errno.EACCES)
finally: connection.close()
print(json.dumps(result))
`);
    expect(restricted, JSON.stringify(restricted)).toMatchObject({
      status: 'completed',
      exitCode: 0,
    });
    // The platform's Python launcher may write ordinary startup diagnostics to
    // stderr; the first stdout line remains the fixed check's structured result.
    expect(JSON.parse(restricted.output.split('\n')[0])).toEqual({
      outside_denied: true,
      network_denied: true,
    });
    await expect(access(`${directory}-outside.txt`)).rejects.toMatchObject({ code: 'ENOENT' });
  },
  60_000,
);
