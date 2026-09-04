import { SocketModeClient } from '@slack/socket-mode';
import { WebClient, type Logger, type LogLevel } from '@slack/web-api';
import type { WorkspaceStore } from '../domain/contracts.js';
import { IntegrationError, type RunInfo, type RunRequest } from './types.js';

export interface SlackOrigin {
  teamId: string;
  channel: string;
  threadTs: string;
}
type Enqueue = (request: RunRequest, origin: SlackOrigin) => Promise<RunInfo>;
// SDK diagnostics can contain remote response bodies. Report only GitFlash's fixed
// connection/delivery states, never provider payloads or tokens in terminal logs.
const privateLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  setLevel() {},
  setName() {},
  getLevel: () => 'error' as LogLevel,
};
interface SlackEventEnvelope {
  event: {
    type?: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
  };
  body: { team_id?: string; event_id?: string };
  ack: () => Promise<void>;
}
export function slackConfigured(env: NodeJS.ProcessEnv): boolean {
  return !!(
    env.SLACK_APP_TOKEN?.startsWith('xapp-') &&
    env.SLACK_BOT_TOKEN?.startsWith('xoxb-') &&
    /^[CG][A-Z0-9]+$/.test(env.GITFLASH_SLACK_CHANNEL_ID ?? '') &&
    /^[UW][A-Z0-9]+$/.test(env.GITFLASH_SLACK_OWNER_ID ?? '')
  );
}

