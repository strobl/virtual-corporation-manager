import { backup, type DatabaseSync } from 'node:sqlite';
import { clearInterval, setInterval } from 'node:timers';

/** Keep native backup completion observable even when no other JavaScript work is pending. */
export async function backupDatabase(source: DatabaseSync, destination: string): Promise<number> {
  // Node 26.8.1 can leave backup's Promise continuation pending until another JS
  // callback runs, including outside test runners. Cover the supported 26.x line
  // until an upstream fix is verified; Node 24 needs no wakeup. This timer is
  // referenced only while the backup is pending, so a quiet CLI finishes its
  // backup instead of exiting early. It never changes the native result/error.
  const wakeup = process.versions.node.startsWith('26.') ? setInterval(() => {}, 10) : null;
  try {
    return await backup(source, destination);
  } finally {
    if (wakeup) clearInterval(wakeup);
  }
}
