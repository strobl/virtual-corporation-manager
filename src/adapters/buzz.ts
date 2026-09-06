import type { WorkspaceState } from '../domain/contracts.js';
import { executeProcess, findExecutable, runtimeEnvironment } from './process.js';
import {
  IntegrationError,
  type ExecutionInput,
  type ExecutionResult,
  type IntegrationStatus,
} from './types.js';

export interface BuzzTeamSnapshot {
  format: 'buzz-team-snapshot';
  version: 1;
  team: { name: string; description: string; instructions: string };
  members: Array<{
    format: 'buzz-agent-snapshot';
    version: 1;
    definition: {
      name: string;
      systemPrompt: string;
      runtime: 'codex';
      parallelism: 1;
      respondTo: 'owner-only';
    };
    profile: { displayName: string; about: string };
    memory: { level: 'none'; entries: never[] };
  }>;
}

export function exportBuzzTeam(state: WorkspaceState, companyId?: string): BuzzTeamSnapshot {
  const company = companyId
    ? state.companies.find((item) => item.id === companyId && item.status === 'active')
    : undefined;
  if (companyId && !company)
    throw new IntegrationError('company-not-found', 'Select an active company to export.');
  const activeCompanies = new Set(
    state.companies
      .filter((item) => item.status === 'active' && (!companyId || item.id === companyId))
      .map((item) => item.id),
  );
  const assigned = new Set(
    state.assignments
      .filter((item) => !item.endedAt && activeCompanies.has(item.companyId))
      .map((item) => item.agentId),
  );
  const agents = state.agents.filter(
    (item) => item.kind === 'agent' && item.status === 'active' && assigned.has(item.id),
  );
  if (!agents.length)
    throw new IntegrationError('no-agents', 'Add an active AI agent before exporting a Buzz team.');
  const snapshot: BuzzTeamSnapshot = {
    format: 'buzz-team-snapshot',
    version: 1,
    team: {
      name: company?.name ?? 'VCM Company',
      description: company?.description ?? 'Company roles configured in VCM.',
      instructions:
        'Act only on an explicit assigned task. Identify the contributing role, provide useful evidence, and distinguish proposed actions from completed work. Configuration does not imply activation.',
    },
    members: agents.map((agent) => ({
      format: 'buzz-agent-snapshot',
      version: 1,
      definition: {
        name: agent.name,
        systemPrompt: [
          `Role: ${agent.role}`,
          agent.instructions,
          `Responsibilities:\n${agent.responsibilities.join('\n')}`,
          `GitFlash role ID: ${agent.id}`,
        ].join('\n\n'),
        runtime: 'codex',
        parallelism: 1,
        respondTo: 'owner-only',
      },
      profile: { displayName: agent.name, about: agent.role },
      memory: { level: 'none', entries: [] },
    })),
  };
  validateBuzzTeam(snapshot);
  return snapshot;
}

