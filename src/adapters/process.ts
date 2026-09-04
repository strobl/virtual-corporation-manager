import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';
import { IntegrationError } from './types.js';

export function findExecutable(name: 'codex' | 'buzz', env: NodeJS.ProcessEnv): string | null {
  const override = env[name === 'codex' ? 'GITFLASH_CODEX_PATH' : 'GITFLASH_BUZZ_PATH'];
  const candidates = override
    ? [override]
    : [
        ...(env.PATH ?? '')
          .split(delimiter)
          .filter(Boolean)
          .map((directory) => join(directory, process.platform === 'win32' ? `${name}.exe` : name)),
        ...(name === 'buzz' && process.platform === 'darwin'
          ? ['/Applications/Buzz.app/Contents/MacOS/buzz']
          : []),
      ];
  for (const candidate of candidates) {
    if (!isAbsolute(candidate)) continue;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* Probe the next supported location. */
    }
  }
  return null;
}

/** Do not inherit unrelated app connectors, cloud credentials or execution hooks. */
export function runtimeEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of [
    'HOME',
    'USERPROFILE',
    'PATH',
    'TMPDIR',
    'TEMP',
    'TMP',
    'SYSTEMROOT',
    'SystemRoot',
    'LANG',
    'LC_ALL',
    'CODEX_HOME',
  ]) {
    if (env[key]) result[key] = env[key];
  }
  result.NO_COLOR = '1';
  return result;
}

export interface ProcessOptions {
  cwd?: string;
  env: NodeJS.ProcessEnv;
  input?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  onLine?: (line: string) => void;
}
export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}
export function executeProcess(
  executable: string,
  args: string[],
  options: ProcessOptions,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new IntegrationError('cancelled', 'The task was cancelled.'));
      return;
    }
    let stdout = '';
    let stderr = '';
    let buffer = '';
    let bytes = 0;
    let failure: Error | null = null;
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        /* Already exited. */
      }
    };
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 1500);
      killTimer.unref();
    };
    const abort = () => stop(new IntegrationError('cancelled', 'The task was cancelled.'));
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () =>
        stop(
          new IntegrationError(
            'timeout',
            'The runtime exceeded the task time limit. Retry with a smaller task.',
          ),
        ),
      options.timeoutMs ?? 300_000,
    );
    timer.unref();
    const consume = (chunk: string, output: boolean) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > (options.maxBytes ?? 2_000_000)) {
        stop(
          new IntegrationError(
            'output-limit',
            'The runtime exceeded its output limit. Retry with a smaller task.',
          ),
        );
        return;
      }
      const text = chunk;
      if (output) {
        stdout += text;
        if (options.onLine) {
          buffer += text;
          let end: number;
          while ((end = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, end);
            buffer = buffer.slice(end + 1);
            try {
              options.onLine(line);
            } catch (error) {
              stop(error instanceof Error ? error : new Error(String(error)));
            }
          }
        }
      } else stderr += text;
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => consume(chunk, true));
    child.stderr.on('data', (chunk: string) => consume(chunk, false));
    child.stdin.on('error', () => {
      /* Early process exits are reported by close. */
    });
    child.on('error', () => {
      failure = new IntegrationError(
        'runtime-unavailable',
        'Unable to start the runtime. Verify that its configured executable exists and is runnable.',
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      options.signal?.removeEventListener('abort', abort);
      if (failure) {
        reject(failure);
        return;
      }
      if (buffer && options.onLine) {
        try {
          options.onLine(buffer);
        } catch (error) {
          reject(error);
          return;
        }
      }
      resolve({ code: code ?? -1, stdout, stderr });
    });
    child.stdin.end(options.input ?? '');
  });
}
