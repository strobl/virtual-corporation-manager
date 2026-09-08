import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { startServer } from '../server/index';
import { createWorkspaceStore, restoreWorkspaceBackup } from '../db/store';
import { brand } from '../brand';
declare const __GITFLASH_VERSION__: string;
const version = typeof __GITFLASH_VERSION__ === 'undefined' ? 'development' : __GITFLASH_VERSION__;
const help = `${brand.name} ${version} — ${brand.productName}\n\nUsage: vcm [start|doctor|backup|restore|export|time-export] [options]\n\n  --data-dir <path>   Workspace directory (default: ~/.gitflash)\n  --port <number>     Local port (default: 4310)\n  --no-open           Print the URL without opening a browser\n  --output <path>     Destination for backup or export\n  --from <path>       SQLite backup to restore; stop VCM first\n  --help, -h          Show help\n  --version          Show version\n\ngitflash remains a compatibility alias for the same commands and workspace.\nData directory: --data-dir, then GITFLASH_DATA_DIR, then ~/.gitflash.\nInstall: npm install -g virtualcorporationmanager. Start: vcm.\n\nexport saves company configuration; time-export saves the delivery-hours\nledger, catalog and history. Use backup/restore for full workspace recovery.\nStop the workspace before running these file commands.\n\nThe local core needs no account or network. Optional agent runtimes have\ntheir own installation, authentication and usage requirements.\n`;
function parse(args: string[]) {
  const values: Record<string, string | boolean> = {};
  let command = 'start';
  if (args[0] && !args[0].startsWith('-')) command = args.shift()!;
  if (!['start', 'doctor', 'backup', 'restore', 'export', 'time-export'].includes(command))
    throw new Error(`Unknown command: ${command}. Use --help.`);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--no-open', '--help', '-h', '--version'].includes(arg)) {
      values[arg] = true;
      continue;
    }
    if (!['--data-dir', '--port', '--output', '--from'].includes(arg))
      throw new Error(`Unknown option: ${arg}. Use --help.`);
    const next = args[++i];
    if (!next || next.startsWith('--')) throw new Error(`${arg} requires a value.`);
    values[arg] = next;
  }
  return { command, values };
}
function launchBrowser(url: string): Promise<boolean> {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', shell: false });
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
  });
}
async function main() {
  const { command, values } = parse(process.argv.slice(2));
  if (values['--help'] || values['-h']) {
    console.log(help);
    return;
  }
  if (values['--version']) {
    console.log(version);
    return;
  }
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (!((nodeMajor === 24 && nodeMinor >= 14) || nodeMajor === 26))
    throw new Error(
      'VCM requires Node.js 24.14+ (24.x) or 26.x. Install a supported Node.js release and retry.',
    );
  const dataDir = resolve(
    String(
      values['--data-dir'] ?? process.env.GITFLASH_DATA_DIR ?? resolve(homedir(), '.gitflash'),
    ),
  );
  if (command === 'restore') {
    if (!values['--from']) throw new Error('Use --from <backup.sqlite> to choose a backup.');
    await restoreWorkspaceBackup(dataDir, resolve(String(values['--from'])));
    console.log(`Workspace restored in ${dataDir}. Start VCM with vcm to inspect it.`);
    return;
  }
  if (command === 'backup' || command === 'export' || command === 'time-export') {
    if (!values['--output'])
      throw new Error(
        'Choose a destination with --output <path>. Stop the running workspace first.',
      );
    const output = resolve(String(values['--output']));
    try {
      await access(output);
      throw new Error('Destination already exists. Choose a new path to preserve it.');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    await mkdir(dirname(output), { recursive: true });
    const store = createWorkspaceStore(dataDir);
    try {
      if (command === 'backup') await store.backup(output);
      else
        await writeFile(
          output,
          JSON.stringify(
            command === 'time-export'
              ? { format: 'gitflash-delivery-hours', version: 1, ...store.time.snapshot() }
              : store.exportDefinition(),
            null,
            2,
          ) + '\n',
          {
            mode: 0o600,
            flag: 'wx',
          },
        );
      console.log(
        `${command === 'backup' ? 'Backup' : command === 'time-export' ? 'Delivery-hours export' : 'Company definition'} saved to ${output}`,
      );
    } finally {
      store.close();
    }
    return;
  }
  if (command === 'doctor') {
    const store = createWorkspaceStore(dataDir);
    try {
      const s = store.snapshot();
      console.log(
        JSON.stringify(
          {
            version,
            node: process.version,
            platform: process.platform,
            architecture: process.arch,
            dataDir,
            schemaVersion: s.schemaVersion,
            revision: s.revision,
            companies: s.companies.length,
            agents: s.agents.length,
            timeEntries: store.time.snapshot().entries.length,
            timezone: store.time.snapshot().timezone,
            localCore: 'ready',
            optionalRuntimes: 'Check Integrations in the console; no external calls were made.',
          },
          null,
          2,
        ),
      );
    } finally {
      store.close();
    }
    return;
  }
  const port = Number(values['--port'] ?? 4310);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('--port must be an integer between 0 and 65535.');
  const webDir = fileURLToPath(new URL('./web/', import.meta.url));
  const app = await startServer({ dataDir, port, webDir });
  console.log(
    `${brand.name} ${version}\n\n  ${app.url}\n\nWorkspace: ${dataDir}\nYour data is saved locally. Press Ctrl+C to stop.\n`,
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void app
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  if (!values['--no-open'] && !(await launchBrowser(app.url)))
    console.log(`Could not open a browser automatically. Open ${app.url} to continue.`);
}
main().catch((error) => {
  const e = error as NodeJS.ErrnoException;
  const message =
    e.code === 'EADDRINUSE'
      ? 'The local port is already in use. Open the existing VCM session or choose --port <number>.'
      : e.message;
  console.error(`${brand.name}: ${message}`);
  process.exitCode = 1;
});