export function validateBuzzTeam(value: unknown): asserts value is BuzzTeamSnapshot {
  if (!value || typeof value !== 'object')
    throw new IntegrationError('invalid-snapshot', 'A Buzz team snapshot must be an object.');
  const keys = (object: unknown, allowed: string[]) => {
    if (
      !object ||
      typeof object !== 'object' ||
      Array.isArray(object) ||
      Object.keys(object).some((key) => !allowed.includes(key))
    ) {
      throw new IntegrationError(
        'invalid-snapshot',
        'Portable Buzz exports cannot include credentials, identities, executable settings or unknown fields.',
      );
    }
  };
  const named = (text: unknown): text is string => typeof text === 'string' && !!text.trim();
  keys(value, ['format', 'version', 'team', 'members']);
  const snapshot = value as BuzzTeamSnapshot;
  if (
    snapshot.format !== 'buzz-team-snapshot' ||
    snapshot.version !== 1 ||
    !named(snapshot.team?.name) ||
    !Array.isArray(snapshot.members) ||
    !snapshot.members.length
  ) {
    throw new IntegrationError(
      'invalid-snapshot',
      'The Buzz team snapshot requires a name and at least one member.',
    );
  }
  keys(snapshot.team, ['name', 'description', 'instructions']);
  if (snapshot.members.length > 1000 || Buffer.byteLength(JSON.stringify(snapshot)) > 5_000_000)
    throw new IntegrationError(
      'invalid-snapshot',
      'The Buzz team exceeds the supported export size.',
    );
  for (const member of snapshot.members) {
    keys(member, ['format', 'version', 'definition', 'profile', 'memory']);
    keys(member.definition, ['name', 'systemPrompt', 'runtime', 'parallelism', 'respondTo']);
    keys(member.profile, ['displayName', 'about']);
    keys(member.memory, ['level', 'entries']);
    if (
      member.format !== 'buzz-agent-snapshot' ||
      member.version !== 1 ||
      !named(member.definition.name) ||
      !named(member.profile.displayName) ||
      !named(member.definition.systemPrompt) ||
      member.definition.runtime !== 'codex' ||
      member.memory?.level !== 'none' ||
      !Array.isArray(member.memory.entries) ||
      member.memory.entries.length ||
      member.definition.respondTo !== 'owner-only' ||
      member.definition.parallelism !== 1
    ) {
      throw new IntegrationError(
        'invalid-snapshot',
        'A Buzz member has an invalid identity, memory or permission configuration.',
      );
    }
  }
  const prohibited =
    /^(?:privateKey|private_key|private_key_nsec|authTag|auth_tag|envVars|env_vars|agentCommand|agent_command|acp_command|mcp_command|pubkey|relayUrl|relay_url)$/;
  const inspect = (object: unknown): void => {
    if (!object || typeof object !== 'object') return;
    for (const [key, entry] of Object.entries(object)) {
      if (prohibited.test(key))
        throw new IntegrationError(
          'invalid-snapshot',
          'Portable Buzz exports cannot include credentials, identities or executable settings.',
        );
      inspect(entry);
    }
  };
  inspect(snapshot);
}

interface BuzzConfiguration {
  executable: string;
  relay: string;
  channel: string;
  map: Record<string, string>;
  env: NodeJS.ProcessEnv;
}
function configuration(env: NodeJS.ProcessEnv): BuzzConfiguration | null {
  const executable = findExecutable('buzz', env);
  if (
    !executable ||
    !env.BUZZ_PRIVATE_KEY ||
    !env.GITFLASH_BUZZ_RELAY_URL ||
    !env.GITFLASH_BUZZ_CHANNEL_ID ||
    !env.GITFLASH_BUZZ_AGENT_MAP
  )
    return null;
  let relay: URL;
  let map: Record<string, string>;
  try {
    relay = new URL(env.GITFLASH_BUZZ_RELAY_URL);
    map = JSON.parse(env.GITFLASH_BUZZ_AGENT_MAP);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:', 'ws:', 'wss:'].includes(relay.protocol) ||
    relay.username ||
    relay.password ||
    relay.search ||
    relay.hash ||
    !map ||
    Array.isArray(map) ||
    typeof map !== 'object'
  )
    return null;
  relay.protocol =
    relay.protocol === 'wss:' ? 'https:' : relay.protocol === 'ws:' ? 'http:' : relay.protocol;
  if (
    !/^[0-9a-f-]{36}$/i.test(env.GITFLASH_BUZZ_CHANNEL_ID) ||
    !Object.values(map).every(
      (pubkey) => typeof pubkey === 'string' && /^[a-f0-9]{64}$/i.test(pubkey),
    )
  )
    return null;
  return {
    executable,
    relay: relay.toString().replace(/\/$/, ''),
    channel: env.GITFLASH_BUZZ_CHANNEL_ID,
    map,
    env: {
      ...runtimeEnvironment(env),
      BUZZ_PRIVATE_KEY: env.BUZZ_PRIVATE_KEY,
      ...(env.BUZZ_AUTH_TAG ? { BUZZ_AUTH_TAG: env.BUZZ_AUTH_TAG } : {}),
    },
  };
}
export function buzzStatus(env: NodeJS.ProcessEnv): IntegrationStatus['buzz'] {
  const configured = !!configuration(env);
  return {
    available: !!findExecutable('buzz', env),
    state: configured ? 'configured' : 'not-configured',
    message: configured
      ? 'Buzz CLI configuration is present. A live connection and agent response have not been verified by this check.'
      : 'Export a Buzz team for native import, or configure the optional CLI identity, relay, channel and agent mapping. Exporting does not start agents.',
  };
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new IntegrationError('cancelled', 'The task was cancelled.'));
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      reject(new IntegrationError('cancelled', 'The task was cancelled.'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', stop, { once: true });
  });
}

