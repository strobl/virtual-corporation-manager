import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A contributor check, not a product command. It only creates temporary workspaces.
const entry = resolve(
  process.argv[2] ?? fileURLToPath(new URL('../../dist/cli.js', import.meta.url)),
);
const fixture = resolve(
  process.argv[3] ?? fileURLToPath(new URL('./three-agent-studio.json', import.meta.url)),
);
const input = await readFile(fixture);
const definition = JSON.parse(input);
const temporary = await mkdtemp(join(tmpdir(), 'vcm-example-'));
const active = new Set();
const env = { ...process.env, GITFLASH_CODEX_PATH: '', GITFLASH_BUZZ_PATH: '' };
const checks = [];
function cli(args) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
  return result.stdout;
}
async function start(dataDir) {
  const child = spawn(
    process.execPath,
    [entry, '--data-dir', dataDir, '--port', '0', '--no-open'],
    { env },
  );
  active.add(child);
  return new Promise((resolveApp, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Startup timed out: ' + output)), 15000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolveApp({ child, url: match[0] });
      }
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', () => {
      active.delete(child);
      clearTimeout(timeout);
      reject(new Error('CLI exited before startup: ' + output));
    });
  });
}
async function stop(app) {
  if (app.child.exitCode !== null || app.child.signalCode !== null) return;
  await new Promise((resolveStop, reject) => {
    const timeout = setTimeout(() => reject(new Error('Shutdown timed out.')), 10000);
    app.child.once('exit', () => {
      clearTimeout(timeout);
      resolveStop();
    });
    app.child.kill('SIGTERM');
  });
}
async function request(app, path, value, expected = 200) {
  const headers = { 'Content-Type': 'application/json' };
  if (value !== undefined) {
    const session = await request(app, '/api/session');
    headers['X-GitFlash-Token'] = session.token;
  }
  const response = await fetch(app.url + path, {
    method: value === undefined ? 'GET' : 'POST',
    headers,
    body: value === undefined ? undefined : JSON.stringify(value),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  assert.equal(response.status, expected, JSON.stringify(body));
  return body;
}
async function importDefinition(app, value) {
  const before = await request(app, '/api/state');
  const preview = await request(app, '/api/preview', {
    baseRevision: before.revision,
    commands: [{ type: 'definition.import', definition: value }],
    summary: 'Verify fictional developer example',
  });
  assert.deepEqual(await request(app, '/api/state'), before, 'Preview must not save a company.');
  const applied = await request(app, '/api/apply', { previewId: preview.id });
  const replay = await request(app, '/api/apply', { previewId: preview.id });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.state, applied.state);
  return applied.state;
}
function assertFreshConfiguration(state, original) {
  for (const collection of ['companies', 'departments', 'agents', 'assignments', 'relationships']) {
    assert.equal(state[collection].length, original[collection].length, collection);
    assert(
      state[collection].every((item) => !original[collection].some((old) => old.id === item.id)),
      collection + ' IDs must be fresh.',
    );
  }
  assert.deepEqual(
    state.agents.map(({ name, role, instructions, responsibilities }) => ({
      name,
      role,
      instructions,
      responsibilities,
    })),
    original.agents.map(({ name, role, instructions, responsibilities }) => ({
      name,
      role,
      instructions,
      responsibilities,
    })),
  );
}
try {
  assert(definition.agents.length > 0, 'The example check needs at least one configured agent.');
  const data = join(temporary, 'workspace');
  let app = await start(data);
  const before = await request(app, '/api/state');
  await request(
    app,
    '/api/preview',
    {
      baseRevision: before.revision,
      commands: [
        { type: 'definition.import', definition: { ...definition, unsupportedExampleField: true } },
      ],
    },
    400,
  );
  assert.deepEqual(await request(app, '/api/state'), before);
  checks.push('Unsupported definition field refused without a saved change');
  let state = await importDefinition(app, definition);
  assertFreshConfiguration(state, definition);
  checks.push('Real preview, fresh-ID import and idempotent Apply replay');
  const member = state.agents[0];
  const instructions =
    member.instructions + '\nContributor verification: preserve a focused edit across restart.';
  const preview = await request(app, '/api/preview', {
    baseRevision: state.revision,
    commands: [{ type: 'agent.update', id: member.id, input: { instructions } }],
  });
  state = (await request(app, '/api/apply', { previewId: preview.id })).state;
  assert.equal(state.agents.find((item) => item.id === member.id).instructions, instructions);
  const exported = await request(app, '/api/export');
  assert.equal(exported.schemaVersion, 1);
  assert.equal('work' in exported, false);
  await stop(app);
  app = await start(data);
  assert.deepEqual(await request(app, '/api/state'), state);
  assert.equal((await request(app, '/api/time')).entries.length, 0);
  assert.deepEqual(await request(app, '/api/jobs'), []);
  assert.deepEqual(state.work, []);
  await stop(app);
  checks.push('Edited agent instructions and original IDs survive restart; zero work/jobs/hours');
  const exportedFile = join(temporary, 'definition.json');
  cli(['export', '--data-dir', data, '--output', exportedFile]);
  const cliExport = JSON.parse(await readFile(exportedFile, 'utf8'));
  for (const collection of ['companies', 'departments', 'agents', 'assignments', 'relationships'])
    assert.deepEqual(cliExport[collection], exported[collection]);
  const timeFile = join(temporary, 'time.json');
  cli(['time-export', '--data-dir', data, '--output', timeFile]);
  const time = JSON.parse(await readFile(timeFile, 'utf8'));
  assert.equal(time.format, 'gitflash-delivery-hours');
  assert.deepEqual(time.entries, []);
  const backup = join(temporary, 'backup.sqlite');
  cli(['backup', '--data-dir', data, '--output', backup]);
  const recovered = join(temporary, 'recovered');
  cli(['restore', '--data-dir', recovered, '--from', backup]);
  const doctor = JSON.parse(cli(['doctor', '--data-dir', recovered]));
  assert.equal(doctor.companies, state.companies.length);
  assert.equal(doctor.agents, state.agents.length);
  app = await start(recovered);
  assert.deepEqual(await request(app, '/api/state'), state);
  assert.deepEqual((await request(app, '/api/time')).entries, []);
  await stop(app);
  checks.push('CLI configuration/time export and full SQLite backup/restore preserve exact state');
  app = await start(join(temporary, 'roundtrip'));
  const importedAgain = await importDefinition(app, cliExport);
  assertFreshConfiguration(importedAgain, cliExport);
  await stop(app);
  checks.push('Actual exported JSON imports into a fresh workspace with new IDs');
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        version: cli(['--version']).trim(),
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        cliSha256: createHash('sha256')
          .update(await readFile(entry))
          .digest('hex'),
        exampleSha256: createHash('sha256').update(input).digest('hex'),
        counts: {
          companies: state.companies.length,
          departments: state.departments.length,
          agents: state.agents.length,
          work: 0,
          jobs: 0,
          timeEntries: 0,
        },
        checks,
        scope:
          'Automated local contributor check; no browser review or external human pilot claimed.',
      },
      null,
      2,
    ),
  );
} finally {
  for (const child of active) await stop({ child });
  await rm(temporary, { recursive: true, force: true });
}
