import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { executeProcess, findExecutable, runtimeEnvironment } from './process.js';
import { IntegrationError } from './types.js';

export interface WorkflowCheckInput {
  directory: string;
  /** Resolved trusted Python >=3.8 executable, chosen by the service, never model text. */
  command: string;
  args: string[];
  signal?: AbortSignal;
}
export interface WorkflowCheckResult {
  /** completed means the checker exited normally; exitCode 1 is still a failed check. */
  status: 'completed' | 'failed' | 'cancelled';
  exitCode: number | null;
  output: string;
  error?: { code: string; message: string };
  runtimeVersion: string | null;
  startedAt: string;
  finishedAt: string;
}
export interface WorkflowCheckOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

// This trusted launcher serializes child output instead of mixing a success marker
// into untrusted test stdout. It never evaluates the supplied command or arguments.
// Thus sandbox startup errors cannot be confused with an ordinary assertion exit 1.
const HARNESS = `
import json,selectors,subprocess,sys
command,args_text,nonce=sys.argv[1:]
receipt={"format":"gitflash-check-receipt","version":1,"nonce":nonce,"invoked":False,"exitCode":None,"stdout":"","stderr":""}
if sys.version_info < (3,8):
 receipt["error"]="python-version"
else:
 try:
  child=subprocess.Popen([command]+json.loads(args_text),shell=False,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  selector=selectors.DefaultSelector()
  selector.register(child.stdout,selectors.EVENT_READ,"stdout")
  selector.register(child.stderr,selectors.EVENT_READ,"stderr")
  chunks={"stdout":[],"stderr":[]}
  size=0
  while selector.get_map():
   for key,_ in selector.select():
    data=key.fileobj.read1(65536)
    if not data:
     selector.unregister(key.fileobj)
     key.fileobj.close()
    else:
     size+=len(data)
     if size>512000:
      receipt["error"]="output-limit"
      child.kill()
      break
     chunks[key.data].append(data)
   if "error" in receipt: break
  selector.close()
  child.stdout.close()
  child.stderr.close()
  code=child.wait()
  receipt["invoked"]="error" not in receipt and code>=0
  receipt["exitCode"]=code if receipt["invoked"] else None
  for stream in chunks: receipt[stream]=b"".join(chunks[stream]).decode("utf-8",errors="replace")
 except (OSError,ValueError):
  receipt["error"]="spawn-failed"
sys.stdout.write(json.dumps(receipt)+"\\n")
`;

function startupFailure(code: number, stderr: string): string {
  // Classify bounded runtime diagnostics; do not expose paths, task text or raw stderr.
  const cause = /Library not loaded:|error while loading shared libraries:/i.test(stderr)
    ? ' A required Python runtime library was unavailable inside the sandbox.'
    : /Operation not permitted|Permission denied|blocked by sandbox/i.test(stderr)
      ? ' The sandbox denied a runtime startup operation.'
      : '';
  return `The trusted Python checker launcher did not return a valid receipt (sandbox exit ${code}).${cause} Verify the selected Python >=3.8 installation and Codex sandbox support. No test pass or failure was recorded.`;
}

/**
 * A local fixed-check subprocess, with no model request and no saved login copied.
 * Requires the explicit named-profile sandbox interface of Codex CLI. The service
 * must retain approved oracle bytes and rehash all candidate/oracle inputs afterward.
 * Source: https://learn.chatgpt.com/docs/permissions (workspace write without network).
 */
