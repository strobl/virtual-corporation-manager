import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceStore } from '../src/domain/contracts.js';
import type { RunInfo } from '../src/adapters/types.js';

type Handler = (...values: any[]) => void;
const fixtures = vi.hoisted(() => ({ sockets: [] as Array<{ emit: (event: string, payload?: unknown) => void }>, posted: [] as unknown[], authCalls: 0,
  loggers: [] as Array<{ error: (...message: unknown[]) => void; warn: (...message: unknown[]) => void }> }));
vi.mock('@slack/web-api', () => ({ WebClient: class {
  constructor(_token: string, options: { logger: typeof fixtures.loggers[number] }) { fixtures.loggers.push(options.logger); }
  auth = { test: async () => { fixtures.authCalls++; return { ok: true, team_id: 'TTEST', user_id: 'UBOT', bot_id: 'BBOT' }; } };
  chat = { postMessage: async (message: unknown) => { fixtures.posted.push(message); return { ok: true, ts: '1.2' }; } };
} }));
vi.mock('@slack/socket-mode', () => ({ SocketModeClient: class {
  handlers = new Map<string, Handler[]>();
  constructor(options: { logger: typeof fixtures.loggers[number] }) { fixtures.sockets.push(this); fixtures.loggers.push(options.logger); }
  on(event: string, handler: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]); }
  emit(event: string, payload?: unknown) { for (const handler of this.handlers.get(event) ?? []) handler(payload); }
  async start() { this.emit('connected'); }
  async disconnect() { this.emit('disconnected'); }
  removeAllListeners() { this.handlers.clear(); }
} }));
import { SlackConnection } from '../src/adapters/slack.js';

const env = { SLACK_APP_TOKEN: 'xapp-test', SLACK_BOT_TOKEN: 'xoxb-test', GITFLASH_SLACK_CHANNEL_ID: 'CTEST', GITFLASH_SLACK_OWNER_ID: 'UOWNER' };
const store = { snapshot: () => ({ agents: [{ id: 'agent-1', name: 'Analyst', role: 'Product Analyst', kind: 'agent', status: 'active' }] }) } as unknown as WorkspaceStore;
beforeEach(() => { fixtures.sockets.length = 0; fixtures.posted.length = 0; fixtures.authCalls = 0; fixtures.loggers.length = 0; });
function event(overrides: Record<string, unknown> = {}) {
  return { event: { type: 'app_mention', user: 'UOWNER', channel: 'CTEST', text: '<@UBOT> Analyst: Review the release scope', ts: '10.2', ...overrides }, body: { team_id: 'TTEST', event_id: 'ETEST' }, ack: vi.fn(async () => {}) };
}
async function tick() { await new Promise(resolve => setTimeout(resolve, 0)); }

describe('Slack contract fixtures (not a live workspace acceptance)', () => {
  it('suppresses provider SDK logs that may include private diagnostics', async () => {
    const connection = new SlackConnection(store, env, vi.fn());
    const error = vi.spyOn(console, 'error').mockImplementation(() => {}); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await connection.connect(); expect(fixtures.loggers).toHaveLength(2);
      for (const logger of fixtures.loggers) { logger.error('private-provider-diagnostic'); logger.warn('private-provider-diagnostic'); }
      expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
    } finally { await connection.disconnect(); error.mockRestore(); warn.mockRestore(); }
  });
  it('connects only explicitly and rejects other senders, channels and bot traffic', async () => {
    const queue = vi.fn(async () => ({}) as RunInfo); const connection = new SlackConnection(store, env, queue);
    expect(connection.status()).toBe('configured'); expect(fixtures.authCalls).toBe(0);
    await connection.connect(); expect(connection.status()).toBe('connected');
    for (const denied of [{ user: 'UOTHER' }, { channel: 'COTHER' }, { bot_id: 'BOT' }]) fixtures.sockets[0]!.emit('events_api', event(denied));
    await tick(); expect(queue).not.toHaveBeenCalled(); expect(fixtures.posted).toHaveLength(0); await connection.disconnect();
  });
  it('routes a permitted mention to the named role with a durable event request key', async () => {
    const queue = vi.fn(async () => ({}) as RunInfo); const connection = new SlackConnection(store, env, queue); await connection.connect();
    const envelope = event(); fixtures.sockets[0]!.emit('events_api', envelope); await tick();
    expect(envelope.ack).toHaveBeenCalledOnce(); expect(queue).toHaveBeenCalledWith(
      { agentId: 'agent-1', task: 'Review the release scope', requestId: 'slack:TTEST:ETEST', transport: 'codex' },
      { teamId: 'TTEST', channel: 'CTEST', threadTs: '10.2' });
    await connection.disconnect();
  });
  it('returns setup guidance for an ambiguous request and delivers a result only to its configured workspace/channel', async () => {
    const queue = vi.fn(async () => ({}) as RunInfo); const connection = new SlackConnection(store, env, queue); await connection.connect();
    fixtures.sockets[0]!.emit('events_api', event({ text: '<@UBOT> Unknown role: do work' })); await tick();
    expect(queue).not.toHaveBeenCalled(); expect(fixtures.posted).toHaveLength(1);
    const run = { id: 'run-1', agentName: 'Analyst', status: 'completed', output: 'A completed deliverable' } as RunInfo;
    expect(await connection.deliver(run, { teamId: 'TOTHER', channel: 'CTEST', threadTs: '10.2' })).toMatchObject({ status: 'failed' });
    expect(await connection.deliver(run, { teamId: 'TTEST', channel: 'CTEST', threadTs: '10.2' })).toEqual({ status: 'sent', reference: 'slack:TTEST:CTEST:1.2' });
    expect(fixtures.posted).toHaveLength(2); await connection.disconnect();
  });
});
