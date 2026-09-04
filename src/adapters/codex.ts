import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { executeProcess, findExecutable, runtimeEnvironment } from './process.js';
import { IntegrationError, type ExecutionInput, type ExecutionResult, type IntegrationStatus } from './types.js';

export class CodexEventCollector {
  output = ''; sessionId: string | null = null; completed = false; failed = false;
  consume(line: string) {
    if (!line.trim()) return;
    let event: Record<string, unknown>;
    try { event = JSON.parse(line); } catch { throw new IntegrationError('runtime-protocol', 'Codex returned an invalid event stream. Verify your CLI version.'); }
    if (event.type === 'thread.started' && typeof event.thread_id === 'string') this.sessionId = event.thread_id;
    if (event.type === 'turn.completed') this.completed = true;
    if (event.type === 'turn.failed' || event.type === 'error') this.failed = true;
    if (event.type === 'item.completed' && event.item && typeof event.item === 'object') {
      const item = event.item as Record<string, unknown>;
      if (item.type === 'agent_message' && typeof item.text === 'string') this.output = item.text;
    }
  }
  result(code: number): ExecutionResult {
    if (code !== 0 || this.failed || !this.completed || !this.output.trim()) {
      throw new IntegrationError('runtime-failed', 'Codex did not return a successful task result. Check your CLI login and usage allowance, then retry.');
    }
    return { output: this.output, sessionId: this.sessionId, runtimeVersion: null };
  }
}

export async function codexStatus(env: NodeJS.ProcessEnv): Promise<IntegrationStatus['codex']> {
  const executable = findExecutable('codex', env);
  if (!executable) return { available: false, authenticated: false, state: 'unavailable', message: 'Install the optional Codex CLI and run codex login. Company setup works without it.' };
  try {
    const login = await executeProcess(executable, ['login', 'status'], { env: runtimeEnvironment(env), timeoutMs: 5000, maxBytes: 32_000 });
    const authenticated = login.code === 0 && /logged in/i.test(`${login.stdout}\n${login.stderr}`);
    return { available: true, authenticated, state: authenticated ? 'ready' : 'authentication-required',
      message: authenticated ? 'Codex CLI is installed and reports a saved login. A task will use your existing runtime allowance.' : 'Run codex login in your terminal, then refresh. No model request has been made.' };
  } catch { return { available: true, authenticated: false, state: 'authentication-required', message: 'Unable to confirm the CLI login. Run codex login status in your terminal.' }; }
}

export async function executeCodex(input: ExecutionInput, env: NodeJS.ProcessEnv, timeoutMs = 300_000): Promise<ExecutionResult> {
  const executable = findExecutable('codex', env);
  if (!executable) throw new IntegrationError('runtime-unavailable', 'Codex CLI was not found. Install it and run codex login before starting a task.');
  const childEnv = runtimeEnvironment(env);
  const help = await executeProcess(executable, ['exec', '--help'], { env: childEnv, timeoutMs: 5000, signal: input.signal });
  for (const flag of ['--json', '--ephemeral', '--ignore-user-config', '--sandbox', '--skip-git-repo-check']) {
    if (help.code !== 0 || !help.stdout.includes(flag)) throw new IntegrationError('runtime-version', `Your Codex CLI does not support ${flag}. Upgrade it before running GitFlash tasks.`);
  }
  const version = await executeProcess(executable, ['--version'], { env: childEnv, timeoutMs: 5000, signal: input.signal });
  const context = {
    company: input.company, agent: input.agent,
    colleagues: input.state.agents.filter(agent => input.state.assignments.some(assignment => assignment.agentId === agent.id && assignment.companyId === input.company.id && !assignment.endedAt)).map(agent => ({ id: agent.id, name: agent.name, role: agent.role, responsibilities: agent.responsibilities })),
    priorWork: input.state.work.filter(work => work.companyId === input.company.id && work.status !== 'failed').slice(-5).map(work => ({ title: work.title, agentId: work.agentId, output: work.output.slice(0, 20_000), status: work.status })),
  };
  await writeFile(join(input.directory, 'company-context.json'), JSON.stringify(context, null, 2), { mode: 0o600 });
  const prompt = [
    `You are ${input.agent.name}, ${input.agent.role}, working for ${input.company.name}.`,
    'Produce the actual requested deliverable. Work only with the task and supplied company-context.json in this directory.',
    'Do not contact people, use external connectors, change files, or access unrelated directories. If evidence is missing, identify that limitation.',
    'Return the complete usable result in your final message. Distinguish facts from assumptions and human decisions from completed work.',
    `Role instructions:\n${input.agent.instructions}`, `Responsibilities:\n${input.agent.responsibilities.join('\n')}`,
    `Task ID: ${input.run.id}\nTask:\n${input.run.task}`,
  ].join('\n\n');
  const collector = new CodexEventCollector();
  const result = await executeProcess(executable, ['exec', '--json', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only', '--skip-git-repo-check', '-'], {
    cwd: input.directory, env: childEnv, input: prompt, signal: input.signal, timeoutMs, onLine: line => collector.consume(line),
  });
  const output = collector.result(result.code);
  const versionLabel = version.stdout.trim();
  output.runtimeVersion = version.code === 0 && /^codex-cli \d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(versionLabel) ? versionLabel : null;
  return output;
}
