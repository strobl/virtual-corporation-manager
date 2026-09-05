import { afterEach, expect, it } from 'vitest';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeProcess, runtimeEnvironment } from '../src/adapters/process.js';
import { executeWorkflowCheck } from '../src/adapters/workflow-check.js';

// Explicit opt-in integration proof. No model invocation or login is required.
// CI must install the pinned CLI and provide an installed Python >=3.8 interpreter.
const enabled = process.env.GITFLASH_LIVE_SANDBOX === '1';
let directory = '';
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
