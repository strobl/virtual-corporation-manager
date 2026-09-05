import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  ApplyResult,
  AuditEntry,
  ChangePreview,
  CompanyDefinition,
  DomainCommand,
  UndoPreview,
  WorkspaceState,
  WorkspaceStore,
} from '../domain/contracts.js';
import { DomainError, requireDomain as check } from '../domain/errors.js';
import { JOB_MIGRATION, validateJobData } from '../jobs/store.js';
import {
  createTimeStore,
  TIME_MIGRATION,
  seedTimeCatalog,
  validateTimeData,
} from '../time/store.js';
import {
  emptyState,
  executeCommands,
  SCHEMA_VERSION,
  validateDefinition,
  validateState,
} from '../domain/model.js';

const MIGRATIONS = [
  `CREATE TABLE workspace_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0));
   INSERT INTO workspace_meta VALUES (1,0);
   CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, shortCode TEXT NOT NULL COLLATE NOCASE UNIQUE, description TEXT NOT NULL, color TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','archived')), version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
   CREATE TABLE departments (id TEXT PRIMARY KEY, companyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, name TEXT NOT NULL, description TEXT NOT NULL, managerId TEXT REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED);
   CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('agent','human')), instructions TEXT NOT NULL, responsibilities TEXT NOT NULL CHECK(json_valid(responsibilities)), departmentId TEXT REFERENCES departments(id) DEFERRABLE INITIALLY DEFERRED, managerId TEXT REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED, status TEXT NOT NULL CHECK(status IN ('active','archived')), version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
   CREATE TABLE assignments (id TEXT PRIMARY KEY, agentId TEXT NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED, companyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, isPrimary INTEGER NOT NULL CHECK(isPrimary IN (0,1)), startedAt TEXT NOT NULL, endedAt TEXT);
   CREATE UNIQUE INDEX active_assignment_pair ON assignments(agentId,companyId) WHERE endedAt IS NULL;
   CREATE UNIQUE INDEX active_primary_assignment ON assignments(agentId) WHERE endedAt IS NULL AND isPrimary=1;
   CREATE TABLE relationships (id TEXT PRIMARY KEY, fromCompanyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, toCompanyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, kind TEXT NOT NULL CHECK(kind IN ('ownership','collaboration')), percentage REAL CHECK(percentage IS NULL OR (percentage>0 AND percentage<=100)), description TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT);
   CREATE UNIQUE INDEX active_relationship_pair ON relationships(kind,fromCompanyId,toCompanyId) WHERE endedAt IS NULL;
   CREATE TABLE work (id TEXT PRIMARY KEY, companyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, agentId TEXT NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED, title TEXT NOT NULL, output TEXT NOT NULL, provenance TEXT NOT NULL CHECK(provenance IN ('manual','codex','buzz','slack')), status TEXT NOT NULL CHECK(status IN ('submitted','accepted','failed')), createdAt TEXT NOT NULL, durationMs INTEGER CHECK(durationMs IS NULL OR durationMs>=0), runId TEXT);
   CREATE TABLE changes (id TEXT PRIMARY KEY, previewId TEXT UNIQUE, action TEXT NOT NULL, summary TEXT NOT NULL, revision INTEGER NOT NULL UNIQUE, createdAt TEXT NOT NULL, beforeJson TEXT NOT NULL, afterJson TEXT NOT NULL, undone INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE previews (id TEXT PRIMARY KEY, baseRevision INTEGER NOT NULL, summary TEXT NOT NULL, changesJson TEXT NOT NULL, createdAt TEXT NOT NULL, afterJson TEXT NOT NULL, appliedChangeId TEXT REFERENCES changes(id));`,
  `CREATE UNIQUE INDEX unique_work_run ON work(runId) WHERE runId IS NOT NULL;
   CREATE INDEX work_company_date ON work(companyId,createdAt);
   CREATE INDEX agents_department ON agents(departmentId);
   CREATE INDEX assignments_company ON assignments(companyId,endedAt);
   CREATE INDEX changes_revision ON changes(revision);`,
  `CREATE TABLE integration_runs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, info TEXT NOT NULL CHECK(json_valid(info)), context TEXT NOT NULL CHECK(json_valid(context)));
   ALTER TABLE changes ADD COLUMN undoable INTEGER NOT NULL DEFAULT 1 CHECK(undoable IN (0,1));
   UPDATE changes SET undoable=0 WHERE action='change.undo' OR json_extract(beforeJson,'$.work') IS NOT json_extract(afterJson,'$.work');`,
  TIME_MIGRATION,
  JOB_MIGRATION,
];
function digest(sql: string) {
  return createHash('sha256').update(sql).digest('hex');
}
const databasePath = (dataDir: string) => join(resolve(dataDir), 'workspace.sqlite');
function prepareDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
}
function lockDirectory(dataDir: string): () => void {
  prepareDirectory(dataDir);
  const path = join(dataDir, 'workspace.lock');
  const token = randomUUID();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      writeFileSync(path, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
      return () => {
        try {
          if (JSON.parse(readFileSync(path, 'utf8')).token === token) rmSync(path);
        } catch {
          /* Preserve a replaced lock. */
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let existing: { pid?: number; token?: string };
      try {
        existing = JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        throw new DomainError(
          'WORKSPACE_BUSY',
          'The workspace lock cannot be read. Confirm no GitFlash server is running before removing workspace.lock.',
        );
      }
      if (Number.isSafeInteger(existing.pid) && Number(existing.pid) > 0) {
        try {
          process.kill(existing.pid!, 0);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ESRCH') {
            try {
              if (JSON.parse(readFileSync(path, 'utf8')).token === existing.token) rmSync(path);
            } catch {
              /* Another process may have recovered it. */
            }
            continue;
          }
        }
      }
      throw new DomainError(
        'WORKSPACE_BUSY',
        'This workspace is already open. Stop its GitFlash server before opening or restoring it.',
      );
    }
  }
  throw new DomainError(
    'WORKSPACE_BUSY',
    'Another process is opening this workspace. Try again after stopping it.',
  );
}
function vacuumBackup(db: DatabaseSync, path: string) {
  prepareDirectory(dirname(path));
  closeSync(openSync(path, 'wx', 0o600));
  try {
    db.prepare('VACUUM INTO ?').run(path);
  } catch (error) {
    rmSync(path, { force: true });
    throw error;
  }
}
function preUpgradeBackup(db: DatabaseSync, dataDir: string, currentVersion: number): string {
  const path = join(
    dataDir,
    'backups',
    `before-schema-${currentVersion + 1}-${Date.now()}-${randomUUID().slice(0, 8)}.sqlite`,
  );
  vacuumBackup(db, path);
  return path;
}
function initialize(db: DatabaseSync, dataDir: string) {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const currentVersion = Number(db.prepare('PRAGMA user_version').get()!.user_version);
  check(
    currentVersion <= SCHEMA_VERSION,
    'UPGRADE_REQUIRED',
    `This workspace uses schema ${currentVersion}; this GitFlash supports up to ${SCHEMA_VERSION}. Upgrade GitFlash before opening it.`,
  );
  if (currentVersion === 0) {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    check(
      tables.length === 0,
      'INVALID_DATABASE',
      'The selected database is not a recognized GitFlash workspace.',
    );
  } else {
    check(
      db.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get(),
      'INVALID_DATABASE',
      'Workspace migration journal is missing.',
    );
    const rows = db
      .prepare('SELECT version,checksum FROM schema_migrations ORDER BY version')
      .all();
    check(
      rows.length === currentVersion &&
        rows.every((r, i) => Number(r.version) === i + 1 && r.checksum === digest(MIGRATIONS[i]!)),
      'INVALID_DATABASE',
      'Workspace migration journal does not match this release. Preserve the database and use its compatible GitFlash version.',
    );
    validateDatabaseContents(db, currentVersion);
    if (currentVersion < SCHEMA_VERSION) preUpgradeBackup(db, dataDir, currentVersion);
  }
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, appliedAt TEXT NOT NULL);',
    );
    for (let i = currentVersion; i < MIGRATIONS.length; i += 1) {
      db.exec(MIGRATIONS[i]!);
      if (i === 3) seedTimeCatalog(db);
      db.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(
        i + 1,
        digest(MIGRATIONS[i]!),
        new Date().toISOString(),
      );
      db.exec(`PRAGMA user_version=${i + 1};`);
    }
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
}
function readSnapshot(db: DatabaseSync, schemaVersion = SCHEMA_VERSION): WorkspaceState {
  const state = emptyState();
  const meta = db.prepare('SELECT revision FROM workspace_meta WHERE id=1').get();
  check(
    meta && Number.isSafeInteger(meta.revision) && Number(meta.revision) >= 0,
    'INVALID_DATABASE',
    'Workspace revision metadata is missing or invalid. Restore a verified backup.',
  );
  state.revision = Number(meta.revision);
  state.companies = db
    .prepare('SELECT * FROM companies ORDER BY rowid')
    .all() as unknown as WorkspaceState['companies'];
  state.departments = db
    .prepare('SELECT * FROM departments ORDER BY rowid')
    .all() as unknown as WorkspaceState['departments'];
  state.agents = db
    .prepare('SELECT * FROM agents ORDER BY rowid')
    .all()
    .map((row) => ({
      ...row,
      responsibilities: JSON.parse(String(row.responsibilities)),
    })) as unknown as WorkspaceState['agents'];
  state.assignments = db
    .prepare('SELECT * FROM assignments ORDER BY rowid')
    .all()
    .map((row) => ({
      ...row,
      isPrimary: row.isPrimary === 1,
    })) as unknown as WorkspaceState['assignments'];
  state.relationships = db
    .prepare('SELECT * FROM relationships ORDER BY rowid')
    .all() as unknown as WorkspaceState['relationships'];
  state.work = db
    .prepare('SELECT * FROM work ORDER BY rowid')
    .all() as unknown as WorkspaceState['work'];
  state.history = db
    .prepare(
      `SELECT id,action,summary,revision,createdAt,undone,${schemaVersion >= 3 ? 'undoable' : '1 AS undoable'} FROM changes ORDER BY revision DESC LIMIT 200`,
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      action: String(row.action),
      summary: String(row.summary),
      revision: Number(row.revision),
      createdAt: String(row.createdAt),
      undoable: Number(row.revision) === state.revision && row.undone === 0 && row.undoable === 1,
    })) as AuditEntry[];
  return state;
}
function validateDatabaseContents(db: DatabaseSync, schemaVersion: number) {
  if (schemaVersion >= 4) validateTimeData(db);
  if (schemaVersion >= 5) validateJobData(db);
  check(
    db.prepare('PRAGMA foreign_key_check').all().length === 0,
    'INVALID_DATABASE',
    'Workspace contains broken entity references. Restore a verified backup.',
  );
  const state = readSnapshot(db, schemaVersion);
  if (state.companies.length)
    validateDefinition({
      schemaVersion: 1,
      name: 'Workspace integrity check',
      description: '',
      companies: state.companies,
      departments: state.departments,
      agents: state.agents,
      assignments: state.assignments,
      relationships: state.relationships,
    });
  else
    check(
      !state.departments.length &&
        !state.agents.length &&
        !state.assignments.length &&
        !state.relationships.length &&
        !state.work.length,
      'INVALID_DATABASE',
      'An empty workspace contains orphaned records.',
    );
  for (const work of state.work) {
    check(
      typeof work.title === 'string' &&
        !!work.title.trim() &&
        typeof work.output === 'string' &&
        !!work.output.trim() &&
        typeof work.createdAt === 'string' &&
        Number.isFinite(Date.parse(work.createdAt)),
      'INVALID_DATABASE',
      'A work record is invalid. Restore a verified backup.',
    );
  }
  validateState(state);
  if (schemaVersion >= 3) {
    for (const row of db
      .prepare('SELECT id, request_id, info, context FROM integration_runs')
      .all()) {
      const info: unknown = JSON.parse(String(row.info));
      const context: unknown = JSON.parse(String(row.context));
      check(
        info &&
          typeof info === 'object' &&
          !Array.isArray(info) &&
          context &&
          typeof context === 'object' &&
          !Array.isArray(context),
        'INVALID_DATABASE',
        'An execution ledger entry is invalid.',
      );
      const run = info as Record<string, unknown>;
      check(
        run.id === row.id &&
          run.requestId === row.request_id &&
          ['queued', 'running', 'completed', 'failed'].includes(String(run.status)) &&
          typeof run.output === 'string',
        'INVALID_DATABASE',
        'An execution ledger entry does not match its recorded task identity.',
      );
    }
  }
}
function writeSnapshot(db: DatabaseSync, state: WorkspaceState) {
  db.exec(
    'PRAGMA defer_foreign_keys=ON; DELETE FROM work; DELETE FROM relationships; DELETE FROM assignments; DELETE FROM agents; DELETE FROM departments; DELETE FROM companies;',
  );
  const specs: [string, string[], Record<string, unknown>[]][] = [
    [
      'companies',
      [
        'id',
        'name',
        'shortCode',
        'description',
        'color',
        'status',
        'version',
        'createdAt',
        'updatedAt',
      ],
      state.companies as unknown as Record<string, unknown>[],
    ],
    [
      'departments',
      ['id', 'companyId', 'name', 'description', 'managerId'],
      state.departments as unknown as Record<string, unknown>[],
    ],
    [
      'agents',
      [
        'id',
        'name',
        'role',
        'kind',
        'instructions',
        'responsibilities',
        'departmentId',
        'managerId',
        'status',
        'version',
        'createdAt',
        'updatedAt',
      ],
      state.agents as unknown as Record<string, unknown>[],
    ],
    [
      'assignments',
      ['id', 'agentId', 'companyId', 'isPrimary', 'startedAt', 'endedAt'],
      state.assignments as unknown as Record<string, unknown>[],
    ],
    [
      'relationships',
      [
        'id',
        'fromCompanyId',
        'toCompanyId',
        'kind',
        'percentage',
        'description',
        'startedAt',
        'endedAt',
      ],
      state.relationships as unknown as Record<string, unknown>[],
    ],
    [
      'work',
      [
        'id',
        'companyId',
        'agentId',
        'title',
        'output',
        'provenance',
        'status',
        'createdAt',
        'durationMs',
        'runId',
      ],
      state.work as unknown as Record<string, unknown>[],
    ],
  ];
  for (const [table, columns, rows] of specs) {
    const statement = db.prepare(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
    );
    for (const row of rows)
      statement.run(
        ...columns.map((c) =>
          c === 'responsibilities'
            ? JSON.stringify(row[c])
            : typeof row[c] === 'boolean'
              ? Number(row[c])
              : (row[c] as string | number | null),
        ),
      );
  }
  db.prepare('UPDATE workspace_meta SET revision=? WHERE id=1').run(state.revision);
}
function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = operation();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}
function assertRevision(baseRevision: number, state: WorkspaceState) {
  check(
    Number.isSafeInteger(baseRevision) && baseRevision >= 0,
    'INVALID_INPUT',
    'A valid workspace revision is required.',
  );
  check(
    baseRevision === state.revision,
    'STALE_PREVIEW',
    'The company changed since this preview. Refresh and preview your changes again.',
  );
}
function readUndoTarget(db: DatabaseSync, changeId: string, baseRevision: number) {
  const current = readSnapshot(db);
  assertRevision(baseRevision, current);
  check(
    typeof changeId === 'string' && changeId.length > 0,
    'INVALID_INPUT',
    'A change ID is required.',
  );
  const change = db
    .prepare('SELECT revision,undone,undoable,summary,beforeJson FROM changes WHERE id=?')
    .get(changeId);
  check(change, 'NOT_FOUND', 'Change not found.');
  check(
    Number(change.revision) === current.revision && change.undone === 0 && change.undoable === 1,
    'UNDO_UNAVAILABLE',
    'Only the latest configuration change can be undone. Recorded work and acceptance are permanent evidence.',
  );
  return {
    current,
    restored: JSON.parse(String(change.beforeJson)) as WorkspaceState,
    summary: `Undo: ${change.summary}`,
  };
}