export async function executeBuzz(
  input: ExecutionInput,
  env: NodeJS.ProcessEnv,
  timeoutMs = 300_000,
): Promise<ExecutionResult> {
  const config = configuration(env);
  const pubkey = config?.map[input.agent.id];
  if (!config || !pubkey)
    throw new IntegrationError(
      'buzz-not-configured',
      'Configure Buzz CLI access and map this VCM agent to a running Buzz identity.',
    );
  const prompt = [
    `@${input.agent.name}: GitFlash task ${input.run.id}`,
    `Company: ${input.company.name}\nRole: ${input.agent.role}`,
    `Instructions:\n${input.agent.instructions}`,
    `Task:\n${input.run.task}`,
    `Produce the actual deliverable. Reply in this thread with a final message beginning "GitFlash result ${input.run.id}" and the complete useful result. Do not report success unless the work is complete.`,
  ].join('\n\n');
  if (Buffer.byteLength(prompt) > 60_000)
    throw new IntegrationError(
      'task-too-large',
      'The Buzz task exceeds its message limit. Shorten the task or role instructions.',
    );
  let sent;
  try {
    sent = await executeProcess(
      config.executable,
      [
        '--relay',
        config.relay,
        'messages',
        'send',
        '--channel',
        config.channel,
        '--mention',
        pubkey,
        '--content',
        '-',
      ],
      {
        env: config.env,
        input: prompt,
        cwd: input.directory,
        signal: input.signal,
        timeoutMs: 30_000,
      },
    );
  } catch {
    throw new IntegrationError(
      'delivery-uncertain',
      'Buzz delivery is uncertain. Check the channel for this task ID before retrying; VCM will not resend automatically.',
    );
  }
  let acknowledgment: { event_id?: string; accepted?: boolean };
  try {
    acknowledgment = JSON.parse(sent.stdout);
  } catch {
    throw new IntegrationError(
      'delivery-uncertain',
      'Buzz returned no readable acknowledgment. Check the channel for this task ID before retrying.',
    );
  }
  if (sent.code !== 0 || !acknowledgment.accepted || !acknowledgment.event_id)
    throw new IntegrationError(
      'buzz-rejected',
      'Buzz did not accept the task. Verify relay access, agent membership and identity permissions.',
    );
  const eventId = acknowledgment.event_id;
  input.onDispatch?.(`buzz:${config.channel}:${eventId}`);
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    await wait(10_000, input.signal);
    const response = await executeProcess(
      config.executable,
      [
        '--relay',
        config.relay,
        'messages',
        'thread',
        '--channel',
        config.channel,
        '--event',
        eventId,
      ],
      { env: config.env, cwd: input.directory, signal: input.signal, timeoutMs: 15_000 },
    );
    if (response.code !== 0) continue;
    let events: unknown;
    try {
      events = JSON.parse(response.stdout);
    } catch {
      continue;
    }
    if (!Array.isArray(events)) continue;
    for (const event of events) {
      if (
        event.pubkey !== pubkey ||
        typeof event.content !== 'string' ||
        !event.content.startsWith(`GitFlash result ${input.run.id}`)
      )
        continue;
      const output = event.content.slice(`GitFlash result ${input.run.id}`.length).trim();
      if (output)
        return {
          output,
          sessionId: `buzz:${config.channel}:${eventId}:${String(event.id)}`,
          runtimeVersion: null,
        };
    }
  }
  throw new IntegrationError(
    'buzz-timeout',
    `Buzz accepted task ${input.run.id}, but no final agent result arrived. Inspect its thread before retrying.`,
  );
}