export async function executeWorkflowCheck(
  input: WorkflowCheckInput,
  env: NodeJS.ProcessEnv,
  options: WorkflowCheckOptions = {},
): Promise<WorkflowCheckResult> {
  const startedAt = new Date().toISOString();
  let runtimeVersion: string | null = null;
  let temporary: string | undefined;
  const finish = (
    status: WorkflowCheckResult['status'],
    exitCode: number | null,
    output: string,
    error?: WorkflowCheckResult['error'],
  ): WorkflowCheckResult => ({
    status,
    exitCode,
    output,
    runtimeVersion,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  });
  const fail = (code: string, message: string): never => {
    throw new IntegrationError(code, message);
  };
  try {
    if (!['darwin', 'linux'].includes(process.platform))
      return fail(
        'sandbox-unavailable',
        'The fixed workflow checker currently requires the supported macOS or Linux Codex sandbox. No check was run.',
      );
    const timeoutMs = options.timeoutMs ?? 60_000;
    const maxBytes = options.maxBytes ?? 2_000_000;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 300_000 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1024 ||
      maxBytes > 4_000_000
    )
      return fail('check-input', 'Checker timeout or output limit is outside the supported range.');
    const deadline = Date.now() + timeoutMs;
    const remaining = () => {
      if (input.signal?.aborted)
        return fail('cancelled', 'The fixed workflow check was cancelled.');
      const value = deadline - Date.now();
      if (value <= 0) return fail('timeout', 'The fixed workflow check exceeded its time limit.');
      return value;
    };
    remaining();
    if (
      typeof input.directory !== 'string' ||
      !isAbsolute(input.directory) ||
      typeof input.command !== 'string' ||
      !isAbsolute(input.command) ||
      !Array.isArray(input.args) ||
      input.args.length > 64 ||
      input.args.some(
        (arg) => typeof arg !== 'string' || arg.includes('\0') || Buffer.byteLength(arg) > 32_000,
      )
    )
      return fail(
        'check-input',
        'Provide an absolute isolated directory and trusted executable with bounded arguments.',
      );
    const directory = await realpath(input.directory);
    const command = await realpath(input.command);
    if (!(await stat(directory)).isDirectory() || !(await stat(command)).isFile())
      return fail('check-input', 'The isolated directory or trusted executable is unavailable.');
    const executable = findExecutable('codex', env);
    if (!executable)
      return fail(
        'sandbox-unavailable',
        'Install the optional Codex CLI to run the fixed sandboxed checker. No model login is needed for this check.',
      );
    temporary = await mkdtemp(join(tmpdir(), 'gitflash-check-runtime-'));
    const codexHome = join(temporary, '.codex');
    await mkdir(codexHome, { mode: 0o700 });
    const childEnv = runtimeEnvironment(env);
    childEnv.HOME = temporary;
    childEnv.USERPROFILE = temporary;
    childEnv.CODEX_HOME = codexHome;
    childEnv.TMPDIR = directory;
    childEnv.TMP = directory;
    childEnv.TEMP = directory;
    const probe = (args: string[]) =>
      executeProcess(executable, args, {
        env: childEnv,
        cwd: directory,
        signal: input.signal,
        timeoutMs: Math.min(5000, remaining()),
        maxBytes: 64_000,
      });
    const help = await probe(['sandbox', '--help']);
    for (const flag of ['--permissions-profile', '--include-managed-config', '--cd', '--config']) {
      if (help.code !== 0 || !help.stdout.includes(flag))
        return fail(
          'sandbox-unavailable',
          `Your Codex CLI lacks sandbox ${flag}. Upgrade it before running the fixed check.`,
        );
    }
    const version = await probe(['--version']);
    const label = version.stdout.trim();
    if (version.code !== 0 || !/^codex-cli \d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(label))
      return fail(
        'sandbox-unavailable',
        'Unable to identify the Codex sandbox version. No check was run.',
      );
    runtimeVersion = label;
    // Reuse the already-resolved Python runtime. A second Node launcher would
    // require Homebrew dylib/opt-symlink read grants unrelated to the fixed oracle.
    const nonce = randomUUID();
    const filesystem: Record<string, string> = {
      ':minimal': 'read',
      ':workspace_roots': 'write',
      [dirname(command)]: 'read',
    };
    const filesystemToml = `{${Object.entries(filesystem)
      .map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`)
      .join(',')}}`;
    const run = await executeProcess(
      executable,
      [
        'sandbox',
        '--permissions-profile',
        'gitflash-check',
        '--include-managed-config',
        '--cd',
        directory,
        '-c',
        `permissions.gitflash-check={filesystem=${filesystemToml},network={enabled=false}}`,
        '--',
        command,
        '-I',
        '-B',
        '-c',
        HARNESS,
        command,
        JSON.stringify(input.args),
        nonce,
      ],
      { env: childEnv, cwd: directory, signal: input.signal, timeoutMs: remaining(), maxBytes },
    );
    let receipt: Record<string, unknown>;
    try {
      receipt = JSON.parse(run.stdout) as Record<string, unknown>;
    } catch {
      return fail('check-not-run', startupFailure(run.code, run.stderr));
    }
    if (
      run.code !== 0 ||
      receipt?.format !== 'gitflash-check-receipt' ||
      receipt.version !== 1 ||
      receipt.nonce !== nonce ||
      receipt.invoked !== true ||
      !Number.isSafeInteger(receipt.exitCode) ||
      Number(receipt.exitCode) < 0 ||
      typeof receipt.stdout !== 'string' ||
      typeof receipt.stderr !== 'string'
    )
      return fail(
        receipt?.nonce === nonce && receipt.error === 'output-limit'
          ? 'output-limit'
          : 'check-not-run',
        receipt?.nonce === nonce && receipt.error === 'python-version'
          ? 'The selected checker requires Python >=3.8. No check was run.'
          : receipt?.nonce === nonce && receipt.error === 'output-limit'
            ? 'The fixed checker exceeded its 512 KB output limit. No ordinary test result was recorded.'
            : 'The checker did not exit normally inside the sandbox. Verify the selected Python executable and check inputs. No ordinary test failure was recorded.',
      );
    return finish(
      'completed',
      Number(receipt.exitCode),
      `${receipt.stdout}${receipt.stdout && receipt.stderr ? '\n' : ''}${receipt.stderr}`,
    );
  } catch (error) {
    const safe =
      error instanceof IntegrationError
        ? error.code === 'runtime-unavailable'
          ? {
              code: 'check-not-run',
              message:
                'Unable to start the sandboxed checker. Verify Codex and the selected trusted Python executable. No check was run.',
            }
          : { code: error.code, message: error.message }
        : {
            code: 'check-not-run',
            message:
              'Unable to run the fixed checker. Verify the isolated directory, trusted executable and Codex sandbox.',
          };
    return finish(safe.code === 'cancelled' ? 'cancelled' : 'failed', null, '', safe);
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}
