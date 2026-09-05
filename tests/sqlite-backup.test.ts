import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

it('finishes repeated native backups in a quiet process and releases its wakeup after success or error', () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('./fixtures/sqlite-backup-stress.mjs', import.meta.url)),
      new URL('../src/db/backup.ts', import.meta.url).href,
    ],
    {
      encoding: 'utf8',
      // Fifty durable file copies took 2.9s on the Windows CI control and
      // exceeded 5s on a runner where the full SQLite suite was twice as slow.
      // This remains a parent-only deadline: no child callback can mask the
      // native wakeup regression, and all 50 integrity/error/exit checks remain.
      timeout: process.platform === 'win32' ? 10_000 : 5000,
      // A parent preload could add a timer and conceal this runtime regression.
      env: { ...process.env, NODE_OPTIONS: '' },
    },
  );
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain(
    '50 verified backups; native errors preserved; exiting naturally',
  );
});
