import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionInput } from '../src/adapters/types.js';

const fixture = vi.hoisted(() => ({ script: '' }));
vi.mock('../src/adapters/process.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/adapters/process.js')>();
  return {
    ...actual,
    // Run a real Node child as the fixture CLI on every OS; preserve the adapter's argv,
    // stdin, environment, working directory and process cancellation implementation.
    executeProcess: (
      executable: string,
      args: string[],
      options: Parameters<typeof actual.executeProcess>[2],
    ) => actual.executeProcess(executable, [fixture.script, ...args], options),
  };
});
import { executeBuzz } from '../src/adapters/buzz.js';

let directory: string;
const channel = '11111111-1111-4111-8111-111111111111';
const pubkey = 'a'.repeat(64);
const dispatchId = 'b'.repeat(64);
const responseId = 'c'.repeat(64);
const output = 'Synthetic stock review: reorder 15 units of SKU-A; leave SKU-B unchanged.';
const cli = `
import { appendFile, readFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const config = JSON.parse(await readFile('fixture.json', 'utf8'));
let input = '';
for await (const chunk of process.stdin) input += chunk;
await appendFile('calls.jsonl', JSON.stringify({
  args, input,
  privateKeyPresent: Boolean(process.env.BUZZ_PRIVATE_KEY),
  unrelatedTokenPresent: Boolean(process.env.SLACK_BOT_TOKEN),
}) + '\\n');
if (args[3] === 'send') {
  if (config.unreadableAcknowledgment) process.stdout.write('not-json');
  else process.stdout.write(JSON.stringify(config.acknowledgment));
} else if (args[3] === 'thread') process.stdout.write(JSON.stringify(config.events));
else process.exitCode = 1;
`;
function environment() {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    GITFLASH_BUZZ_PATH: process.execPath,
    GITFLASH_BUZZ_RELAY_URL: 'wss://relay.invalid',
    GITFLASH_BUZZ_CHANNEL_ID: channel,
    GITFLASH_BUZZ_AGENT_MAP: JSON.stringify({ 'agent-fixture': pubkey }),
    BUZZ_PRIVATE_KEY: 'fixture-identity-only',
    SLACK_BOT_TOKEN: 'fixture-unrelated-token',
  };
}
function input(): ExecutionInput {
  return {
    directory,
    signal: new AbortController().signal,
    run: { id: 'run-fixture', task: 'Review supplied synthetic stock quantities.' },
    agent: {
      id: 'agent-fixture',
      name: 'Analyst',
      role: 'Stock Analyst',
      instructions: 'Use only supplied fictional inputs.',
    },
    company: { name: 'Synthetic integration QA' },
    onDispatch: vi.fn(),
  } as unknown as ExecutionInput;
}
async function calls() {
  return (await readFile(join(directory, 'calls.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vcm-buzz-contract-'));
  fixture.script = join(directory, 'buzz-fixture.mjs');
  await writeFile(fixture.script, cli);
  await writeFile(
    join(directory, 'fixture.json'),
    JSON.stringify({
      acknowledgment: { accepted: true, event_id: dispatchId },
      events: [
        {
          id: 'wrong-identity',
          pubkey: 'd'.repeat(64),
          content: 'GitFlash result run-fixture Do not accept this result.',
        },
        {
          id: 'wrong-task',
          pubkey,
          content: 'GitFlash result another-run Do not accept this result.',
        },
        { id: responseId, pubkey, content: 'GitFlash result run-fixture ' + output },
      ],
    }),
  );
  const timeout = globalThis.setTimeout;
  // Accelerate only the ten-second polling interval, keeping real subprocess timers.
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: (...values: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ) => timeout(callback, delay === 10_000 ? 0 : delay, ...args)) as typeof setTimeout);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

describe('Buzz mapped CLI contract (local subprocess fixture, no relay or live agent)', () => {
  it('dispatches literal stdin to the mapped identity and accepts only its correlated final result', async () => {
    const request = input();
    const result = await executeBuzz(request, environment());
    expect(result).toEqual({
      output,
      sessionId: `buzz:${channel}:${dispatchId}:${responseId}`,
      runtimeVersion: null,
    });
    expect(request.onDispatch).toHaveBeenCalledExactlyOnceWith(`buzz:${channel}:${dispatchId}`);
    const observed = await calls();
    expect(observed).toHaveLength(2);
    expect(observed[0]).toMatchObject({
      args: [
        '--relay',
        'https://relay.invalid',
        'messages',
        'send',
        '--channel',
        channel,
        '--mention',
        pubkey,
        '--content',
        '-',
      ],
      privateKeyPresent: true,
      unrelatedTokenPresent: false,
    });
    expect(observed[0].input).toContain('GitFlash task run-fixture');
    expect(observed[0].input).toContain(request.run.task);
    expect(observed[0].input).toContain(request.agent.instructions);
    expect(observed[0].args.join(' ')).not.toContain('fixture-identity-only');
    expect(observed[1].args).toEqual([
      '--relay',
      'https://relay.invalid',
      'messages',
      'thread',
      '--channel',
      channel,
      '--event',
      dispatchId,
    ]);
  });
  it('does not dispatch an unmapped role', async () => {
    await expect(
      executeBuzz(input(), { ...environment(), GITFLASH_BUZZ_AGENT_MAP: '{}' }),
    ).rejects.toMatchObject({ code: 'buzz-not-configured' });
    await expect(readFile(join(directory, 'calls.jsonl'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('records an unreadable send outcome as uncertain without a second send', async () => {
    await writeFile(
      join(directory, 'fixture.json'),
      JSON.stringify({ unreadableAcknowledgment: true }),
    );
    const request = input();
    await expect(executeBuzz(request, environment())).rejects.toMatchObject({
      code: 'delivery-uncertain',
    });
    expect(request.onDispatch).not.toHaveBeenCalled();
    expect(await calls()).toHaveLength(1);
  });
  it('distinguishes relay acceptance from completion and preserves its dispatch reference', async () => {
    const request = input();
    await expect(executeBuzz(request, environment(), 0)).rejects.toMatchObject({
      code: 'buzz-timeout',
    });
    expect(request.onDispatch).toHaveBeenCalledExactlyOnceWith(`buzz:${channel}:${dispatchId}`);
    expect(await calls()).toHaveLength(1);
  });
});
