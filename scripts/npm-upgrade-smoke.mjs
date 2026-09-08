/** Verify a published legacy archive -> renamed package with synthetic local data. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const [oldPath, newPath, evidencePath] = process.argv.slice(2);
if (!oldPath || !newPath)
  throw new Error(
    'Usage: npm run test:npm-upgrade -- <alpha.9.tgz> <candidate.tgz> [evidence.json]',
  );
const archives = [resolve(oldPath), resolve(newPath)];
const hashes = await Promise.all(
  archives.map(async (path) =>
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  ),
);
assert.equal(
  hashes[0],
  'dd6bb54dc9cc6cd40e972d99eae88d2dd78f20eaab3eb6749a50350efc59c50f',
  'Use the published alpha.9 archive.',
);
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run test:npm-upgrade.');
const temp = await mkdtemp(join(tmpdir(), 'vcm-npm-upgrade-'));
const prefix = join(temp, 'global');
const data = join(temp, 'workspace');
let child;
function command(args) {
  const result = spawnSync(process.execPath, [npm, ...args], {
    cwd: temp,
    encoding: 'utf8',
    timeout: 120000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
const args = ['--global', '--offline', '--no-audit', '--no-fund', '--prefix', prefix];
async function start(name) {
  const modules = command(['root', '--global', '--prefix', prefix]);
  const entry = join(modules, name, 'dist', 'cli.js');
  return new Promise((resolve, reject) => {
    let output = '';
    child = spawn(process.execPath, [entry, '--data-dir', data, '--port', '0', '--no-open']);
    const timer = setTimeout(
      () => reject(new Error('Upgrade startup timed out: ' + output)),
      15000,
    );
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code) reject(new Error(output));
    });
  });
}
async function stop() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Upgrade shutdown timed out')), 10000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
  child = undefined;
}
try {
  command(['install', ...args, archives[0]]);
  let url = await start('gitflash');
  const get = async (path) => (await fetch(url + path)).json();
  const session = await get('/api/session');
  const post = async (path, body) => {
    const response = await fetch(url + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GitFlash-Token': session.token },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  };
  let state = await get('/api/state');
  let preview = await post('/api/preview', {
    baseRevision: state.revision,
    commands: [
      {
        type: 'company.create',
        input: {
          name: 'Upgrade Company',
          shortCode: 'UPGRADE',
          description: 'Synthetic package migration acceptance',
          color: '#f4dc42',
        },
      },
    ],
  });
  state = (await post('/api/apply', { previewId: preview.id })).state;
  preview = await post('/api/preview', {
    baseRevision: state.revision,
    commands: [
      {
        type: 'agent.create',
        companyId: state.companies[0].id,
        input: {
          name: 'Migration reviewer',
          role: 'Check persistence',
          kind: 'agent',
          instructions: 'Synthetic fixture only.',
          responsibilities: ['Check retained IDs'],
          departmentId: null,
          managerId: null,
        },
      },
    ],
  });
  state = (await post('/api/apply', { previewId: preview.id })).state;
  const initialTime = await get('/api/time');
  await post('/api/time/mutate', {
    type: 'entry.create',
    requestId: 'npm-upgrade-synthetic',
    input: {
      companyId: state.companies[0].id,
      agentId: state.agents[0].id,
      date: initialTime.today,
      hours: 0.3,
      description: 'Synthetic migration fixture; not delivered work.',
    },
  });
  const savedTime = await get('/api/time');
  state = await get('/api/state');
  await stop();
  const before = await readFile(join(data, 'workspace.sqlite'));
  command(['uninstall', ...args, 'gitflash']);
  assert.deepEqual(await readFile(join(data, 'workspace.sqlite')), before);
  command(['install', ...args, archives[1]]);
  assert.deepEqual(await readFile(join(data, 'workspace.sqlite')), before);
  url = await start('virtualcorporationmanager');
  assert.deepEqual(await get('/api/state'), state);
  const reopenedTime = await get('/api/time');
  for (const key of ['entries', 'catalog', 'history', 'timezone'])
    assert.deepEqual(reopenedTime[key], savedTime[key]);
  await stop();
  const after = await readFile(join(data, 'workspace.sqlite'));
  command(['uninstall', ...args, 'virtualcorporationmanager']);
  assert.deepEqual(await readFile(join(data, 'workspace.sqlite')), after);
  const evidence = {
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    oldArchive: { version: '0.1.0-alpha.9', sha256: hashes[0] },
    newArchive: { sha256: hashes[1] },
    syntheticFixture: true,
    checks: [
      'global install of published gitflash alpha.9 archive without ignore-scripts',
      'company, agent, responsibilities and 0.3 booked hours created with the old package',
      'stop, uninstall old package, install renamed package without moving workspace',
      'company, agent IDs, complete state, time entries, catalog and history preserved',
      'uninstalling either package preserves the workspace SQLite bytes',
    ],
  };
  if (evidencePath)
    await writeFile(resolve(evidencePath), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (child) await stop();
  await rm(temp, { recursive: true, force: true });
}