export class SlackConnection {
  private socket: SocketModeClient | null = null;
  private web: WebClient | null = null;
  private teamId: string | null = null;
  private botUserId: string | null = null;
  private connected = false;
  private starting: Promise<void> | null = null;
  private nextMessageAt = 0;
  constructor(
    private store: WorkspaceStore,
    private env: NodeJS.ProcessEnv,
    private enqueue: Enqueue,
  ) {}
  status() {
    return this.connected
      ? ('connected' as const)
      : slackConfigured(this.env)
        ? ('configured' as const)
        : ('not-configured' as const);
  }
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.starting) return this.starting;
    if (!slackConfigured(this.env))
      throw new IntegrationError(
        'slack-not-configured',
        'Set the Slack app/bot tokens, channel ID and owner ID before explicitly connecting.',
      );
    this.starting = this.start();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }
  private async start() {
    const web = new WebClient(this.env.SLACK_BOT_TOKEN, {
      logger: privateLogger,
      retryConfig: { retries: 0 },
      rejectRateLimitedCalls: true,
      timeout: 15_000,
    });
    let identity;
    try {
      identity = await web.auth.test();
    } catch {
      throw new IntegrationError(
        'slack-auth',
        'Slack could not verify the bot token. Check its permissions and workspace access.',
      );
    }
    if (!identity.ok || !identity.team_id || !identity.user_id || !identity.bot_id)
      throw new IntegrationError(
        'slack-auth',
        'Slack did not confirm a workspace bot identity. Check the bot token.',
      );
    if (this.env.GITFLASH_SLACK_TEAM_ID && this.env.GITFLASH_SLACK_TEAM_ID !== identity.team_id)
      throw new IntegrationError(
        'slack-workspace',
        'The Slack token belongs to a different workspace.',
      );
    this.teamId = identity.team_id;
    this.botUserId = identity.user_id;
    this.web = web;
    const socket = new SocketModeClient({
      appToken: this.env.SLACK_APP_TOKEN!,
      logger: privateLogger,
      clientOptions: { retryConfig: { retries: 0 }, rejectRateLimitedCalls: true, timeout: 15_000 },
    });
    this.socket = socket;
    socket.on('connected', () => {
      if (this.socket === socket) this.connected = true;
    });
    socket.on('disconnected', () => {
      if (this.socket === socket) this.connected = false;
    });
    socket.on('error', () => {
      this.connected = false;
    });
    socket.on('events_api', (envelope: SlackEventEnvelope) => {
      void this.handle(envelope).catch(() => {
        /* Ignore malformed envelopes; no unvalidated task is accepted. */
      });
    });
    try {
      await socket.start();
    } catch {
      await this.disconnect();
      throw new IntegrationError(
        'slack-connection',
        'Slack Socket Mode could not connect. Check the app token and workspace settings.',
      );
    }
  }
  private async handle({ event, body, ack }: SlackEventEnvelope) {
    if (
      event.type !== 'app_mention' ||
      event.bot_id ||
      !event.channel ||
      event.user !== this.env.GITFLASH_SLACK_OWNER_ID ||
      event.channel !== this.env.GITFLASH_SLACK_CHANNEL_ID ||
      body.team_id !== this.teamId ||
      !body.event_id ||
      !event.ts ||
      !event.text ||
      !this.botUserId
    ) {
      try {
        await ack();
      } catch {
        /* Slack may redeliver ignored traffic. */
      }
      return;
    }
    const marker = `<@${this.botUserId}>`;
    if (!event.text.startsWith(marker)) {
      try {
        await ack();
      } catch {
        /* No task accepted. */
      }
      return;
    }
    const command = event.text.slice(marker.length).trim();
    const separator = command.indexOf(':');
    if (separator < 1) {
      try {
        await ack();
      } catch {
        return;
      }
      await this.explain(
        event.channel,
        event.thread_ts ?? event.ts,
        'Use @GitFlash Agent name: your task. Choose one active role from your local company.',
      );
      return;
    }
    const role = command.slice(0, separator).trim().toLocaleLowerCase();
    const task = command.slice(separator + 1).trim();
    const matches = this.store
      .snapshot()
      .agents.filter(
        (agent) =>
          agent.kind === 'agent' &&
          agent.status === 'active' &&
          [agent.name, agent.role, agent.id].some((value) => value.toLocaleLowerCase() === role),
      );
    if (matches.length !== 1 || !task) {
      try {
        await ack();
      } catch {
        return;
      }
      await this.explain(
        event.channel,
        event.thread_ts ?? event.ts,
        'Choose one unambiguous active agent name followed by a colon and a task. No runtime was started.',
      );
      return;
    }
    try {
      // Enqueue commits the event request key synchronously; acknowledge only after durable receipt.
      await this.enqueue(
        {
          agentId: matches[0]!.id,
          task,
          requestId: `slack:${body.team_id}:${body.event_id}`,
          transport: 'codex',
        },
        { teamId: body.team_id!, channel: event.channel, threadTs: event.thread_ts ?? event.ts },
      );
    } catch {
      try {
        await ack();
      } catch {
        return;
      }
      await this.explain(
        event.channel,
        event.thread_ts ?? event.ts,
        'GitFlash could not queue this task. Check the local app for the agent assignment and runtime setup.',
      );
      return;
    }
    try {
      await ack();
    } catch {
      /* A redelivery reuses the persisted request ID. */
    }
  }
  private async explain(channel: string, threadTs: string, text: string) {
    try {
      await this.reserveMessageSlot();
      await this.web?.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text,
        unfurl_links: false,
        unfurl_media: false,
      });
    } catch {
      /* No automatic repost after uncertain delivery. */
    }
  }
  private async reserveMessageSlot() {
    const wait = Math.max(0, this.nextMessageAt - Date.now());
    this.nextMessageAt = Math.max(Date.now(), this.nextMessageAt) + 1100;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  }
  async deliver(
    run: RunInfo,
    origin: SlackOrigin,
  ): Promise<{ status: 'pending' | 'sent' | 'uncertain' | 'failed'; reference: string | null }> {
    if (!this.connected || !this.web) return { status: 'pending', reference: null };
    if (origin.teamId !== this.teamId || origin.channel !== this.env.GITFLASH_SLACK_CHANNEL_ID)
      return { status: 'failed', reference: null };
    const text =
      run.status === 'completed'
        ? `${run.agentName} completed GitFlash task ${run.id}.\n\n${run.output.slice(0, 30_000)}${run.output.length > 30_000 ? '\n\nFull result is saved in the local GitFlash app.' : ''}`
        : `${run.agentName}: GitFlash task ${run.id} failed. ${run.error ?? 'Inspect the task in the local app.'}`;
    try {
      await this.reserveMessageSlot();
      if (!this.connected || !this.web) return { status: 'pending', reference: null };
      const response = await this.web.chat.postMessage({
        channel: origin.channel,
        thread_ts: origin.threadTs,
        text,
        unfurl_links: false,
        unfurl_media: false,
      });
      return response.ok && !!response.ts
        ? { status: 'sent', reference: `slack:${origin.teamId}:${origin.channel}:${response.ts}` }
        : { status: 'failed', reference: null };
    } catch {
      return { status: 'uncertain', reference: null };
    }
  }
  async disconnect() {
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    this.web = null;
    if (socket) {
      try {
        await socket.disconnect();
      } catch {
        /* Local shutdown remains available if Slack is offline. */
      }
      socket.removeAllListeners();
    }
  }
}