/** Describe the actual inverse snapshot, including dated assignments and reporting references. */
function undoEffects(current: WorkspaceState, restored: WorkspaceState): string[] {
  type ConfigRow = { id: string } & Record<string, unknown>;
  const collections = [
    ['companies', 'company'],
    ['departments', 'department'],
    ['agents', 'agent'],
    ['assignments', 'assignment'],
    ['relationships', 'relationship'],
  ] as const;
  const labels: Record<string, string> = {
    shortCode: 'Short code',
    companyId: 'Company',
    agentId: 'Agent',
    departmentId: 'Department',
    managerId: 'Manager',
    isPrimary: 'Primary',
    fromCompanyId: 'From company',
    toCompanyId: 'To company',
    startedAt: 'Started at',
    endedAt: 'Ended at',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
  };
  const fieldLabel = (field: string) =>
    labels[field] ?? `${field[0]!.toUpperCase()}${field.slice(1)}`;
  const valueLabel = (field: string, value: unknown, state: WorkspaceState): string => {
    if (
      typeof value === 'string' &&
      [
        'companyId',
        'fromCompanyId',
        'toCompanyId',
        'agentId',
        'managerId',
        'departmentId',
      ].includes(field)
    ) {
      const records =
        field === 'departmentId'
          ? state.departments
          : ['agentId', 'managerId'].includes(field)
            ? state.agents
            : state.companies;
      const target = records.find((row) => row.id === value);
      if (target) return `${JSON.stringify(target.name)} [${value}]`;
    }
    return JSON.stringify(value) ?? '(missing)';
  };
  const identity = (kind: string, row: ConfigRow, state: WorkspaceState) => {
    const name =
      typeof row.name === 'string'
        ? JSON.stringify(row.name)
        : kind === 'assignment'
          ? `${valueLabel('agentId', row.agentId, state)} → ${valueLabel('companyId', row.companyId, state)}`
          : `${String(row.kind)}: ${valueLabel('fromCompanyId', row.fromCompanyId, state)} → ${valueLabel('toCompanyId', row.toCompanyId, state)}`;
    return `${kind} ${name} [${row.id}]`;
  };
  const details = (row: ConfigRow, state: WorkspaceState) =>
    Object.keys(row)
      .filter((field) => field !== 'id')
      .map((field) => `${fieldLabel(field)}: ${valueLabel(field, row[field], state)}`)
      .join('; ');
  const effects: string[] = [];
  for (const [collection, kind] of collections) {
    const present = new Map(
      (current[collection] as unknown as ConfigRow[]).map((row) => [row.id, row]),
    );
    const target = new Map(
      (restored[collection] as unknown as ConfigRow[]).map((row) => [row.id, row]),
    );
    for (const [id, row] of present) {
      const previous = target.get(id);
      if (!previous) {
        effects.push(`Remove ${identity(kind, row, current)} — ${details(row, current)}`);
        continue;
      }
      const fields = [...new Set([...Object.keys(row), ...Object.keys(previous)])].filter(
        (field) => field !== 'id' && JSON.stringify(row[field]) !== JSON.stringify(previous[field]),
      );
      if (fields.length)
        effects.push(
          `Restore ${identity(kind, row, current)} — ${fields
            .map(
              (field) =>
                `${fieldLabel(field)}: ${valueLabel(field, row[field], current)} → ${valueLabel(field, previous[field], restored)}`,
            )
            .join('; ')}`,
        );
    }
    for (const [id, row] of target)
      if (!present.has(id))
        effects.push(
          `Restore removed ${identity(kind, row, restored)} — ${details(row, restored)}`,
        );
  }
  return effects;
}
function verifyBackup(path: string): DatabaseSync {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(path, { readOnly: true });
  } catch {
    throw new DomainError('INVALID_BACKUP', 'The file is not a readable SQLite backup.');
  }
  try {
    check(
      db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok',
      'INVALID_BACKUP',
      'Backup integrity check failed.',
    );
    check(
      db.prepare('PRAGMA foreign_key_check').all().length === 0,
      'INVALID_BACKUP',
      'Backup contains broken entity references.',
    );
    const v = Number(db.prepare('PRAGMA user_version').get()?.user_version);
    check(
      v >= 1 && v <= SCHEMA_VERSION,
      'INVALID_BACKUP',
      'Backup schema is unsupported. Use the matching or newer GitFlash version.',
    );
    const journal = db
      .prepare('SELECT version,checksum FROM schema_migrations ORDER BY version')
      .all();
    check(
      journal.length === v &&
        journal.every(
          (r, i) => Number(r.version) === i + 1 && r.checksum === digest(MIGRATIONS[i]!),
        ),
      'INVALID_BACKUP',
      'Backup migration journal is not recognized.',
    );
    validateDatabaseContents(db, v);
    return db;
  } catch (error) {
    db.close();
    if (error instanceof DomainError && error.code === 'INVALID_BACKUP') throw error;
    throw new DomainError(
      'INVALID_BACKUP',
      'The file is not a valid GitFlash workspace backup. Its entity or execution records could not be verified.',
    );
  }
}

