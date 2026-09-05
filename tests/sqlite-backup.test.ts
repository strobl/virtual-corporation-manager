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
      timeout: 5000,
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
