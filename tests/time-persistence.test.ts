import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createWorkspaceStore, restoreWorkspaceBackup } from '../src/db/store.js';
import type { DomainCommand, WorkspaceStore } from '../src/domain/contracts.js';
import type { TimeCommand, TimeEntryInput } from '../src/time/contracts.js';

const directories: string[] = [];
const stores: WorkspaceStore[] = [];
const oldTables = [
  'workspace_meta',
  'companies',
  'departments',
  'agents',
  'assignments',
  'relationships',
  'work',
  'changes',
  'previews',
  'integration_runs',
  'schema_migrations',
];
const timeTables = ['time_meta', 'time_entries', 'time_history', 'time_catalog', 'time_requests'];
// Exact schema-3 SQL from the accepted 58414a8 source, not the new migration under test.
const LEGACY_MIGRATIONS: string[] = [
  "CREATE TABLE workspace_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0));\n   INSERT INTO workspace_meta VALUES (1,0);\n   CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, shortCode TEXT NOT NULL COLLATE NOCASE UNIQUE, description TEXT NOT NULL, color TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','archived')), version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);\n   CREATE TABLE departments (id TEXT PRIMARY KEY, companyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, name TEXT NOT NULL, description TEXT NOT NULL, managerId TEXT REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED);\n   CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('agent','human')), instructions TEXT NOT NULL, responsibilities TEXT NOT NULL CHECK(json_valid(responsibilities)), departmentId TEXT REFERENCES departments(id) DEFERRABLE INITIALLY DEFERRED, managerId TEXT REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED, status TEXT NOT NULL CHECK(status IN ('active','archived')), version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);\n   CREATE TABLE assignments (id TEXT PRIMARY KEY, agentId TEXT NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED, companyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, isPrimary INTEGER NOT NULL CHECK(isPrimary IN (0,1)), startedAt TEXT NOT NULL, endedAt TEXT);\n   CREATE UNIQUE INDEX active_assignment_pair ON assignments(agentId,companyId) WHERE endedAt IS NULL;\n   CREATE UNIQUE INDEX active_primary_assignment ON assignments(agentId) WHERE endedAt IS NULL AND isPrimary=1;\n   CREATE TABLE relationships (id TEXT PRIMARY KEY, fromCompanyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, toCompanyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, kind TEXT NOT NULL CHECK(kind IN ('ownership','collaboration')), percentage REAL CHECK(percentage IS NULL OR (percentage>0 AND percentage<=100)), description TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT);\n   CREATE UNIQUE INDEX active_relationship_pair ON relationships(kind,fromCompanyId,toCompanyId) WHERE endedAt IS NULL;\n   CREATE TABLE work (id TEXT PRIMARY KEY, companyId TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, agentId TEXT NOT NULL REFERENCES agents(id) DEFERRABLE INITIALLY DEFERRED, title TEXT NOT NULL, output TEXT NOT NULL, provenance TEXT NOT NULL CHECK(provenance IN ('manual','codex','buzz','slack')), status TEXT NOT NULL CHECK(status IN ('submitted','accepted','failed')), createdAt TEXT NOT NULL, durationMs INTEGER CHECK(durationMs IS NULL OR durationMs>=0), runId TEXT);\n   CREATE TABLE changes (id TEXT PRIMARY KEY, previewId TEXT UNIQUE, action TEXT NOT NULL, summary TEXT NOT NULL, revision INTEGER NOT NULL UNIQUE, createdAt TEXT NOT NULL, beforeJson TEXT NOT NULL, afterJson TEXT NOT NULL, undone INTEGER NOT NULL DEFAULT 0);\n   CREATE TABLE previews (id TEXT PRIMARY KEY, baseRevision INTEGER NOT NULL, summary TEXT NOT NULL, changesJson TEXT NOT NULL, createdAt TEXT NOT NULL, afterJson TEXT NOT NULL, appliedChangeId TEXT REFERENCES changes(id));",
  'CREATE UNIQUE INDEX unique_work_run ON work(runId) WHERE runId IS NOT NULL;\n   CREATE INDEX work_company_date ON work(companyId,createdAt);\n   CREATE INDEX agents_department ON agents(departmentId);\n   CREATE INDEX assignments_company ON assignments(companyId,endedAt);\n   CREATE INDEX changes_revision ON changes(revision);',
  "CREATE TABLE integration_runs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, info TEXT NOT NULL CHECK(json_valid(info)), context TEXT NOT NULL CHECK(json_valid(context)));\n   ALTER TABLE changes ADD COLUMN undoable INTEGER NOT NULL DEFAULT 1 CHECK(undoable IN (0,1));\n   UPDATE changes SET undoable=0 WHERE action='change.undo' OR json_extract(beforeJson,'$.work') IS NOT json_extract(afterJson,'$.work');",
];