export function createWorkspaceStore(dataDir: string): WorkspaceStore {
  dataDir = resolve(dataDir);
  const unlock = lockDirectory(dataDir);
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(databasePath(dataDir));
    chmodSync(databasePath(dataDir), 0o600);
    initialize(db, dataDir);
  } catch (error) {
    try {
      db!.close();
    } catch {
      /* Initialization may not have opened SQLite. */
    }
    unlock();
    throw error;
  }
  let closed = false;
  const ensureOpen = () => check(!closed, 'STORE_CLOSED', 'This workspace has been closed.');
  const time = createTimeStore(db, () => readSnapshot(db));
  return {
    time: {
      snapshot() {
        ensureOpen();
        return time.snapshot();
      },
      mutate(command, source) {
        ensureOpen();
        return time.mutate(command, source);
      },
    },
    snapshot() {
      ensureOpen();
      return readSnapshot(db);
    },
    preview(commands: DomainCommand[], baseRevision: number, summary?: string): ChangePreview {
      ensureOpen();
      return transaction(db, () => {
        const before = readSnapshot(db);
        assertRevision(baseRevision, before);
        const createdAt = new Date().toISOString();
        const result = executeCommands(before, commands, createdAt);
        check(
          summary === undefined ||
            (typeof summary === 'string' && summary.trim().length > 0 && summary.length <= 500),
          'INVALID_INPUT',
          'Change summary must contain 1–500 characters.',
        );
        const preview: ChangePreview = {
          id: randomUUID(),
          baseRevision,
          summary: summary?.trim() ?? result.changes.join('; ').slice(0, 500),
          changes: result.changes,
          createdAt,
        };
        db.prepare('INSERT INTO previews VALUES (?,?,?,?,?,?,NULL)').run(
          preview.id,
          baseRevision,
          preview.summary,
          JSON.stringify(preview.changes),
          createdAt,
          JSON.stringify({ ...result.state, history: [] }),
        );
        return preview;
      });
    },
    apply(previewId: string): ApplyResult {
      ensureOpen();
      return transaction(db, () => {
        const preview = db.prepare('SELECT * FROM previews WHERE id=?').get(previewId);
        check(preview, 'NOT_FOUND', 'Preview not found. Create a new preview.');
        const before = readSnapshot(db);
        if (preview.appliedChangeId)
          return { state: before, changeId: String(preview.appliedChangeId), replayed: true };
        assertRevision(Number(preview.baseRevision), before);
        const after = JSON.parse(String(preview.afterJson)) as WorkspaceState;
        after.revision = before.revision + 1;
        const changeId = randomUUID();
        writeSnapshot(db, after);
        const changesWork = JSON.stringify(before.work) !== JSON.stringify(after.work);
        db.prepare(
          'INSERT INTO changes (id,previewId,action,summary,revision,createdAt,beforeJson,afterJson,undoable) VALUES (?,?,?,?,?,?,?,?,?)',
        ).run(
          changeId,
          previewId,
          changesWork ? 'work.change' : 'changes.apply',
          String(preview.summary),
          after.revision,
          new Date().toISOString(),
          JSON.stringify({ ...before, history: [] }),
          JSON.stringify(after),
          changesWork ? 0 : 1,
        );
        db.prepare('UPDATE previews SET appliedChangeId=? WHERE id=?').run(changeId, previewId);
        return { state: readSnapshot(db), changeId, replayed: false };
      });
    },
    previewUndo(changeId: string, baseRevision: number): UndoPreview {
      ensureOpen();
      // This is a read-only description, not a persisted authorization token. The
      // caller confirms with the same changeId/baseRevision; undo revalidates both
      // inside its write transaction before restoring any configuration.
      const { current, restored, summary } = readUndoTarget(db, changeId, baseRevision);
      return { changeId, baseRevision, summary, changes: undoEffects(current, restored) };
    },
    undo(changeId: string, baseRevision: number): WorkspaceState {
      ensureOpen();
      return transaction(db, () => {
        const { current, restored, summary } = readUndoTarget(db, changeId, baseRevision);
        restored.revision = current.revision + 1;
        writeSnapshot(db, restored);
        db.prepare('UPDATE changes SET undone=1 WHERE id=?').run(changeId);
        db.prepare(
          'INSERT INTO changes (id,action,summary,revision,createdAt,beforeJson,afterJson,undoable) VALUES (?,?,?,?,?,?,?,0)',
        ).run(
          randomUUID(),
          'change.undo',
          summary,
          restored.revision,
          new Date().toISOString(),
          JSON.stringify({ ...current, history: [] }),
          JSON.stringify(restored),
        );
        return readSnapshot(db);
      });
    },
    exportDefinition(): CompanyDefinition {
      ensureOpen();
      const s = readSnapshot(db);
      return {
        schemaVersion: 1,
        name: s.companies[0]?.name ?? 'GitFlash company',
        description:
          'Company configuration exported from GitFlash. Runtime credentials and work outputs are not included.',
        companies: s.companies,
        departments: s.departments,
        agents: s.agents,
        assignments: s.assignments,
        relationships: s.relationships,
      };
    },
    async backup(destination: string): Promise<void> {
      ensureOpen();
      destination = resolve(destination);
      check(
        destination !== databasePath(dataDir) && !existsSync(destination),
        'BACKUP_EXISTS',
        'Choose a new backup filename; existing files are not overwritten.',
      );
      prepareDirectory(dirname(destination));
      const temp = `${destination}.${randomUUID()}.tmp`;
      closeSync(openSync(temp, 'wx', 0o600));
      try {
        await sqliteBackup(db, temp);
        const verified = verifyBackup(temp);
        verified.close();
        linkSync(temp, destination);
      } finally {
        rmSync(temp, { force: true });
      }
    },
    close() {
      if (closed) return;
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        db.close();
        closed = true;
      } finally {
        if (closed) unlock();
      }
    },
  };
}

