import { createHash, randomUUID } from 'node:crypto';
import { access, open, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { findExecutable } from '../../src/adapters/process.js';
import type { WorkflowCheckResult } from '../../src/adapters/workflow-check.js';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Inspect the unmodified production permission profile, including real host effects.
 * Codex 0.138.0 Linux :minimal uses a private tmpfs root. A synthetic sibling
 * write can succeed there without reaching the host; syscall success alone is
 * therefore neither a host escape nor evidence of host write protection.
 */
export async function inspectSandboxBoundary(
  directory: string,
  run: (source: string) => Promise<WorkflowCheckResult>,
) {
  const existing = `${directory}-existing.txt`;
  const absent = `${directory}-new.txt`;
  const canary = `owned host canary ${randomUUID()}`;
  const selected = findExecutable('codex', process.env);
  if (!selected) throw new Error('The boundary fixture requires the installed optional CLI.');
  const wrapper = await realpath(selected);
  const wrapperStat = await stat(wrapper);
  if (basename(wrapper) !== 'codex.js' || !wrapperStat.isFile() || wrapperStat.size > 1_000_000)
    throw new Error('This read-only boundary fixture requires the official npm codex.js launcher.');
  // Prove host permissions allow this same open. No truncation or write occurs.
  const hostHandle = await open(wrapper, 'r+');
  await hostHandle.close();
  const wrapperHash = digest(await readFile(wrapper));
  await writeFile(existing, canary, { flag: 'wx', mode: 0o600 });
  const hostBefore = await stat(existing);
  try {
    const result = await run(`
import errno,json,os,pathlib,socket
result={}
existing=pathlib.Path(${JSON.stringify(existing)})
absent=pathlib.Path(${JSON.stringify(absent)})
def read_status(path):
 try: return path.read_text()
 except OSError as error: return errno.errorcode[error.errno]
result['existing_before']=read_status(existing)
for key,path in [('existing_write',existing),('new_write',absent)]:
 try:
  path.write_text('private boundary probe')
  result[key]='allowed'
 except OSError as error: result[key]=errno.errorcode[error.errno]
result['existing_after']=read_status(existing)
try:
 fd=os.open(${JSON.stringify(wrapper)},os.O_RDWR)
 os.close(fd)
 result['readonly_open']='allowed'
except OSError as error: result['readonly_open']=errno.errorcode[error.errno]
connection=None
try:
 connection=socket.socket()
 connection.connect(('127.0.0.1',9))
 result['network']='allowed'
except OSError as error: result['network']=errno.errorcode[error.errno]
finally:
 if connection is not None: connection.close()
if pathlib.Path('/proc/self/mountinfo').exists():
 result['root_mounts']=[line.split(' - ')[-1].split()[0] for line in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if line.split()[4]=='/']
print(json.dumps(result))
`);
    const hostAfter = await stat(existing);
    const absentOnHost = await access(absent)
      .then(() => false)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
        return true;
      });
    return {
      result,
      observed: result.status === 'completed' ? JSON.parse(result.output.split('\n')[0]) : null,
      host: {
        existingBytesUnchanged: (await readFile(existing, 'utf8')) === canary,
        existingInodeUnchanged:
          hostAfter.ino === hostBefore.ino && hostAfter.dev === hostBefore.dev,
        newFileAbsent: absentOnHost,
        readonlyProbeHashUnchanged: digest(await readFile(wrapper)) === wrapperHash,
        readonlyProbeHostOpenSucceeded: true,
      },
    };
  } finally {
    await rm(existing, { force: true });
    await rm(absent, { force: true });
  }
}
