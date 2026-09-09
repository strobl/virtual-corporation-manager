/** Verify a published legacy archive -> renamed package with synthetic local data. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
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
const supportedReleases = {
  dd6bb54dc9cc6cd40e972d99eae88d2dd78f20eaab3eb6749a50350efc59c50f: {
    name: 'gitflash',
    version: '0.1.0-alpha.9',
  },
  '2de06d939f40545c19b5ae3cf562e3b9aa443557e1c8bd4f7716792e8cc26931': {
    name: 'virtualcorporationmanager',
    version: '0.1.0-alpha.10',
  },
};
const oldRelease = supportedReleases[hashes[0]];
assert(oldRelease, 'Use the SHA-verified published alpha.9 or alpha.10 archive.');
const newName = 'virtualcorporationmanager';
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
  let url = await start(oldRelease.name);
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
  if (oldRelease.name !== newName) {
    command(['uninstall', ...args, oldRelease.name]);
    assert.deepEqual(await readFile(join(data, 'workspace.sqlite')), before);
  }
  command(['install', ...args, archives[1]]);
  assert.deepEqual(await readFile(join(data, 'workspace.sqlite')), before);
  const links = await readdir(process.platform === 'win32' ? prefix : join(prefix, 'bin'));
  assert(!links.some((name) => /^gitflash(?:\.cmd|\.ps1)?$/.test(name)));
  assert(links.includes(process.platform === 'win32' ? 'vcm.cmd' : 'vcm'));
  const expectedVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
  let shimResult;
  if (process.platform === 'win32') {
    const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
    shimResult = spawnSync(
      process.execPath,
      [npm, 'exec', '--offline', '--call', 'vcm --version'],
      {
        cwd: temp,
        encoding: 'utf8',
        timeout: 15000,
        env: { ...process.env, [pathKey]: `${prefix};${process.env[pathKey]}` },
      },
    );
  } else {
    shimResult = spawnSync(join(prefix, 'bin', 'vcm'), ['--version'], {
      cwd: temp,
      encoding: 'utf8',
      timeout: 15000,
    });
  }
  assert.equal(shimResult.status, 0, shimResult.stderr || shimResult.stdout);
  assert.equal(shimResult.stdout.trim(), expectedVersion);
  url = await start(newName);
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
    oldArchive: { ...oldRelease, sha256: hashes[0] },
    upgradeMode:
      oldRelease.name === newName ? 'in-place npm update' : 'replace older named package',
    removedCommandLinkAbsent: true,
    upgradedCommandVersion: shimResult.stdout.trim(),
    newArchive: { sha256: hashes[1] },
    syntheticFixture: true,
    checks: [
      'global install of SHA-verified published old archive without ignore-scripts',
      'company, agent, responsibilities and 0.3 booked hours created with the old package',
      'stop and update the package without moving or rewriting the workspace',
      'company, agent IDs, complete state, time entries, catalog and history preserved',
      'current vcm link works, removed command link is absent, and uninstall preserves SQLite bytes',
    ],
  };
  if (evidencePath)
    await writeFile(resolve(evidencePath), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (child) await stop();
  await rm(temp, { recursive: true, force: true });
}
