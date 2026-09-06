import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const startedAt = performance.now();
function progress(phase, details = {}) {
  // Synchronous writes cannot leave an I/O callback to wake the event loop
  // while the native backup Promise is pending, including on Windows pipes.
  writeSync(
    1,
    `${JSON.stringify({ phase, elapsedMs: Math.round(performance.now() - startedAt), ...details })}\n`,
  );
}

progress('import-start');
const { backupDatabase } = await import(process.argv[2]);
progress('import-complete');
const folder = mkdtempSync(join(tmpdir(), 'gitflash-native-backup-'));
const db = new DatabaseSync(join(folder, 'source.sqlite'));
try {
  progress('source-setup-start');
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE evidence(value TEXT); INSERT INTO evidence VALUES ('synthetic');",
  );
  progress('source-setup-complete');
  // No child timer, IPC channel or runner callback may mask a missing native
  // Promise wakeup. The parent process enforces the deadline from outside.
  for (let index = 0; index < 50; index += 1) {
    const destination = join(folder, `copy-${index}.sqlite`);
    const copyStartedAt = performance.now();
    progress('backup-start', { copy: index + 1 });
    const pages = await backupDatabase(db, destination);
    progress('backup-complete', {
      copy: index + 1,
      backupElapsedMs: Math.round(performance.now() - copyStartedAt),
    });
    assert.ok(pages > 0);
    progress('verification-start', { copy: index + 1 });
    const copy = new DatabaseSync(destination, { readOnly: true });
    try {
      assert.equal(copy.prepare('SELECT value FROM evidence').get().value, 'synthetic');
      assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      copy.close();
    }
    progress('verification-complete', { copy: index + 1 });
  }
  progress('missing-directory-error-start');
  await assert.rejects(backupDatabase(db, join(folder, 'missing', 'copy.sqlite')), {
    code: 'ERR_SQLITE_ERROR',
  });
  progress('missing-directory-error-verified');
  progress('source-close-start');
  db.close();
  progress('source-close-complete');
  progress('closed-database-error-start');
  await assert.rejects(backupDatabase(db, join(folder, 'closed.sqlite')), {
    code: 'ERR_INVALID_STATE',
  });
  progress('closed-database-error-verified');
} finally {
  progress('cleanup-start');
  if (db.isOpen) db.close();
  rmSync(folder, { recursive: true, force: true });
  progress('cleanup-complete');
}
writeSync(1, '50 verified backups; native errors preserved; exiting naturally\n');
