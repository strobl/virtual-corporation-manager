import { spawn, spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
  mkdir,
  writeFile,
  realpath,
  readdir,
  rename,
} from 'node:fs/promises';
import { tmpdir, cpus, platform, arch } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sourceManifest = JSON.parse(await readFile('package.json', 'utf8'));
const started = performance.now();
const temp = await mkdtemp(join(tmpdir(), 'gitflash-packed-'));
const children = new Set();
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run with npm run test:package so the npm executable is explicit.');
function command(args, cwd = process.cwd()) {
  const p = spawnSync(process.execPath, [npm, ...args], {
    cwd,
    encoding: 'utf8',
    env: process.env,
    timeout: 120000,
  });
  if (p.status !== 0) throw new Error(p.stderr || p.stdout || `Command failed: ${args.join(' ')}`);
  return p.stdout;
}
function cli(binary, args, { env = {}, expectedExit = 0 } = {}) {
  const p = spawnSync(
    process.execPath,
    [npm, 'exec', '--offline', '--prefix', binary.install, '--', binary.name, ...args],
    {
      cwd: binary.install,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      timeout: 15000,
    },
  );
  assert.equal(p.status, expectedExit, p.error?.message || p.stderr || p.stdout);
  return expectedExit === 0 ? p.stdout : p.stdout + p.stderr;
}
async function installedBinary(install, name, entry) {
  const shim = join(install, 'node_modules', '.bin', name);
  if (process.platform === 'win32') {
    // Short commands execute the real .cmd shim through npm exec. Long-running
    // startup uses its verified target so SIGTERM reaches Node rather than cmd.exe.
    const commandShim = await readFile(shim + '.cmd', 'utf8');
    assert(commandShim.replaceAll('\\', '/').includes(`${sourceManifest.name}/dist/cli.js`));
    return { name, install, entry };
  }
  assert.equal(await realpath(shim), await realpath(entry));
  return { name, install, entry: shim };
}
async function assertDefaultDirectory(binaries) {
  const isolatedHome = join(temp, 'default-home');
  const preload = join(temp, 'isolated-homedir.mjs');
  await mkdir(isolatedHome);
  // Override only the child's OS-home provider, never the operator's real home
  // or parent environment. This exercises the CLI's real default resolution.
  await writeFile(
    preload,
    `import os from 'node:os';\nimport { syncBuiltinESMExports } from 'node:module';\nos.homedir = () => ${JSON.stringify(isolatedHome)};\nsyncBuiltinESMExports();\n`,
  );
  const env = {
    GITFLASH_DATA_DIR: undefined,
    NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
    npm_config_cache: join(temp, 'npm-cache'),
  };
  const doctors = binaries.map((binary) => JSON.parse(cli(binary, ['doctor'], { env })));
  assert.equal(doctors[0].dataDir, join(isolatedHome, '.gitflash'));
  assert.deepEqual(doctors[1], doctors[0]);
  assert.deepEqual(await readdir(isolatedHome), ['.gitflash']);
  return {
    path: '~/.gitflash',
    method: 'Child-process OS homedir override; real user home and environment unchanged',
    aliasesShareDirectory: true,
    extraWorkspaceCreated: false,
  };
}
async function start(binary, dataDir) {
  return new Promise((resolve, reject) => {
    let output = '';
    let diagnostics = '';
    const child = spawn(
      process.execPath,
      [binary.entry, '--data-dir', dataDir, '--port', '0', '--no-open'],
      {
        env: {
          ...process.env,
          HTTP_PROXY: 'http://127.0.0.1:1',
          HTTPS_PROXY: 'http://127.0.0.1:1',
          GITFLASH_CODEX_PATH: '',
          GITFLASH_BUZZ_PATH: '',
        },
      },
    );
    children.add(child);
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Packaged startup timed out: ' + diagnostics));
    }, 15000);
    child.stdout.on('data', (c) => {
      output += c;
      diagnostics += c;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolve({ child, url: match[0], output });
      }
    });
    child.stderr.on('data', (c) => (diagnostics += c));
    child.on('error', reject);
    child.on('exit', (code) => {
      children.delete(child);
      clearTimeout(timeout);
      if (code) reject(new Error(diagnostics));
    });
  });
}
async function stop(app) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Shutdown timed out')), 10000);
    app.child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    app.child.kill('SIGTERM');
  });
}
let evidence;
try {
  const packed = JSON.parse(command(['pack', '--json', '--pack-destination', temp]))[0];
  // Keep the downloadable filename independent of the npm package name.
  const archiveFilename = `vcm-${sourceManifest.version}.tgz`;
  const tarball = join(temp, archiveFilename);
  await rename(join(temp, packed.filename), tarball);
  const bytes = await readFile(tarball);
  const forbidden = packed.files.filter((f) =>
    /(^|\/)\.env|\.sqlite|source-prototype|audit\/|\.lovable|\.map$/.test(f.path),
  );
  assert.deepEqual(forbidden, []);
  const install = join(temp, 'installed');
  await mkdir(install);
  await writeFile(join(install, 'package.json'), '{"private":true}');
  command(['install', '--offline', '--no-audit', '--no-fund', '--prefix', install, tarball]);
  const entry = join(install, 'node_modules', sourceManifest.name, 'dist', 'cli.js');
  const manifest = JSON.parse(
    await readFile(join(install, 'node_modules', sourceManifest.name, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.name, 'virtualcorporationmanager');
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.optionalDependencies ?? {}, {});
  for (const hook of ['preinstall', 'install', 'postinstall'])
    assert.equal(manifest.scripts?.[hook], undefined);
  assert.deepEqual(manifest.bin, { vcm: 'dist/cli.js', gitflash: 'dist/cli.js' });
  const vcm = await installedBinary(install, 'vcm', entry);
  const gitflash = await installedBinary(install, 'gitflash', entry);
  const binaries = [vcm, gitflash];
  const help = binaries.map((binary) => cli(binary, ['--help']));
  assert.equal(help[0], help[1]);
  assert.match(help[0], /^VCM .* — Virtual Corporation Manager/);
  assert.match(help[0], /Usage: vcm \[start\|doctor\|backup\|restore\|export\|time-export\]/);
  assert.match(help[0], /gitflash remains a compatibility alias/);
  const versions = binaries.map((binary) => cli(binary, ['--version']).trim());
  assert.deepEqual(versions, [manifest.version, manifest.version]);
  const invalidCommands = binaries.map((binary) => cli(binary, ['init'], { expectedExit: 1 }));
  const invalidDiagnostics = invalidCommands.map((output) =>
    output.split('\n').find((line) => line.startsWith('VCM:')),
  );
  assert.deepEqual(invalidDiagnostics, [
    'VCM: Unknown command: init. Use --help.',
    'VCM: Unknown command: init. Use --help.',
  ]);
  // An isolated local registry exercises the same bare package-name inference
  // as npx without requiring an unpublished name on the public registry.
  const registry = spawn(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import http from 'node:http';
    import { readFileSync } from 'node:fs';
    const bytes = readFileSync(${JSON.stringify(tarball)});
    const manifest = ${JSON.stringify(manifest)};
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/' + manifest.name + '/-/')) {
        res.setHeader('content-type', 'application/octet-stream'); res.end(bytes); return;
      }
      if (req.url === '/' + manifest.name) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ name: manifest.name, 'dist-tags': { latest: manifest.version }, versions: {
          [manifest.version]: { ...manifest, dist: { tarball: 'http://127.0.0.1:' + server.address().port + '/' + manifest.name + '/-/package.tgz', integrity: ${JSON.stringify(packed.integrity)} } }
        } })); return;
      }
      res.writeHead(404); res.end();
    });
    server.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
  `,
  ]);
  children.add(registry);
  registry.on('exit', () => children.delete(registry));
  const registryUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local npm fixture timed out')), 10000);
    registry.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    registry.stdout.once('data', (chunk) => {
      clearTimeout(timer);
      resolve(chunk.toString().trim());
    });
  });
  const inferredVersion = command(
    [
      'exec',
      '--yes',
      '--registry',
      registryUrl,
      '--cache',
      join(temp, 'npx-cache'),
      '--',
      manifest.name,
      '--version',
    ],
    temp,
  ).trim();
  assert.equal(inferredVersion, manifest.version);
  await stop({ child: registry });
  const globalPrefix = join(temp, 'global');
  command([
    'install',
    '--global',
    '--offline',
    '--no-audit',
    '--no-fund',
    '--prefix',
    globalPrefix,
    tarball,
  ]);
  const globalModules = command(['root', '--global', '--prefix', globalPrefix]).trim();
  const globalEntry = join(globalModules, manifest.name, 'dist', 'cli.js');
  const globalShim = join(globalPrefix, process.platform === 'win32' ? 'vcm.cmd' : 'bin/vcm');
  if (process.platform === 'win32') {
    const shim = await readFile(globalShim, 'utf8');
    assert(shim.replaceAll('\\', '/').includes(`${manifest.name}/dist/cli.js`));
    // npm exec finds the real global .cmd shim on PATH, including spaces.
    const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
    const result = spawnSync(
      process.execPath,
      [npm, 'exec', '--offline', '--call', 'vcm --version'],
      {
        cwd: temp,
        encoding: 'utf8',
        timeout: 15000,
        env: { ...process.env, [pathKey]: `${globalPrefix};${process.env[pathKey]}` },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), manifest.version);
  } else {
    assert.equal(await realpath(globalShim), await realpath(globalEntry));
    const result = spawnSync(globalShim, ['--version'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), manifest.version);
  }
  const globalBinary = {
    name: 'vcm',
    install: globalPrefix,
    entry: process.platform === 'win32' ? globalEntry : globalShim,
  };
  const defaultDirectory = await assertDefaultDirectory(binaries);
  const data = join(temp, 'data');
  let app = await start(vcm, data);
  assert.match(app.output, new RegExp(`^VCM ${manifest.version.replaceAll('.', '\\.')}`));
  assert.match(
    cli(gitflash, ['start', '--data-dir', data, '--port', '0', '--no-open'], {
      expectedExit: 1,
    }),
    /workspace is already open/,
  );
  const html = await (await fetch(app.url)).text();
  assert.match(html, /VCM — Virtual Corporation Manager/);
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map((m) => m[1]);
  assert(assets.length >= 2);
  for (const path of assets) {
    assert(!/^https?:/.test(path));
    const response = await fetch(app.url + path);
    assert.equal(response.status, 200);
    assert((await response.text()).length > 100);
  }
  const session = await (await fetch(app.url + '/api/session')).json();
  const post = async (path, value) => {
    const r = await fetch(app.url + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GitFlash-Token': session.token },
      body: JSON.stringify(value),
    });
    const b = await r.json();
    assert.equal(r.status, 200, JSON.stringify(b));
    return b;
  };
  let state = await (await fetch(app.url + '/api/state')).json();
  assert.equal(state.companies.length, 0);
  let p = await post('/api/preview', {
    commands: [
      {
        type: 'company.create',
        input: {
          name: 'Packaged Company',
          shortCode: 'PACK',
          description: 'Created from the installed tarball',
          color: '#f4dc42',
        },
      },
    ],
    baseRevision: state.revision,
  });
  state = (await post('/api/apply', { previewId: p.id })).state;
  const companyId = state.companies[0].id;
  p = await post('/api/preview', {
    commands: [
      {
        type: 'agent.create',
        companyId,
        input: {
          name: 'Release analyst',
          role: 'Validate install and recovery',
          kind: 'agent',
          instructions: 'Use supplied evidence and return a reviewable report.',
          responsibilities: ['Review release evidence'],
          departmentId: null,
          managerId: null,
        },
      },
    ],
    baseRevision: state.revision,
  });
  state = (await post('/api/apply', { previewId: p.id })).state;
  const agentId = state.agents[0].id;
  const templateStart = performance.now();
  p = await post('/api/templates/studio-100/preview', { baseRevision: state.revision });
  state = (await post('/api/apply', { previewId: p.id })).state;
  const templateMs = performance.now() - templateStart;
  assert.equal(state.agents.filter((a) => a.status === 'active').length, 101);
  assert.equal(state.work.length, 0);
  const workflows = await (await fetch(app.url + '/api/workflows')).json();
  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].id, 'PS-001');
  assert.equal(workflows[0].stages.length, 5);
  assert.equal(workflows[0].maxRepairCandidates, 2);
  assert.ok(workflows[0].help.includes('PS-001'));
  assert.ok(workflows[0].help.includes('npx virtualcorporationmanager'));
  assert.ok(!workflows[0].help.includes('--ignore-scripts'));
  for (const stage of workflows[0].stages)
    assert.equal(state.agents.filter((a) => a.role === stage.role).length, 1);
  const templates = await (await fetch(app.url + '/api/templates')).json();
  assert.equal(templates.find((t) => t.id === 'product-studio').agentCount, 5);
  assert.deepEqual(await (await fetch(app.url + '/api/jobs')).json(), []);
  const exported = await (await fetch(app.url + '/api/export')).json();
  assert.equal(exported.agents.length, 101);
  const emptyTime = await (await fetch(app.url + '/api/time')).json();
  assert.equal(emptyTime.entries.length, 0);
  assert.equal(emptyTime.catalog.length, 124);
  const booking = (hours, requestId) => ({
    type: 'entry.create',
    requestId,
    input: {
      companyId,
      agentId,
      date: emptyTime.today,
      hours,
      description: 'Synthetic packaged acceptance entry; not actual delivered work.',
    },
  });
  const firstBooking = await post('/api/time/mutate', booking(0.1, 'packed-time-1'));
  await post('/api/time/mutate', booking(0.2, 'packed-time-2'));
  assert.deepEqual(await post('/api/time/mutate', booking(0.1, 'packed-time-1')), firstBooking);
  const savedTime = await (await fetch(app.url + '/api/time')).json();
  assert.equal(savedTime.entries.length, 2);
  assert.equal(
    savedTime.entries.reduce((sum, row) => sum + row.tenths, 0),
    3,
  );
  assert.equal(savedTime.history.length, 2);
  assert.equal((await (await fetch(app.url + '/api/state')).json()).work.length, 0);
  await stop(app);
  app = await start(gitflash, data);
  assert.match(
    cli(vcm, ['start', '--data-dir', data, '--port', '0', '--no-open'], {
      expectedExit: 1,
    }),
    /workspace is already open/,
  );
  const reopened = await (await fetch(app.url + '/api/state')).json();
  assert.equal(reopened.agents.length, 101);
  assert(reopened.agents.some((a) => a.id === agentId));
  assert(reopened.companies.some((c) => c.id === companyId));
  const reopenedTime = await (await fetch(app.url + '/api/time')).json();
  assert.deepEqual(reopenedTime.entries, savedTime.entries);
  assert.deepEqual(reopenedTime.history, savedTime.history);
  await stop(app);
  const envDoctors = binaries.map((binary) =>
    JSON.parse(cli(binary, ['doctor'], { env: { GITFLASH_DATA_DIR: data } })),
  );
  assert.deepEqual(envDoctors[0], envDoctors[1]);
  assert.equal(envDoctors[0].dataDir, data);
  assert.equal(envDoctors[0].agents, 101);
  const ignoredEnvPath = join(temp, 'ignored-env-path');
  for (const binary of binaries) {
    const doctor = JSON.parse(
      cli(binary, ['doctor', '--data-dir', data], {
        env: { GITFLASH_DATA_DIR: ignoredEnvPath },
      }),
    );
    assert.deepEqual(doctor, envDoctors[0]);
  }
  assert(!(await readdir(temp)).includes('ignored-env-path'));
  const definitions = [];
  for (const binary of binaries) {
    const destination = join(temp, `${binary.name}-definition.json`);
    cli(binary, ['export', '--data-dir', data, '--output', destination]);
    definitions.push(JSON.parse(await readFile(destination, 'utf8')));
  }
  assert.deepEqual(definitions[0], definitions[1]);
  assert.deepEqual(definitions[0], exported);
  const timeExport = join(temp, 'delivery-hours.json');
  cli(vcm, ['time-export', '--data-dir', data, '--output', timeExport]);
  const exportedTime = JSON.parse(await readFile(timeExport, 'utf8'));
  assert.equal(exportedTime.format, 'gitflash-delivery-hours');
  assert.equal(exportedTime.version, 1);
  assert.deepEqual(exportedTime.entries, savedTime.entries);
  const compatibilityTimeExport = join(temp, 'compatibility-delivery-hours.json');
  cli(gitflash, ['time-export', '--data-dir', data, '--output', compatibilityTimeExport]);
  assert.deepEqual(JSON.parse(await readFile(compatibilityTimeExport, 'utf8')), exportedTime);
  const backup = join(temp, 'backup.sqlite');
  cli(vcm, ['backup', '--data-dir', data, '--output', backup]);
  const restored = join(temp, 'restored');
  cli(gitflash, ['restore', '--data-dir', restored, '--from', backup]);
  const compatibilityBackup = join(temp, 'compatibility-backup.sqlite');
  cli(gitflash, ['backup', '--data-dir', data, '--output', compatibilityBackup]);
  const compatibilityRestored = join(temp, 'compatibility-restored');
  cli(vcm, ['restore', '--data-dir', compatibilityRestored, '--from', compatibilityBackup]);
  const restoredDoctors = [
    JSON.parse(cli(vcm, ['doctor', '--data-dir', restored])),
    JSON.parse(cli(gitflash, ['doctor', '--data-dir', compatibilityRestored])),
  ];
  for (const doctor of restoredDoctors)
    assert.deepEqual({ ...doctor, dataDir: data }, envDoctors[0]);
  app = await start(vcm, restored);
  const recovered = await (await fetch(app.url + '/api/state')).json();
  assert.deepEqual(recovered.companies, reopened.companies);
  assert.deepEqual(recovered.agents, reopened.agents);
  assert.deepEqual(recovered.assignments, reopened.assignments);
  assert.deepEqual(recovered.history, reopened.history);
  const recoveredTime = await (await fetch(app.url + '/api/time')).json();
  assert.deepEqual(recoveredTime.entries, savedTime.entries);
  assert.deepEqual(recoveredTime.catalog, savedTime.catalog);
  assert.deepEqual(recoveredTime.history, savedTime.history);
  assert.equal(recoveredTime.timezone, savedTime.timezone);
  const restoredSession = await (await fetch(app.url + '/api/session')).json();
  const replayResponse = await fetch(app.url + '/api/time/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GitFlash-Token': restoredSession.token },
    body: JSON.stringify(booking(0.1, 'packed-time-1')),
  });
  assert.equal(replayResponse.status, 200);
  assert.deepEqual(await replayResponse.json(), firstBooking);
  await stop(app);
  app = await start(gitflash, compatibilityRestored);
  assert.deepEqual(await (await fetch(app.url + '/api/state')).json(), recovered);
  const compatibilityRecoveredTime = await (await fetch(app.url + '/api/time')).json();
  assert.deepEqual(compatibilityRecoveredTime.entries, savedTime.entries);
  assert.deepEqual(compatibilityRecoveredTime.history, savedTime.history);
  await stop(app);
  app = await start(globalBinary, data);
  assert.deepEqual(await (await fetch(app.url + '/api/state')).json(), reopened);
  assert.deepEqual((await (await fetch(app.url + '/api/time')).json()).entries, savedTime.entries);
  await stop(app);
  const dataBeforeUninstall = await readFile(join(data, 'workspace.sqlite'));
  command([
    'uninstall',
    '--global',
    '--offline',
    '--no-audit',
    '--no-fund',
    '--prefix',
    globalPrefix,
    manifest.name,
  ]);
  assert.deepEqual(await readFile(join(data, 'workspace.sqlite')), dataBeforeUninstall);
  command([
    'uninstall',
    '--offline',
    '--no-audit',
    '--no-fund',
    '--prefix',
    install,
    manifest.name,
  ]);
  assert.deepEqual(await readFile(join(data, 'workspace.sqlite')), dataBeforeUninstall);
  evidence = {
    artifact: archiveFilename,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    files: packed.files.length,
    node: process.version,
    os: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    packageName: manifest.name,
    version: manifest.version,
    installedBinaries: ['vcm', 'gitflash'],
    commandInvocation: 'npm exec --offline --prefix <isolated-install> -- <vcm|gitflash>',
    startupInvocation:
      process.platform === 'win32'
        ? 'Node executes the package entry verified in each installed .cmd shim'
        : 'Node executes each installed named .bin symlink; both resolve to dist/cli.js',
    defaultDirectory,
    template100PreviewAndApplyMs: Math.round(templateMs),
    totalMs: Math.round(performance.now() - started),
    checks: [
      'offline npm install of self-contained tarball without --ignore-scripts; no runtime dependencies or install hooks',
      'bare package-name npx inference against a local registry fixture with an empty cache',
      'isolated global installation creates a working vcm command and reopens the populated workspace',
      'vcm and gitflash installed aliases expose identical help/version and invalid-command exit codes',
      'both aliases retain ~/.gitflash default and GITFLASH_DATA_DIR; --data-dir takes precedence',
      'both aliases start the same populated workspace and contend for the same live lock',
      'both aliases run doctor/export/time-export with equivalent data and existing format identifiers',
      'cross-alias SQLite backup/restore works in both directions without creating an empty company',
      'packaged CLI and all referenced assets',
      'company and agent creation through API',
      '100-agent template atomic apply',
      '124 shared catalog defaults; synthetic 0.1 + 0.2 hours sum exactly to 0.3',
      'time request replay, restart and CLI time-export preserve exact entries and history',
      'restart IDs preserved',
      'SQLite backup and fresh restore preserve agents assignments history',
      'SQLite restore preserves catalog, time history and original replay receipt',
      'uninstall preserves workspace data outside the package',
      'no seeded work claimed',
    ],
    networkScope:
      'Tarball installation uses npm --offline. The npx inference check uses an isolated loopback registry with this archive and an empty cache; core assets and API use loopback. Public registry verification is recorded separately.',
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (process.env.GITFLASH_EVIDENCE_DIR) {
    await mkdir(process.env.GITFLASH_EVIDENCE_DIR, { recursive: true });
    await writeFile(
      join(
        process.env.GITFLASH_EVIDENCE_DIR,
        `packed-${platform()}-${arch()}-${process.versions.node}.json`,
      ),
      JSON.stringify(evidence, null, 2),
    );
  }
} finally {
  for (const child of children) child.kill('SIGTERM');
  await rm(temp, { recursive: true, force: true });
}
