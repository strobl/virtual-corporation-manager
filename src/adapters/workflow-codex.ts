import { writeFileSync } from 'node:fs';
import { lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { executeProcess, findExecutable, runtimeEnvironment } from './process.js';
import { IntegrationError } from './types.js';

export interface WorkflowCodexInput {
  /** Existing isolated stage directory, prepared and inspected by the workflow service. */
  directory: string;
  /** Complete stage instructions. No command-line arguments are accepted from the task. */
  prompt: string;
  signal?: AbortSignal;
  /** Synchronous persistence hook after the adapter exclusively saves the observed session. */
  onSession?: (identity: WorkflowExecutionIdentity) => void;
}
export interface WorkflowCommandEvidence {
  id: string;
  command: string;
  status: 'in_progress' | 'completed' | 'failed';
  exitCode: number | null;
  output: string;
  observedAt: string;
}
export interface WorkflowCodexResult {
  status: 'completed' | 'failed' | 'cancelled';
  output: string;
  sessionId: string | null;
  runtimeVersion: string | null;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  commands: WorkflowCommandEvidence[];
  error?: { code: string; message: string };
}
export interface WorkflowCodexOptions {
  /** Entire invocation, including local capability probes; maximum 15 minutes. */
  timeoutMs?: number;
  /** Combined stdout/stderr transport limit; maximum 4 MB. */
  maxBytes?: number;
}
export const WORKFLOW_EXECUTION_FILE = 'WORKFLOW-EXECUTION.json';
/** Adapter-authored observation, never a model-created deliverable or owner approval. */
export interface WorkflowExecutionIdentity {
  format: 'gitflash-observed-runtime-session';
  sessionId: string;
  runtimeVersion: string;
  observedAt: string;
}

// Verified with codex-cli 0.138.0 help and effective feature listing. Unsupported
// versions fail closed before any model request; no full-auto or bypass fallback.
const DISABLED_FEATURES = [
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
] as const;
const fail = (code: string, message: string): never => {
  throw new IntegrationError(code, message);
};
const protocol = (): never =>
  fail(
    'runtime-protocol',
    'Codex returned an unsupported workflow event. Check the installed CLI version.',
  );
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return protocol();
  return value as Record<string, unknown>;
};
function boundedText(value: unknown, max: number): string {
  if (typeof value !== 'string') return protocol();
  if (Buffer.byteLength(value) > max)
    return fail(
      'output-limit',
      'The workflow exceeded its evidence limit. Retry with a smaller stage.',
    );
  return value;
}

/** Runtime JSONL receipts, never parsed out of an agent's prose or JSON answer. */
export class WorkflowCodexCollector {
  output = '';
  sessionId: string | null = null;
  completed = false;
  failed = false;
  private readonly items = new Map<string, WorkflowCommandEvidence>();
  commands(): WorkflowCommandEvidence[] {
    return structuredClone([...this.items.values()]);
  }