function directory() {
  const path = mkdtempSync(join(tmpdir(), 'gitflash-time-persistence-'));
  directories.push(path);
  return path;
}
function open(path = directory()) {
  const store = createWorkspaceStore(path);
  stores.push(store);
  return store;
}
function apply(store: WorkspaceStore, commands: DomainCommand[]) {
  return store.apply(store.preview(commands, store.snapshot().revision).id);
}
const company = (name: string): DomainCommand => ({
  type: 'company.create',
  input: { name, shortCode: name, description: '', color: '#123456' },
});
function setup() {
  const dir = directory();
  const store = open(dir);
  const cs = apply(store, [company('A'), company('B'), company('C')]).state.companies;
  const state = apply(store, [
    {
      type: 'agent.create',
      companyId: cs[0]!.id,
      input: {
        name: 'Shared analyst',
        role: 'Analyst',
        kind: 'agent',
        instructions: 'Return evidence.',
        responsibilities: ['Analyze'],
        departmentId: null,
        managerId: null,
      },
    },
  ]).state;
  return { dir, store, a: cs[0]!.id, b: cs[1]!.id, c: cs[2]!.id, agentId: state.agents[0]!.id };
}
function entry(
  agentId: string,
  companyId: string,
  patch: Partial<TimeEntryInput> = {},
): TimeEntryInput {
  return {
    agentId,
    companyId,
    date: '2020-01-02',
    hours: 0.1,
    description: 'Synthetic delivery evidence',
    ...patch,
  };
}
function create(store: WorkspaceStore, requestId: string, input: TimeEntryInput) {
  return store.time.mutate({ type: 'entry.create', requestId, input }, 'manual');
}
function saveCatalog(
  store: WorkspaceStore,
  code: string,
  hours: number,
  expectedVersion: number | null = null,
) {
  return store.time.mutate(
    {
      type: 'catalog.save',
      requestId: `catalog-${code}-${hours}-${expectedVersion}`,
      expectedVersion,
      input: { code, name: `Synthetic ${code}`, category: 'Test delivery', referenceHours: hours },
    },
    'manual',
  );
}
function rows(dir: string, tables: string[]) {
  const db = new DatabaseSync(join(dir, 'workspace.sqlite'), { readOnly: true });
  try {
    return Object.fromEntries(
      tables.map((table) => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]),
    );
  } finally {
    db.close();
  }
}
function refuses(store: WorkspaceStore, command: TimeCommand, code: string) {
  const before = store.time.snapshot();
  expect(() => store.time.mutate(command, 'manual')).toThrow(expect.objectContaining({ code }));
  expect(store.time.snapshot()).toEqual(before);
}
afterEach(() => {
  vi.useRealTimers();
  for (const store of stores.splice(0)) store.close();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('independent delivery-hours persistence', () => {
  it('stores exact tenths, permits more than 24 hours a day, and enforces the 500-hour entry boundary', () => {
    const { store, a, agentId } = setup();
    create(store, 'decimal-one', entry(agentId, a, { hours: 0.1 }));
    create(store, 'decimal-two', entry(agentId, a, { hours: 0.2 }));
    expect(
      store.time
        .snapshot()
        .entries.map((e) => e.tenths)
        .sort(),
    ).toEqual([1, 2]);
    expect(store.time.snapshot().entries.reduce((sum, e) => sum + e.tenths, 0)).toBe(3);
    create(store, 'forty-hour-entry', entry(agentId, a, { hours: 40 }));
    create(store, 'eighty-hour-entry', entry(agentId, a, { hours: 80 }));
    create(store, 'maximum-hour-entry', entry(agentId, a, { hours: 500 }));
    expect(store.time.snapshot().entries.reduce((sum, e) => sum + e.tenths, 0)).toBe(6203);
    for (const [index, hours] of [0, -0.1, 0.15, 500.1, Infinity, NaN].entries()) {
      refuses(
        store,
        {
          type: 'entry.create',
          requestId: `invalid-hours-${index}`,
          input: entry(agentId, a, { hours }),
        },
        'INVALID_INPUT',
      );
    }
  });

  it('captures catalog, explicit and labelled fallback bases with one rounding step', () => {
    const { store, a, agentId } = setup();
    saveCatalog(store, 'TEST-25', 2.5);
    const catalog = create(
      store,
      'catalog-five-hours',
      entry(agentId, a, { hours: undefined, deliverable: 'TEST-25', quantity: 2 }),
    );
    expect(catalog.entry).toMatchObject({
      tenths: 50,
      basis: { kind: 'catalog', catalogCode: 'test-25', referenceTenths: 25, quantity: 2 },
    });
    const explicit = create(
      store,
      'explicit-overrides',
      entry(agentId, a, { hours: 0.7, deliverable: 'TEST-25', quantity: 2 }),
    );
    expect(explicit.entry).toMatchObject({ tenths: 7, basis: { kind: 'explicit' } });
    const fallback = create(
      store,
      'unknown-fallback',
      entry(agentId, a, { hours: undefined, deliverable: 'UNMATCHED-TEST-REFERENCE', quantity: 2 }),
    );
    expect(fallback.entry).toMatchObject({
      tenths: 160,
      basis: {
        kind: 'fallback',
        requestedDeliverable: 'UNMATCHED-TEST-REFERENCE',
        catalogCode: null,
        referenceTenths: 80,
        quantity: 2,
      },
    });
    expect(
      create(
        store,
        'round-once',
        entry(agentId, a, { hours: undefined, deliverable: 'TEST-25', quantity: 1.25 }),
      ).entry?.tenths,
    ).toBe(31);
    for (const hours of [40, 80]) {
      saveCatalog(store, `TEST-${hours}`, hours);
      expect(
        create(
          store,
          `large-catalog-${hours}`,
          entry(agentId, a, { hours: undefined, deliverable: `TEST-${hours}` }),
        ).entry?.tenths,
      ).toBe(hours * 10);
    }
    saveCatalog(store, 'TEST-FIVE', 5);
    expect(
      create(
        store,
        'derived-maximum',
        entry(agentId, a, { hours: undefined, deliverable: 'TEST-FIVE', quantity: 100 }),
      ).entry?.tenths,
    ).toBe(5000);
    for (const [requestId, patch] of [
      ['quantity-too-large', { hours: undefined, deliverable: 'TEST-FIVE', quantity: 100.1 }],
      ['derived-too-large', { hours: undefined, deliverable: 'TEST-80', quantity: 7 }],
      ['derived-rounds-zero', { hours: undefined, deliverable: 'TEST-25', quantity: 0.001 }],
      ['no-calculation-basis', { hours: undefined }],
    ] as [string, Partial<TimeEntryInput>][]) {
      refuses(
        store,
        { type: 'entry.create', requestId, input: entry(agentId, a, patch) },
        'INVALID_INPUT',
      );
    }
  });

  it('returns the original receipt after catalog changes and restart, and rejects a conflicting key', () => {
    const { store, dir, a, agentId } = setup();
    const saved = saveCatalog(store, 'TEST-REPLAY', 2.5);
    const command: TimeCommand = {
      type: 'entry.create',
      requestId: 'durable-replay-key',
      input: entry(agentId, a, { hours: undefined, deliverable: 'TEST-REPLAY', quantity: 2 }),
    };
    const original = store.time.mutate(command, 'agent');
    saveCatalog(store, 'TEST-REPLAY', 9, saved.catalog!.version);
    const before = rows(dir, timeTables);
    expect(store.time.mutate(command, 'agent')).toEqual(original);
    expect(rows(dir, timeTables)).toEqual(before);
    expect(() =>
      store.time.mutate({ ...command, input: { ...command.input, hours: 1 } }, 'agent'),
    ).toThrow(expect.objectContaining({ code: 'CONFLICT' }));
    expect(rows(dir, timeTables)).toEqual(before);
    store.close();
    const restarted = open(dir);
    expect(restarted.time.mutate(command, 'agent')).toEqual(original);
    expect(restarted.time.snapshot().entries[0]).toEqual(original.entry);
    expect(rows(dir, timeTables)).toEqual(before);
  });

  it('preserves original basis on a description correction and retains correction/void history', () => {
    const { store, a, agentId } = setup();
    const catalog = saveCatalog(store, 'TEST-HISTORY', 2.5);
    const original = create(
      store,
      'history-original',
      entry(agentId, a, { hours: undefined, deliverable: 'TEST-HISTORY', quantity: 2 }),
    ).entry!;
    saveCatalog(store, 'TEST-HISTORY', 8, catalog.catalog!.version);
    const corrected = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'history-correction',
        id: original.id,
        expectedVersion: original.version,
        input: { description: 'Corrected description' },
      },
      'manual',
    ).entry!;
    expect(corrected).toMatchObject({
      tenths: 50,
      description: 'Corrected description',
      version: original.version + 1,
      basis: original.basis,
    });
    refuses(
      store,
      {
        type: 'entry.update',
        requestId: 'stale-correction',
        id: original.id,
        expectedVersion: original.version,
        input: { hours: 0.3 },
      },
      'CONFLICT',
    );
    const voided = store.time.mutate(
      {
        type: 'entry.void',
        requestId: 'history-void',
        id: original.id,
        expectedVersion: corrected.version,
        reason: 'Duplicate delivery entered in error',
      },
      'manual',
    ).entry!;
    expect(voided).toMatchObject({
      status: 'void',
      voidReason: 'Duplicate delivery entered in error',
      tenths: 50,
      basis: original.basis,
    });
    expect(
      store.time
        .snapshot()
        .entries.filter((e) => e.status === 'booked')
        .reduce((sum, e) => sum + e.tenths, 0),
    ).toBe(0);
    const history = store.time.snapshot().history.filter((h) => h.entryId === original.id);
    expect(history).toHaveLength(3);
    expect(history.find((h) => h.action === 'entry.create')).toMatchObject({
      before: null,
      after: original,
    });
    expect(history.find((h) => h.action === 'entry.update')).toMatchObject({
      before: original,
      after: corrected,
    });
    expect(history.find((h) => h.action === 'entry.void')).toMatchObject({
      before: corrected,
      after: voided,
    });
    refuses(
      store,
      {
        type: 'entry.update',
        requestId: 'edit-void-refused',
        id: original.id,
        expectedVersion: voided.version,
        input: { hours: 1 },
      },
      'CONFLICT',
    );
  });

  it('removes a local override without rewriting the captured booking basis or catalog history', () => {
    const { store, a, agentId } = setup();
    const bundled = store.time.snapshot().catalog.find((item) => item.origin === 'bundled')!;
    expect(bundled).toBeDefined();
    const override = saveCatalog(store, bundled.code, 2.5, bundled.version).catalog!;
    const booked = create(
      store,
      'override-booking',
      entry(agentId, a, { hours: undefined, deliverable: bundled.code, quantity: 2 }),
    ).entry!;
    expect(booked).toMatchObject({
      tenths: 50,
      basis: { catalogCode: bundled.code, catalogVersion: override.version, referenceTenths: 25 },
    });
    const removed = store.time.mutate(
      {
        type: 'catalog.remove',
        requestId: 'remove-bundled-override',
        code: bundled.code,
        expectedVersion: override.version,
      },
      'manual',
    );
    expect(removed.catalog).toMatchObject({
      code: bundled.code,
      origin: 'bundled',
      referenceTenths: bundled.referenceTenths,
    });
    expect(store.time.snapshot().entries.find((item) => item.id === booked.id)).toEqual(booked);
    expect(
      store.time
        .snapshot()
        .history.filter((item) => item.catalogCode === bundled.code)
        .map((item) => item.action)
        .sort(),
    ).toEqual(['catalog.remove', 'catalog.save']);
    const local = saveCatalog(store, 'TEST-LOCAL-REMOVE', 1).catalog!;
    store.time.mutate(
      {
        type: 'catalog.remove',
        requestId: 'remove-local-item',
        code: local.code,
        expectedVersion: local.version,
      },
      'manual',
    );
    expect(store.time.snapshot().catalog.some((item) => item.code === local.code)).toBe(false);
    expect(store.time.snapshot().entries.find((item) => item.id === booked.id)).toEqual(booked);
  });

  it('corrects quantity against captured reference hours and changes basis only deliberately', () => {
    const { store, a, agentId } = setup();
    const firstCatalog = saveCatalog(store, 'TEST-CAPTURED-QUANTITY', 2.5).catalog!;
    const original = create(
      store,
      'captured-quantity-original',
      entry(agentId, a, { hours: undefined, deliverable: firstCatalog.code, quantity: 2 }),
    ).entry!;
    saveCatalog(store, firstCatalog.code, 8, firstCatalog.version);
    const quantityEdit = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'captured-quantity-three',
        id: original.id,
        expectedVersion: original.version,
        input: { quantity: 3 },
      },
      'manual',
    ).entry!;
    expect(quantityEdit).toMatchObject({
      tenths: 75,
      basis: {
        kind: 'catalog',
        referenceTenths: 25,
        catalogVersion: firstCatalog.version,
        quantity: 3,
      },
    });
    const resent = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'captured-full-form-resend',
        id: original.id,
        expectedVersion: quantityEdit.version,
        input: {
          deliverable: firstCatalog.code,
          hours: 7.5,
          quantity: 3,
          description: 'Resent existing form values',
        },
      },
      'manual',
    ).entry!;
    expect(resent).toMatchObject({ tenths: 75, basis: quantityEdit.basis });
    const explicit = create(
      store,
      'explicit-quantity-original',
      entry(agentId, a, { hours: 0.7, deliverable: firstCatalog.code, quantity: 2 }),
    ).entry!;
    const explicitEdit = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'explicit-quantity-three',
        id: explicit.id,
        expectedVersion: explicit.version,
        input: { quantity: 3 },
      },
      'manual',
    ).entry!;
    expect(explicitEdit).toMatchObject({ tenths: 7, basis: { kind: 'explicit', quantity: 3 } });
    const differentCatalog = saveCatalog(store, 'TEST-DELIBERATE-REFERENCE', 4).catalog!;
    const explicitNewCode = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'new-code-with-explicit-same-hours',
        id: explicit.id,
        expectedVersion: explicitEdit.version,
        input: { deliverable: differentCatalog.code, hours: 0.7 },
      },
      'manual',
    ).entry!;
    expect(explicitNewCode).toMatchObject({
      tenths: 7,
      basis: { kind: 'explicit', requestedDeliverable: differentCatalog.code },
    });
    const reclassified = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'deliberate-new-deliverable',
        id: original.id,
        expectedVersion: resent.version,
        input: { deliverable: differentCatalog.code },
      },
      'manual',
    ).entry!;
    expect(reclassified).toMatchObject({
      tenths: 120,
      basis: {
        kind: 'catalog',
        catalogCode: differentCatalog.code,
        referenceTenths: 40,
        quantity: 3,
      },
    });
    const changedHours = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'deliberate-explicit-hours',
        id: original.id,
        expectedVersion: reclassified.version,
        input: { hours: 0.2 },
      },
      'manual',
    ).entry!;
    expect(changedHours).toMatchObject({ tenths: 2, basis: { kind: 'explicit' } });
  });

  it('keeps the decimal half boundary 10h × 1.005 = 10.1h valid through backup and durable replay', async () => {
    const { store, dir, a, agentId } = setup();
    const catalog = saveCatalog(store, 'TEST-DECIMAL-HALF', 10).catalog!;
    const command: TimeCommand = {
      type: 'entry.create',
      requestId: 'decimal-half-replay',
      input: entry(agentId, a, { hours: undefined, deliverable: catalog.code, quantity: 1.005 }),
    };
    const receipt = store.time.mutate(command, 'agent');
    expect(receipt.entry).toMatchObject({
      tenths: 101,
      basis: {
        kind: 'catalog',
        referenceTenths: 100,
        quantity: 1.005,
        catalogVersion: catalog.version,
      },
    });
    saveCatalog(store, catalog.code, 12, catalog.version);
    expect(store.time.mutate(command, 'agent')).toEqual(receipt);
    const before = rows(dir, timeTables);
    const backup = join(dir, 'decimal-boundary.sqlite');
    await store.backup(backup);
    store.close();
    await restoreWorkspaceBackup(dir, backup);
    const restored = open(dir);
    expect(rows(dir, timeTables)).toEqual(before);
    expect(restored.time.mutate(command, 'agent')).toEqual(receipt);
    expect(restored.time.snapshot().entries[0]?.tenths).toBe(101);
  });

  it('supports explicit shared and historical membership without moving prior booked identities', () => {
    const { store, a, b, c, agentId } = setup();
    apply(store, [
      { type: 'assignment.add', agentId, companyId: b },
      { type: 'assignment.primary', agentId, companyId: b },
    ]);
    const historic = store
      .snapshot()
      .assignments.find((x) => x.agentId === agentId && x.companyId === a && x.endedAt === null)!;
    apply(store, [{ type: 'assignment.end', id: historic.id }]);
    const aEntry = create(store, 'historical-company-a', entry(agentId, a, { hours: 0.1 })).entry!;
    const bEntry = create(
      store,
      'implicit-primary-b',
      entry(agentId, b, { companyId: undefined, hours: 0.2 }),
    ).entry!;
    expect(aEntry.companyId).toBe(a);
    expect(bEntry.companyId).toBe(b);
    refuses(
      store,
      { type: 'entry.create', requestId: 'wrong-company-refused', input: entry(agentId, c) },
      'NO_ASSIGNMENT',
    );
    apply(store, [
      { type: 'agent.archive', id: agentId },
      { type: 'company.archive', id: a },
    ]);
    expect(store.time.snapshot().entries.find((e) => e.id === aEntry.id)).toEqual(aEntry);
    expect(store.time.snapshot().entries.find((e) => e.id === bEntry.id)).toEqual(bEntry);
    refuses(
      store,
      {
        type: 'entry.create',
        requestId: 'no-primary-refused',
        input: entry(agentId, b, { companyId: undefined }),
      },
      'AMBIGUOUS_COMPANY',
    );
    refuses(
      store,
      { type: 'entry.create', requestId: 'archived-target-refused', input: entry(agentId, a) },
      'ARCHIVED_ENTITY',
    );
    const corrected = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'historical-archived-correction',
        id: aEntry.id,
        expectedVersion: aEntry.version,
        input: { hours: 0.3 },
      },
      'manual',
    ).entry!;
    expect(corrected).toMatchObject({
      companyId: a,
      agentId,
      companyName: aEntry.companyName,
      agentName: aEntry.agentName,
      tenths: 3,
    });
  });

  it('uses strict real dates and the saved IANA zone for future dates without moving booked dates', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-07T23:30:00.000Z'));
    const { store, a, agentId } = setup();
    expect(store.time.snapshot()).toMatchObject({ timezone: 'UTC', today: '2026-03-07' });
    for (const [i, date] of [
      '2026-02-30',
      '2026-13-01',
      '2026-3-01',
      '2026-03-07T01:00:00Z',
      '2026-03-08',
    ].entries()) {
      refuses(
        store,
        {
          type: 'entry.create',
          requestId: `invalid-date-${i}`,
          input: entry(agentId, a, { date }),
        },
        'INVALID_DATE',
      );
    }
    store.time.mutate(
      { type: 'timezone.set', requestId: 'timezone-auckland', timezone: 'Pacific/Auckland' },
      'manual',
    );
    expect(store.time.snapshot().today).toBe('2026-03-08');
    const nextDay = create(
      store,
      'auckland-next-day',
      entry(agentId, a, { date: '2026-03-08' }),
    ).entry!;
    store.time.mutate(
      { type: 'timezone.set', requestId: 'timezone-new-york', timezone: 'America/New_York' },
      'manual',
    );
    expect(store.time.snapshot().entries.find((e) => e.id === nextDay.id)?.date).toBe('2026-03-08');
    refuses(
      store,
      { type: 'timezone.set', requestId: 'invalid-timezone', timezone: 'Not/AZone' },
      'INVALID_TIMEZONE',
    );
    expect(
      create(store, 'valid-leap-date', entry(agentId, a, { date: '2024-02-29' })).entry?.date,
    ).toBe('2024-02-29');
  });

  it('invalidates old configuration previews and preserves time rows during config apply, archive and undo', () => {
    const { store, dir, a, agentId } = setup();
    const preview = store.preview(
      [{ type: 'company.update', id: a, input: { name: 'Stale rename' } }],
      store.snapshot().revision,
    );
    create(store, 'booking-after-preview', entry(agentId, a));
    expect(() => store.apply(preview.id)).toThrow(
      expect.objectContaining({ code: 'STALE_PREVIEW' }),
    );
    const preserved = rows(dir, timeTables);
    const config = apply(store, [
      { type: 'company.update', id: a, input: { name: 'New company name' } },
    ]);
    expect(rows(dir, timeTables)).toEqual(preserved);
    store.undo(config.changeId, config.state.revision);
    expect(rows(dir, timeTables)).toEqual(preserved);
    const archived = apply(store, [
      { type: 'agent.archive', id: agentId },
      { type: 'company.archive', id: a },
    ]);
    expect(rows(dir, timeTables)).toEqual(preserved);
    store.undo(archived.changeId, archived.state.revision);
    expect(rows(dir, timeTables)).toEqual(preserved);
    const laterConfig = apply(store, [company('Later')]);
    create(store, 'booking-after-undo-target', entry(agentId, a));
    expect(() => store.undo(laterConfig.changeId, laterConfig.state.revision)).toThrow(
      expect.objectContaining({ code: 'STALE_PREVIEW' }),
    );
  });

  it('keeps actual output acceptance and execution duration independent from bookings', () => {
    const { store, a, agentId } = setup();
    const result = apply(store, [
      {
        type: 'work.record',
        input: {
          companyId: a,
          agentId,
          title: 'Synthetic result',
          output: 'Actual supplied result text',
          provenance: 'manual',
          status: 'submitted',
          durationMs: 100,
          runId: null,
        },
      },
    ]).state.work[0]!;
    const booked = create(
      store,
      'linked-result-booking',
      entry(agentId, a, { hours: 80, workId: result.id }),
    ).entry!;
    expect(store.snapshot().work[0]).toEqual(result);
    apply(store, [{ type: 'work.accept', id: result.id }]);
    expect(store.time.snapshot().entries[0]).toEqual(booked);
    expect(store.snapshot().work[0]).toEqual({ ...result, status: 'accepted' });
  });

  it('backs up and restores the ledger, catalog history, receipts and original work coherently', async () => {
    const { store, dir, a, agentId } = setup();
    saveCatalog(store, 'TEST-BACKUP', 2.5);
    const command: TimeCommand = {
      type: 'entry.create',
      requestId: 'backup-replay-request',
      input: entry(agentId, a, { hours: undefined, deliverable: 'TEST-BACKUP', quantity: 2 }),
    };
    const receipt = store.time.mutate(command, 'agent');
    const timeBefore = rows(dir, timeTables);
    const configBefore = store.snapshot();
    const backup = join(dir, 'complete-backup.sqlite');
    await store.backup(backup);
    store.time.mutate(
      {
        type: 'entry.void',
        requestId: 'later-void',
        id: receipt.entry!.id,
        expectedVersion: receipt.entry!.version,
        reason: 'Later change',
      },
      'manual',
    );
    await expect(restoreWorkspaceBackup(dir, backup)).rejects.toMatchObject({
      code: 'WORKSPACE_BUSY',
    });
    store.close();
    await restoreWorkspaceBackup(dir, backup);
    const recovered = open(dir);
    expect(rows(dir, timeTables)).toEqual(timeBefore);
    expect(recovered.snapshot()).toEqual(configBefore);
    expect(recovered.time.mutate(command, 'agent')).toEqual(receipt);
    expect(
      readdirSync(join(dir, 'backups')).some((name) => name.startsWith('before-restore-')),
    ).toBe(true);
    const corruptions = [
      ['entry', "UPDATE time_entries SET info=json_set(info,'$.tenths',-1)"],
      ['history', "UPDATE time_history SET info=json_set(info,'$.id','mismatched-history-id')"],
      [
        'receipt',
        "UPDATE time_requests SET receipt=json_set(receipt,'$.requestId','mismatched-request-id')",
      ],
      [
        'catalog',
        "UPDATE time_catalog SET override=json_set(override,'$.referenceTenths',-1) WHERE code='test-backup'",
      ],
      ['timezone', "UPDATE time_meta SET timezone='Not/AZone'"],
    ];
    for (const [name] of corruptions)
      await recovered.backup(join(dir, `invalid-${name}-backup.sqlite`));
    recovered.close();
    const beforeRefusal = rows(dir, [...oldTables, ...timeTables]);
    for (const [name, sql] of corruptions) {
      const invalid = join(dir, `invalid-${name}-backup.sqlite`);
      const bad = new DatabaseSync(invalid);
      bad.exec(sql!);
      bad.close();
      await expect(restoreWorkspaceBackup(dir, invalid)).rejects.toMatchObject({
        code: 'INVALID_BACKUP',
      });
      expect(rows(dir, [...oldTables, ...timeTables])).toEqual(beforeRefusal);
    }
    expect(open(dir).time.snapshot().entries[0]).toEqual(receipt.entry);
  });
});