/** Stop the server first. Restore checks the file before replacing anything and retains a recovery backup. */
export async function restoreWorkspaceBackup(dataDir: string, source: string): Promise<void> {
  dataDir = resolve(dataDir);
  source = resolve(source);
  check(source !== databasePath(dataDir), 'INVALID_BACKUP', 'Choose a separate backup file.');
  const unlock = lockDirectory(dataDir);
  const temp = join(dataDir, `.restore-${randomUUID()}.sqlite`);
  try {
    const candidate = verifyBackup(source);
    closeSync(openSync(temp, 'wx', 0o600));
    try {
      await sqliteBackup(candidate, temp);
    } finally {
      candidate.close();
    }
    if (existsSync(databasePath(dataDir))) {
      let original: DatabaseSync | null = null;
      try {
        original = new DatabaseSync(databasePath(dataDir));
        vacuumBackup(
          original,
          join(
            dataDir,
            'backups',
            `before-restore-${Date.now()}-${randomUUID().slice(0, 8)}.sqlite`,
          ),
        );
        original.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // An unreadable current database must not prevent recovery from a verified backup.
        // Preserve every original byte, including crash sidecars, without calling it a valid backup.
        if (original) {
          original.close();
          original = null;
        }
        const recovery = join(
          dataDir,
          'backups',
          `before-restore-unreadable-${Date.now()}-${randomUUID().slice(0, 8)}`,
        );
        prepareDirectory(recovery);
        for (const suffix of ['', '-wal', '-shm']) {
          const file = `${databasePath(dataDir)}${suffix}`;
          if (existsSync(file)) {
            const target = join(recovery, `workspace.sqlite${suffix}`);
            copyFileSync(file, target, constants.COPYFILE_EXCL);
            chmodSync(target, 0o600);
          }
        }
      } finally {
        original?.close();
      }
    }
    rmSync(`${databasePath(dataDir)}-wal`, { force: true });
    rmSync(`${databasePath(dataDir)}-shm`, { force: true });
    renameSync(temp, databasePath(dataDir));
    chmodSync(databasePath(dataDir), 0o600);
  } finally {
    rmSync(temp, { force: true });
    unlock();
  }
}