  consume(line: string): void {
    if (!line.trim()) return;
    let event: Record<string, unknown>;
    try {
      event = record(JSON.parse(line));
    } catch {
      return protocol();
    }
    if (typeof event.type !== 'string') return protocol();
    if (event.type === 'thread.started') {
      const id = boundedText(event.thread_id, 160);
      if (!id || (this.sessionId !== null && this.sessionId !== id)) return protocol();
      this.sessionId = id;
    }
    if (event.type === 'turn.completed') this.completed = true;
    if (event.type === 'turn.failed' || event.type === 'error') this.failed = true;
    if (!['item.started', 'item.updated', 'item.completed'].includes(event.type)) return;
    const item = record(event.item);
    if (['mcp_tool_call', 'web_search', 'collab_tool_call'].includes(String(item.type))) {
      return fail(
        'runtime-policy',
        'An external or delegated tool appeared in this local-only workflow. The stage was stopped.',
      );
    }
    if (item.type === 'agent_message' && event.type === 'item.completed') {
      this.output = boundedText(item.text, 500_000);
    }
    if (item.type !== 'command_execution') return;
    const id = boundedText(item.id, 160);
    const command = boundedText(item.command, 32_000);
    if (!id || !command || !['in_progress', 'completed', 'failed'].includes(String(item.status)))
      return protocol();
    const previous = this.items.get(id);
    if (previous && previous.command !== command) return protocol();
    if (!previous && this.items.size >= 128)
      return fail(
        'output-limit',
        'The workflow exceeded its command evidence limit. Retry with a smaller stage.',
      );
    const ended = event.type === 'item.completed';
    if (ended && (item.status === 'in_progress' || !Number.isSafeInteger(item.exit_code)))
      return protocol();
    if (!ended && item.status !== 'in_progress') return protocol();
    if (previous && previous.status !== 'in_progress' && !ended) return protocol();
    const output =
      item.aggregated_output === undefined
        ? (previous?.output ?? '')
        : boundedText(item.aggregated_output, 128_000);
    this.items.set(id, {
      id,
      command,
      status: item.status as WorkflowCommandEvidence['status'],
      exitCode: ended ? Number(item.exit_code) : null,
      output,
      observedAt: new Date().toISOString(),
    });
  }
  successful(code: number): boolean {
    return (
      code === 0 &&
      !this.failed &&
      this.completed &&
      this.sessionId !== null &&
      this.output.trim().length > 0 &&
      [...this.items.values()].every((item) => item.status !== 'in_progress')
    );
  }
}

function settings(directory: string, env: NodeJS.ProcessEnv): string[] {
  const shellEnv: Record<string, string> = {
    HOME: join(directory, '.runtime', 'home'),
    USERPROFILE: join(directory, '.runtime', 'home'),
    TMPDIR: join(directory, '.runtime', 'tmp'),
    TMP: join(directory, '.runtime', 'tmp'),
    TEMP: join(directory, '.runtime', 'tmp'),
    // Git ignores a ceiling equal to its initial cwd. Include the parent to
    // prevent discovery there when the command starts exactly at the stage root.
    GIT_CEILING_DIRECTORIES: [directory, dirname(directory)].join(delimiter),
    GIT_CONFIG_NOSYSTEM: '1',
  };
  for (const key of ['PATH', 'LANG', 'LC_ALL', 'SYSTEMROOT', 'SystemRoot'])
    if (env[key]) shellEnv[key] = env[key]!;
  const tomlMap = `{${Object.entries(shellEnv)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(',')}}`;
  return [
    '-c',
    'sandbox_workspace_write.network_access=false',
    '-c',
    'sandbox_workspace_write.exclude_slash_tmp=true',
    '-c',
    'sandbox_workspace_write.exclude_tmpdir_env_var=true',
    '-c',
    'sandbox_workspace_write.writable_roots=[]',
    '-c',
    'web_search="disabled"',
    '-c',
    'shell_environment_policy.inherit="none"',
    '-c',
    'shell_environment_policy.experimental_use_profile=false',
    '-c',
    `shell_environment_policy.set=${tomlMap}`,
    ...DISABLED_FEATURES.flatMap((feature) => ['--disable', feature]),
  ];
}

/**
 * Writes are scoped to the stage directory; this is NOT read isolation from the
 * current OS user. The CLI retains its saved login and contacts its model provider.
 * Sandboxed command networking and external tool features are disabled separately.
 * Managed policies and execpolicy rules remain active. No credentials are copied.
 * Root must inspect real files and hashes: command events are CLI observations,
 * while final output is a model assertion and never establishes owner acceptance.
 * Sources: https://learn.chatgpt.com/docs/non-interactive-mode and
 * https://learn.chatgpt.com/docs/config-file/config-reference
 */