function legacyFixture(dir: string) {
  const db = new DatabaseSync(join(dir, 'workspace.sqlite'));
  const at = '2020-01-01T00:00:00.000Z';
  db.exec(
    'PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, appliedAt TEXT NOT NULL);',
  );
  LEGACY_MIGRATIONS.forEach((sql, i) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(
      i + 1,
      createHash('sha256').update(sql).digest('hex'),
      at,
    );
  });
  db.exec('PRAGMA user_version=3;');
  const co = {
    id: 'legacy-company',
    name: 'Legacy Company',
    shortCode: 'LEGACY',
    description: 'Synthetic upgrade fixture',
    color: '#123456',
    status: 'active',
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
  const agent = {
    id: 'legacy-agent',
    name: 'Legacy Analyst',
    role: 'Analyst',
    kind: 'agent',
    instructions: 'Return evidence.',
    responsibilities: ['Analyze'],
    departmentId: null,
    managerId: null,
    status: 'active',
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
  const assignment = {
    id: 'legacy-assignment',
    companyId: co.id,
    agentId: agent.id,
    isPrimary: true,
    startedAt: at,
    endedAt: null,
  };
  const work = {
    id: 'legacy-work',
    companyId: co.id,
    agentId: agent.id,
    title: 'Preserved result',
    output: 'Synthetic exact output — unchanged',
    provenance: 'manual',
    status: 'submitted',
    createdAt: at,
    durationMs: 100,
    runId: 'legacy-run',
  };
  const state = {
    schemaVersion: 3,
    revision: 2,
    companies: [co],
    agents: [agent],
    departments: [],
    assignments: [assignment],
    relationships: [],
    work: [work],
    history: [],
  };
  db.prepare('INSERT INTO companies VALUES (?,?,?,?,?,?,?,?,?)').run(
    co.id,
    co.name,
    co.shortCode,
    co.description,
    co.color,
    co.status,
    co.version,
    at,
    at,
  );
  db.prepare('INSERT INTO agents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
    agent.id,
    agent.name,
    agent.role,
    agent.kind,
    agent.instructions,
    JSON.stringify(agent.responsibilities),
    null,
    null,
    agent.status,
    agent.version,
    at,
    at,
  );
  db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?)').run(
    assignment.id,
    agent.id,
    co.id,
    1,
    at,
    null,
  );
  db.prepare('INSERT INTO work VALUES (?,?,?,?,?,?,?,?,?,?)').run(
    work.id,
    co.id,
    agent.id,
    work.title,
    work.output,
    work.provenance,
    work.status,
    at,
    100,
    work.runId,
  );
  db.prepare('INSERT INTO integration_runs VALUES (?,?,?,?)').run(
    'legacy-run',
    'legacy-request',
    JSON.stringify({
      id: 'legacy-run',
      requestId: 'legacy-request',
      status: 'completed',
      output: work.output,
    }),
    '{}',
  );
  db.exec('UPDATE workspace_meta SET revision=2');
  db.prepare(
    'INSERT INTO changes(id,action,summary,revision,createdAt,beforeJson,afterJson,undoable) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    'legacy-change',
    'work.change',
    'Preserved audit',
    2,
    at,
    JSON.stringify({ ...state, work: [] }),
    JSON.stringify(state),
    0,
  );
  db.prepare('INSERT INTO previews VALUES (?,?,?,?,?,?,NULL)').run(
    'legacy-preview',
    2,
    'Preserved pending preview',
    JSON.stringify(['Rename company']),
    at,
    JSON.stringify({ ...state, companies: [{ ...co, name: 'Pending rename' }] }),
  );
  db.close();
  return state;
}

