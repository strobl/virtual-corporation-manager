import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { backupDatabase } = await import(process.argv[2]);
const folder = mkdtempSync(join(tmpdir(), 'gitflash-native-backup-'));
const db = new DatabaseSync(join(folder, 'source.sqlite'));
try {
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE evidence(value TEXT); INSERT INTO evidence VALUES ('synthetic');",
  );
  // No child timer, IPC channel or runner callback may mask a missing native
  // Promise wakeup. The parent process enforces the deadline from outside.
  for (let index = 0; index < 50; index += 1) {
    const destination = join(folder, `copy-${index}.sqlite`);
    assert.ok((await backupDatabase(db, destination)) > 0);
    const copy = new DatabaseSync(destination, { readOnly: true });
    try {
      assert.equal(copy.prepare('SELECT value FROM evidence').get().value, 'synthetic');
      assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      copy.close();
    }
  }
  await assert.rejects(backupDatabase(db, join(folder, 'missing', 'copy.sqlite')), {
    code: 'ERR_SQLITE_ERROR',
  });
  db.close();
  await assert.rejects(backupDatabase(db, join(folder, 'closed.sqlite')), {
    code: 'ERR_INVALID_STATE',
  });
  process.stdout.write('50 verified backups; native errors preserved; exiting naturally\n');
} finally {
  if (db.isOpen) db.close();
  rmSync(folder, { recursive: true, force: true });
}