export async function executeWorkflowCodex(
  input: WorkflowCodexInput,
  env: NodeJS.ProcessEnv,
  options: WorkflowCodexOptions = {},
): Promise<WorkflowCodexResult> {
  const startedAt = new Date().toISOString();
  const collector = new WorkflowCodexCollector();
  let runtimeVersion: string | null = null;
  let exitCode: number | null = null;
  const result = (
    status: WorkflowCodexResult['status'],
    error?: WorkflowCodexResult['error'],
  ): WorkflowCodexResult => ({
    status,
    output: collector.output,
    sessionId: collector.sessionId,
    runtimeVersion,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    commands: collector.commands(),
    ...(error ? { error } : {}),
  });
  try {
    const timeoutMs = options.timeoutMs ?? 300_000;
    const maxBytes = options.maxBytes ?? 2_000_000;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 900_000 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1024 ||
      maxBytes > 4_000_000
    ) {
      return fail(
        'runtime-input',
        'Workflow timeout or output limit is outside the supported range.',
      );
    }
    const deadline = Date.now() + timeoutMs;
    const remaining = () => {
      if (input.signal?.aborted) return fail('cancelled', 'The workflow stage was cancelled.');
      const value = deadline - Date.now();
      if (value <= 0) return fail('timeout', 'The workflow stage exceeded its time limit.');
      return value;
    };
    remaining();
    if (
      typeof input.directory !== 'string' ||
      !isAbsolute(input.directory) ||
      typeof input.prompt !== 'string' ||
      !input.prompt.trim() ||
      Buffer.byteLength(input.prompt) > 500_000
    ) {
      return fail(
        'runtime-input',
        'Provide an absolute isolated stage directory and bounded nonempty instructions.',
      );
    }
    const directory = await realpath(input.directory);
    if (!(await stat(directory)).isDirectory())
      return fail('runtime-input', 'The workflow stage directory does not exist.');
    const executionFile = join(directory, WORKFLOW_EXECUTION_FILE);
    try {
      await lstat(executionFile);
      return fail(
        'runtime-evidence',
        'The reserved WORKFLOW-EXECUTION.json already exists. Start this stage in a fresh directory.',
      );
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        return fail(
          'runtime-evidence',
          'Unable to inspect the reserved execution identity file. Start this stage in a fresh directory.',
        );
    }
    const executable = findExecutable('codex', env);
    if (!executable)
      return fail(
        'runtime-unavailable',
        'Install the optional Codex CLI and run codex login before starting a workflow.',
      );
    const runtimeDirectory = join(directory, '.runtime');
    const runtimeTmp = join(runtimeDirectory, 'tmp');
    try {
      // Reserve the subtree exclusively; existing paths or symlinks must not
      // redirect temporary writes into deliverables or outside this stage.
      await mkdir(runtimeDirectory, { mode: 0o700 });
      await mkdir(join(runtimeDirectory, 'home'), { mode: 0o700 });
      await mkdir(runtimeTmp, { mode: 0o700 });
    } catch {
      return fail(
        'runtime-evidence',
        'Unable to create a fresh reserved .runtime directory. Start this stage in a fresh directory.',
      );
    }
    // Preserve the CLI's saved authentication HOME/CODEX_HOME. Its own temporary
    // files and model shell caches belong in the reserved runtime subtree.
    const childEnv = {
      ...runtimeEnvironment(env),
      TMPDIR: runtimeTmp,
      TMP: runtimeTmp,
      TEMP: runtimeTmp,
    };
    const probe = (args: string[]) =>
      executeProcess(executable, args, {
        env: childEnv,
        cwd: directory,
        signal: input.signal,
        timeoutMs: Math.min(5000, remaining()),
        maxBytes: 64_000,
      });
    const help = await probe(['exec', '--help']);
    for (const flag of [
      '--json',
      '--ephemeral',
      '--ignore-user-config',
      '--sandbox',
      '--skip-git-repo-check',
      '--strict-config',
      '--cd',
      '--disable',
    ]) {
      if (help.code !== 0 || !help.stdout.includes(flag))
        return fail(
          'runtime-version',
          `Your Codex CLI does not support ${flag}. Upgrade before starting a workflow.`,
        );
    }
    const globalHelp = await probe(['--help']);
    if (globalHelp.code !== 0 || !globalHelp.stdout.includes('--ask-for-approval'))
      return fail(
        'runtime-version',
        'Your Codex CLI cannot enforce the required approval policy. Upgrade before starting a workflow.',
      );
    const configuration = settings(directory, childEnv);
    const features = await probe([...configuration, 'features', 'list']);
    for (const feature of DISABLED_FEATURES) {
      if (
        features.code !== 0 ||
        !new RegExp(`^${feature}\\s+.+\\s+false\\s*$`, 'm').test(features.stdout)
      )
        return fail(
          'runtime-version',
          `Your Codex CLI cannot disable ${feature}. Upgrade before starting this local workflow.`,
        );
    }
    const version = await probe(['--version']);
    const label = version.stdout.trim();
    if (version.code !== 0 || !/^codex-cli \d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(label))
      return fail(
        'runtime-version',
        'Unable to identify the Codex CLI version. Verify the configured executable.',
      );
    runtimeVersion = label;
    const run = await executeProcess(
      executable,
      [
        '--ask-for-approval',
        'never',
        'exec',
        '--strict-config',
        '--json',
        '--ephemeral',
        '--ignore-user-config',
        '--sandbox',
        'workspace-write',
        '--skip-git-repo-check',
        '--cd',
        directory,
        ...configuration,
        '-',
      ],
      {
        cwd: directory,
        env: childEnv,
        signal: input.signal,
        timeoutMs: remaining(),
        maxBytes,
        input: [
          'Execute this one Product Studio stage in the current isolated directory. Produce requested files as real files, not JSON strings to be materialized by another person.',
          'Use only supplied local inputs. Do not access unrelated directories, credentials, external connectors, browser tools or network services. Do not install dependencies or contact people. If blocked, report the actual limitation.',
          'Run the requested checks when feasible and report their observed outcomes accurately. A failed or unrun check is not a pass. Do not claim human acceptance or book delivery hours.',
          'Before making any claim about your own execution identity, read WORKFLOW-EXECUTION.json in this directory. The adapter writes it from your actual CLI thread.started event. Use its sessionId as your executing session, not a previous role session or the workflow stage UUID. This file is adapter-authored evidence: do not create, change, delete or claim authorship of it. If it is unavailable, report the identity as unverified.',
          input.prompt,
        ].join('\n\n'),
        onLine: (line) => {
          const previousSession = collector.sessionId;
          collector.consume(line);
          if (previousSession === null && collector.sessionId !== null) {
            const identity: WorkflowExecutionIdentity = {
              format: 'gitflash-observed-runtime-session',
              sessionId: collector.sessionId,
              runtimeVersion: label,
              observedAt: new Date().toISOString(),
            };
            try {
              // Synchronous and exclusive: subsequent events cannot overtake this
              // observation, and an existing file/symlink is never overwritten.
              writeFileSync(executionFile, JSON.stringify(identity, null, 2) + '\n', {
                flag: 'wx',
                mode: 0o400,
              });
            } catch {
              return fail(
                'runtime-evidence',
                'Unable to create the reserved execution identity file without overwriting data. The stage was stopped.',
              );
            }
            try {
              input.onSession?.(identity);
            } catch {
              return fail(
                'runtime-evidence',
                'Unable to persist the observed execution identity. The stage was stopped; its identity file was retained.',
              );
            }
          }
        },
      },
    );
    exitCode = run.code;
    if (!collector.successful(run.code))
      return result('failed', {
        code: 'runtime-failed',
        message:
          'Codex did not complete this workflow stage. Inspect the recorded command evidence and check CLI login or usage allowance before retrying.',
      });
    return result('completed');
  } catch (error) {
    // Provider stderr and raw exception messages can contain task data or secrets.
    // Only adapter-owned IntegrationError messages are exposed to the caller.
    const safe =
      error instanceof IntegrationError
        ? { code: error.code, message: error.message }
        : {
            code: 'runtime-failed',
            message:
              'The workflow runtime could not complete the stage. Verify the isolated directory and CLI setup.',
          };
    return result(safe.code === 'cancelled' ? 'cancelled' : 'failed', safe);
  }
}
