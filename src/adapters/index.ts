import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Agent, Company, WorkspaceState, WorkspaceStore } from '../domain/contracts.js';
import { buzzStatus, executeBuzz, exportBuzzTeam } from './buzz.js';
import { codexStatus, executeCodex } from './codex.js';
import { SlackConnection, type SlackOrigin } from './slack.js';
import { IntegrationError, redactError, type IntegrationServiceOptions, type IntegrationStatus, type RunInfo, type RunRequest } from './types.js';
export type { RunInfo, RunRequest, IntegrationStatus, IntegrationServiceOptions } from './types.js';
export { IntegrationError } from './types.js';
export { exportBuzzTeam, validateBuzzTeam, type BuzzTeamSnapshot } from './buzz.js';

interface RunContext { agent: Agent; company: Company; state: WorkspaceState; origin: SlackOrigin | null }
interface RunRow { id: string; info: string; context: string }

export function createIntegrationService(store: WorkspaceStore, dataDir: string, options: IntegrationServiceOptions = {}) {
  const env = options.env ?? process.env;
  const root = resolve(dataDir); mkdirSync(root, { recursive: true, mode: 0o700 });
  const dbFile = join(root, 'workspace.sqlite');
  const db = new DatabaseSync(dbFile);
  try { db.exec('PRAGMA busy_timeout = 5000;'); db.prepare('SELECT id, request_id, info, context FROM integration_runs LIMIT 0').all(); }
  catch { db.close(); throw new IntegrationError('schema-version', 'Initialize the workspace with a compatible GitFlash release before starting integrations.'); }
  let closed = false; let active: AbortController | null = null; let pumping: Promise<void> | null = null;
  let statusCache: { value: IntegrationStatus['codex']; checkedAt: number } | null = null;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 300_000, 1000), 900_000);
  const readRows = () => db.prepare('SELECT id, info, context FROM integration_runs ORDER BY rowid').all() as unknown as RunRow[];
  const save = (run: RunInfo) => db.prepare('UPDATE integration_runs SET info = ? WHERE id = ?').run(JSON.stringify(run), run.id);
  const getRun = (id: string): RunInfo | undefined => {
    const row = db.prepare('SELECT info FROM integration_runs WHERE id = ?').get(id) as { info: string } | undefined;
    return row ? JSON.parse(row.info) as RunInfo : undefined;
  };
  const runs = (): RunInfo[] => readRows().map(row => JSON.parse(row.info) as RunInfo).reverse();

  // Do not repeat an interrupted external/model operation after restart.
  // A completed work record closes a crash window between task and work updates safely.
  try {
    // Parse every row before changing recovery states, so malformed content fails without a partial recovery.
    const rows = readRows().map(row => {
      const run = JSON.parse(row.info) as RunInfo; const context = JSON.parse(row.context) as RunContext;
      if (!run || typeof run !== 'object' || run.id !== row.id || !['queued', 'running', 'completed', 'failed'].includes(run.status) || !context || typeof context !== 'object') {
        throw new IntegrationError('invalid-ledger', 'The task ledger contains invalid records. Restore a validated workspace backup.');
      }
      return run;
    });
    for (const run of rows) {
      if (run.status !== 'running' && run.status !== 'queued') continue;
      const existingWork = store.snapshot().work.find(work => work.runId === run.id && work.status !== 'failed');
      if (existingWork) {
        run.status = 'completed'; run.output = existingWork.output; run.completedAt = existingWork.createdAt;
        run.outputSha256 = createHash('sha256').update(existingWork.output).digest('hex');
      } else {
        run.status = 'failed'; run.error = 'GitFlash stopped before this task completed. Review any external activity before starting a new request.'; run.completedAt = new Date().toISOString();
      }
      save(run);
    }
  } catch { db.close(); throw new IntegrationError('invalid-ledger', 'The task ledger could not be read safely. Restore a validated workspace backup.'); }

  const slack = new SlackConnection(store, env, (request, origin) => enqueue(request, origin));
  async function deliverToSlack(run: RunInfo, origin: SlackOrigin) {
    if (slack.status() !== 'connected') return;
    // Persist send intent before crossing the network boundary. A crash cannot cause auto-repost.
    run.deliveryStatus = 'uncertain'; save(run);
    const delivery = await slack.deliver(run, origin);
    run.deliveryStatus = delivery.status; run.deliveryReference = delivery.reference; save(run);
  }

  function recordWork(run: RunInfo, origin: SlackOrigin | null) {
    if (store.snapshot().work.some(work => work.runId === run.id)) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const preview = store.preview([{ type: 'work.record', input: {
          companyId: run.companyId, agentId: run.agentId, title: run.task.slice(0, 160), output: run.output,
          provenance: origin ? 'slack' : run.transport, status: 'submitted', durationMs: run.durationMs, runId: run.id,
        } }], store.snapshot().revision, `Record ${run.agentName}'s completed task`);
        store.apply(preview.id); return;
      } catch (error) { if (attempt === 2) throw error; }
    }
  }

  async function processQueue() {
    while (!closed) {
      const row = readRows().find(item => (JSON.parse(item.info) as RunInfo).status === 'queued');
      if (!row) return;
      const run = JSON.parse(row.info) as RunInfo; const context = JSON.parse(row.context) as RunContext;
      run.status = 'running'; run.startedAt = new Date().toISOString(); save(run);
      active = new AbortController(); const controller = active;
      const deadline = setTimeout(() => controller.abort(), timeoutMs + 10_000); deadline.unref();
      try {
        const directory = join(root, 'runs', run.id); await mkdir(directory, { recursive: true, mode: 0o700 });
        const input = { run, ...context, directory, signal: controller.signal, onDispatch: (reference: string) => {
          run.deliveryReference = reference; run.deliveryStatus = 'sent'; save(run);
        } };
        const result = run.transport === 'buzz' ? await (options.executeBuzz ?? (value => executeBuzz(value, env, timeoutMs)))(input)
          : await (options.executeCodex ?? (value => executeCodex(value, env, timeoutMs)))(input);
        if (!result.output.trim() || Buffer.byteLength(result.output) > 1_000_000) throw new IntegrationError('invalid-result', 'The runtime returned an empty or oversized result.');
        run.output = result.output; run.outputSha256 = createHash('sha256').update(result.output).digest('hex');
        run.runtimeVersion = result.runtimeVersion; run.sessionId = result.sessionId;
        run.durationMs = Date.now() - Date.parse(run.startedAt);
        await writeFile(join(directory, 'result.md'), result.output, { mode: 0o600 });
        recordWork(run, context.origin);
        run.status = 'completed';
      } catch (error) {
        run.status = 'failed'; run.error = redactError(error, env);
        if (error instanceof IntegrationError && error.code === 'delivery-uncertain') run.deliveryStatus = 'uncertain';
      } finally {
        clearTimeout(deadline); active = null;
        run.completedAt = new Date().toISOString(); run.durationMs = Date.now() - Date.parse(run.startedAt);
        save(run);
      }
      if (context.origin && !closed) await deliverToSlack(run, context.origin);
    }
  }
  function pump() {
    if (pumping || closed) return;
    pumping = Promise.resolve().then(processQueue).finally(() => {
      pumping = null;
      if (!closed && runs().some(run => run.status === 'queued')) pump();
    });
  }

  async function enqueue(request: RunRequest, origin: SlackOrigin | null = null): Promise<RunInfo> {
    if (closed) throw new IntegrationError('closed', 'GitFlash is shutting down. Restart before submitting a task.');
    if (!request || typeof request.agentId !== 'string' || typeof request.task !== 'string' || !request.task.trim() || request.task.length > 30_000 ||
      typeof request.requestId !== 'string' || !/^[A-Za-z0-9:_-]{8,200}$/.test(request.requestId) || (request.transport && !['codex', 'buzz'].includes(request.transport))) {
      throw new IntegrationError('invalid-request', 'Provide an agent, a task up to 30,000 characters, and a unique request ID (8–200 letters, digits, colons, underscores or hyphens).');
    }
    const task = request.task.trim(); const transport = request.transport ?? 'codex';
    const prior = db.prepare('SELECT info, context FROM integration_runs WHERE request_id = ?').get(request.requestId) as { info: string; context: string } | undefined;
    if (prior) {
      const existing = JSON.parse(prior.info) as RunInfo; const existingContext = JSON.parse(prior.context) as RunContext;
      if (existing.agentId !== request.agentId || existing.task !== task || existing.transport !== transport || JSON.stringify(existingContext.origin) !== JSON.stringify(origin)) {
        throw new IntegrationError('request-conflict', 'This request ID already belongs to a different task. Generate a new request ID.');
      }
      return existing;
    }
    const state = store.snapshot(); const agent = state.agents.find(item => item.id === request.agentId && item.status === 'active' && item.kind === 'agent');
    if (!agent) throw new IntegrationError('agent-not-found', 'Select an active AI agent for this task.');
    const assignments = state.assignments.filter(item => item.agentId === agent.id && !item.endedAt);
    const assignment = assignments.find(item => item.isPrimary) ?? assignments[0];
    const company = state.companies.find(item => item.id === assignment?.companyId && item.status === 'active');
    if (!company) throw new IntegrationError('company-not-found', 'Assign the agent to an active company before starting work.');
    if (runs().filter(run => run.status === 'queued' || run.status === 'running').length >= 20) throw new IntegrationError('queue-full', 'The local task queue is full. Wait for a running task to finish.');
    const run: RunInfo = { id: randomUUID(), requestId: request.requestId, agentId: agent.id, agentName: agent.name, companyId: company.id, task, transport,
      status: 'queued', output: '', error: null, createdAt: new Date().toISOString(), startedAt: null, completedAt: null, durationMs: null,
      outputSha256: null, deliveryStatus: origin ? 'pending' : 'none', runtimeVersion: null, sessionId: null, deliveryReference: null };
    db.prepare('INSERT INTO integration_runs (id, request_id, info, context) VALUES (?, ?, ?, ?)')
      .run(run.id, run.requestId, JSON.stringify(run), JSON.stringify({ agent, company, state, origin } satisfies RunContext));
    pump(); return run;
  }

  return {
    async status(): Promise<IntegrationStatus> {
      if (!statusCache || Date.now() - statusCache.checkedAt > 15_000) statusCache = { value: await codexStatus(env), checkedAt: Date.now() };
      const all = runs(); return { codex: statusCache.value, buzz: buzzStatus(env),
        slack: { state: slack.status(), message: slack.status() === 'connected' ? 'Socket Mode is connected. Only the configured owner and channel can submit tasks.' : 'Slack requires an installed app, app/bot tokens, and a configured owner/channel. Connect explicitly to receive tasks.' },
        activeRuns: all.filter(run => run.status === 'running').length, queuedRuns: all.filter(run => run.status === 'queued').length,
        costNotice: 'GitFlash is free and company setup is local. Optional Codex, Buzz and Slack services require your own access; model execution can consume subscription allowances or API credits.' };
    },
    run: (request: RunRequest) => enqueue(request), runs, getRun,
    exportBuzzTeam: (companyId?: string) => exportBuzzTeam(store.snapshot(), companyId),
    async connectSlack() {
      await slack.connect();
      for (const row of readRows()) {
        const run = JSON.parse(row.info) as RunInfo; const context = JSON.parse(row.context) as RunContext;
        if (context.origin && run.deliveryStatus === 'pending' && ['completed', 'failed'].includes(run.status)) {
          await deliverToSlack(run, context.origin);
        }
      }
    },
    disconnectSlack: () => slack.disconnect(),
    async close() {
      if (closed) return;
      closed = true; active?.abort(); await slack.disconnect(); if (pumping) await pumping;
      for (const run of runs()) if (run.status === 'queued') { run.status = 'failed'; run.error = 'GitFlash stopped before this queued task started. Submit a new request to retry.'; run.completedAt = new Date().toISOString(); save(run); }
      db.close();
    },
  };
}
