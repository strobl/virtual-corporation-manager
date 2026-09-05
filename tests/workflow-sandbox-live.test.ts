import { afterEach, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { executeProcess, findExecutable, runtimeEnvironment } from '../src/adapters/process.js';
import { executeWorkflowCheck, workflowCheckFilesystem } from '../src/adapters/workflow-check.js';
import { inspectSandboxBoundary } from './helpers/sandbox-boundary.js';

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
  const filesystem = await workflowCheckFilesystem(command, executable);
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
    const boundary = await inspectSandboxBoundary(directory, run);
    console.info('Sandbox boundary evidence: ' + JSON.stringify(boundary));
    if (process.env.GITFLASH_EVIDENCE_DIR) {
      const destination = resolve(process.env.GITFLASH_EVIDENCE_DIR);
      await mkdir(destination, { recursive: true });
      await writeFile(
        join(destination, 'sandbox-boundary.json'),
        JSON.stringify(
          {
            format: 'gitflash-host-sandbox-boundary',
            node: process.version,
            platform: process.platform,
            architecture: process.arch,
            pythonVersion,
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
  60_000,
);
