import type { Agent, Company, WorkspaceState } from '../domain/contracts.js';

export interface RunRequest { agentId: string; task: string; requestId: string; transport?: 'codex' | 'buzz' }
export interface RunInfo {
  id: string; requestId: string; agentId: string; agentName: string; companyId: string; task: string;
  transport: 'codex' | 'buzz'; status: 'queued' | 'running' | 'completed' | 'failed'; output: string; error: string | null;
  createdAt: string; startedAt: string | null; completedAt: string | null; durationMs: number | null;
  outputSha256: string | null; deliveryStatus: 'none' | 'pending' | 'sent' | 'uncertain' | 'failed';
  runtimeVersion: string | null; sessionId: string | null; deliveryReference: string | null;
}
export interface IntegrationStatus {
  codex: { available: boolean; authenticated: boolean; state: 'unavailable' | 'authentication-required' | 'ready'; message: string };
  buzz: { available: boolean; state: 'not-configured' | 'configured'; message: string };
  slack: { state: 'not-configured' | 'configured' | 'connected'; message: string };
  activeRuns: number; queuedRuns: number; costNotice: string;
}
export interface ExecutionInput { run: RunInfo; agent: Agent; company: Company; state: WorkspaceState; directory: string; signal: AbortSignal; onDispatch?: (reference: string) => void }
export interface ExecutionResult { output: string; runtimeVersion: string | null; sessionId: string | null }
/** Dependency injection is for host code/tests, never populated from HTTP request input. */
export interface IntegrationServiceOptions {
  env?: NodeJS.ProcessEnv;
  executeCodex?: (input: ExecutionInput) => Promise<ExecutionResult>;
  executeBuzz?: (input: ExecutionInput) => Promise<ExecutionResult>;
  timeoutMs?: number;
}
export class IntegrationError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'IntegrationError'; }
}

export function redactError(value: unknown, env: NodeJS.ProcessEnv = process.env): string {
  let message = value instanceof Error ? value.message : String(value);
  for (const [key, secret] of Object.entries(env)) {
    if (/(?:TOKEN|KEY|SECRET|PASSWORD|AUTH_TAG)/i.test(key) && secret && secret.length >= 6) message = message.split(secret).join('[redacted]');
  }
  return message.replace(/(?:xox[baprs]-|xapp-|sk-[A-Za-z0-9_-]*|nsec1)[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]').slice(0, 1000);
}