describe('schema-3 Time Tracker upgrade', () => {
  it('preserves every old row and checksum, backs up before migration, and never replays old snapshots over time', () => {
    const dir = directory();
    legacyFixture(dir);
    const before = rows(dir, oldTables);
    const store = open(dir);
    const after = rows(dir, oldTables);
    expect(after.schema_migrations.slice(0, 3)).toEqual(before.schema_migrations);
    expect(after.schema_migrations).toHaveLength(5);
    for (const table of oldTables.filter((t) => t !== 'schema_migrations'))
      expect(after[table]).toEqual(before[table]);
    expect(store.time.snapshot()).toMatchObject({
      revision: 2,
      timezone: 'UTC',
      entries: [],
      history: [],
    });
    const backups = readdirSync(join(dir, 'backups'));
    expect(backups).toHaveLength(1);
    const backup = new DatabaseSync(join(dir, 'backups', backups[0]!), { readOnly: true });
    expect(backup.prepare('PRAGMA user_version').get()?.user_version).toBe(3);
    expect(backup.prepare('SELECT output FROM work').get()?.output).toBe(
      'Synthetic exact output — unchanged',
    );
    backup.close();
    create(store, 'after-upgrade-entry', entry('legacy-agent', 'legacy-company'));
    expect(() => store.apply('legacy-preview')).toThrow(
      expect.objectContaining({ code: 'STALE_PREVIEW' }),
    );
    const saved = rows(dir, [...oldTables, ...timeTables]);
    store.close();
    open(dir);
    expect(rows(dir, [...oldTables, ...timeTables])).toEqual(saved);
  });

  it('rolls back a failing Time Tracker migration and retains its schema-3 backup and rows', () => {
    const dir = directory();
    legacyFixture(dir);
    const collision = new DatabaseSync(join(dir, 'workspace.sqlite'));
    collision.exec('CREATE TABLE time_entries(id TEXT PRIMARY KEY);');
    collision.close();
    const before = rows(dir, oldTables);
    expect(() => createWorkspaceStore(dir)).toThrow();
    expect(rows(dir, oldTables)).toEqual(before);
    const db = new DatabaseSync(join(dir, 'workspace.sqlite'), { readOnly: true });
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(3);
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE name='time_meta'").get(),
    ).toBeUndefined();
    db.close();
    expect(readdirSync(join(dir, 'backups'))).toHaveLength(1);
    expect(readdirSync(dir)).not.toContain('workspace.lock');
  });
});
