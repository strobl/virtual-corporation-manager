import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceStore } from '../src/db/store.js';
import type { DomainCommand, WorkspaceStore } from '../src/domain/contracts.js';
import type { TimeCommand, TimeEntryInput } from '../src/time/contracts.js';
import {
  calendarDate,
  calculateHours,
  roundReferenceTenths,
  todayIn,
  timezoneOf,
} from '../src/time/rules.js';
import { BUNDLED_TIME_CATALOG } from '../src/time/catalog-defaults.js';
import { seedTimeCatalog, validateTimeData } from '../src/time/store.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'gitflash-time-domain-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const store = createWorkspaceStore(dir);
  cleanups.push(() => store.close());
  const db = new DatabaseSync(join(dir, 'workspace.sqlite'));
  cleanups.push(() => db.close());
  const apply = (commands: DomainCommand[]) =>
    store.apply(store.preview(commands, store.snapshot().revision).id);
  for (const name of ['A', 'B'])
    apply([
      {
        type: 'company.create',
        input: { name, shortCode: name, description: '', color: '#123456' },
      },
    ]);
  const [a, b] = store.snapshot().companies;
  apply([
    {
      type: 'agent.create',
      companyId: a.id,
      input: {
        name: 'Time tester',
        role: 'Builder',
        kind: 'agent',
        instructions: '',
        responsibilities: [],
        departmentId: null,
        managerId: null,
      },
    },
  ]);
  const agent = store.snapshot().agents[0];
  const input = (patch: Partial<TimeEntryInput> = {}): TimeEntryInput => ({
    agentId: agent.id,
    companyId: a.id,
    date: '2001-01-01',
    hours: 0.1,
    description: 'Reviewed delivery',
    ...patch,
  });
  let index = 0;
  const create = (patch: Partial<TimeEntryInput> = {}, requestId = `entry-${++index}`) =>
    store.time.mutate({ type: 'entry.create', requestId, input: input(patch) }, 'manual');
  return { store, db, a, b, agent, apply, input, create };
}
function expectCode(run: () => unknown, code: string) {
  expect(run).toThrowError(expect.objectContaining({ code }));
}
function saveCatalog(
  store: WorkspaceStore,
  referenceHours = 2.5,
  expectedVersion: number | null = null,
  requestId = 'catalog-one',
) {
  return store.time.mutate(
    {
      type: 'catalog.save',
      requestId,
      expectedVersion,
      input: { code: 'TEST-DELIVERY', name: 'Test delivery', category: 'Testing', referenceHours },
    },
    'manual',
  ).catalog!;
}

describe('delivery hours domain', () => {
  it('keeps multiple exact tenths, accepts 500h and has no member/day cap', () => {
    const { store, create, db } = setup();
    create();
    create({ hours: 0.2 });
    expect(store.time.snapshot().entries.reduce((sum, e) => sum + e.tenths, 0)).toBe(3);
    create({ hours: 500 });
    create({ hours: 80 });
    expect(store.time.snapshot().entries.reduce((sum, e) => sum + e.tenths, 0)).toBe(5803);
    expect(store.time.snapshot().history).toHaveLength(4);
    expect(store.snapshot().work).toHaveLength(0);
    validateTimeData(db);
  });

  it('captures exact code/name catalog reference, explicit override and honest fallback', () => {
    const { store, create } = setup();
    const item = saveCatalog(store);
    const known = create({
      hours: undefined,
      deliverable: '  test-DELIVERY  ',
      quantity: 2,
    }).entry!;
    expect(known.tenths).toBe(50);
    expect(known.basis).toMatchObject({
      kind: 'catalog',
      catalogCode: item.code,
      catalogVersion: 1,
      referenceTenths: 25,
      quantity: 2,
    });
    expect(
      create({ hours: undefined, deliverable: 'TEST DELIVERY', quantity: 2 }).entry!.tenths,
    ).toBe(50);
    expect(create({ hours: 0.7, deliverable: item.code, quantity: 2 }).entry).toMatchObject({
      tenths: 7,
      basis: { kind: 'explicit', referenceTenths: 25 },
    });
    expect(
      create({ hours: undefined, deliverable: 'unmatched-request', quantity: 2 }).entry,
    ).toMatchObject({
      tenths: 160,
      basis: {
        kind: 'fallback',
        requestedDeliverable: 'unmatched-request',
        catalogCode: null,
        referenceTenths: 80,
      },
    });
    // Partial names must never silently select a catalog item.
    expect(create({ hours: undefined, deliverable: 'Test deliv' }).entry!.basis.kind).toBe(
      'fallback',
    );
    expect(create({ hours: undefined, deliverable: 'annual-budget' }).entry!.tenths).toBe(400);
  });

  it('rounds decimal reference quantities once without binary float boundary errors', () => {
    expect(roundReferenceTenths(100, 1.005)).toBe(101);
    expect(roundReferenceTenths(100, 1.004)).toBe(100);
    expect(roundReferenceTenths(100, 1.006)).toBe(101);
    expect(roundReferenceTenths(1, 0.5)).toBe(1);
    expect(roundReferenceTenths(5000, 1)).toBe(5000);
    expect(roundReferenceTenths(5000, 100)).toBe(500000);
    expect(roundReferenceTenths(5000, 1e-7)).toBe(0);
    expect(roundReferenceTenths(5000, Number.MIN_VALUE)).toBe(0);
    for (const reference of [0, 1.5, 5001, Number.POSITIVE_INFINITY])
      expectCode(() => roundReferenceTenths(reference, 1), 'INVALID_INPUT');
    for (const quantity of [0, -1, 100.01, Number.NaN, Number.POSITIVE_INFINITY])
      expectCode(() => roundReferenceTenths(100, quantity), 'INVALID_INPUT');
    const { store, create, db } = setup();
    const item = saveCatalog(store, 10);
    expect(calculateHours({ deliverable: item.code, quantity: 1.005 }, [item]).tenths).toBe(101);
    const entry = create({ hours: undefined, deliverable: item.code, quantity: 1.005 }).entry!;
    expect(entry).toMatchObject({ tenths: 101, basis: { referenceTenths: 100, quantity: 1.005 } });
    // Restore validation must use the identical decimal calculation.
    validateTimeData(db);
    expectCode(
      () => create({ hours: undefined, deliverable: item.code, quantity: 100 }),
      'INVALID_INPUT',
    );
  });

  it('rejects malformed explicit/derived inputs without partial persistence', () => {
    const { store, create } = setup();
    const revision = store.snapshot().revision;
    for (const hours of [0, -1, 0.05, 500.1, Number.NaN, Number.POSITIVE_INFINITY])
      expectCode(() => create({ hours }), 'INVALID_INPUT');
    for (const quantity of [0, -1, 101, Number.NaN])
      expectCode(
        () => create({ hours: 0.7, deliverable: 'annual-budget', quantity }),
        'INVALID_INPUT',
      );
    expectCode(() => create({ hours: undefined, deliverable: undefined }), 'INVALID_INPUT');
    expectCode(
      () => create({ hours: undefined, deliverable: 'annual-budget', quantity: 100 }),
      'INVALID_INPUT',
    );
    expectCode(
      () => create({ hours: undefined, deliverable: 'unknown', quantity: 0.00001 }),
      'INVALID_INPUT',
    );
    expectCode(() => create({ description: '  ' }), 'INVALID_INPUT');
    expectCode(() => create({ date: '2025-02-29' }), 'INVALID_DATE');
    expectCode(() => create({ date: '2001-01-01T00:00:00Z' }), 'INVALID_DATE');
    expect(store.snapshot().revision).toBe(revision);
    expect(store.time.snapshot().entries).toEqual([]);
    expect(store.time.snapshot().history).toEqual([]);
  });

  it('replays canonical input/source exactly even after catalog edits and entry corrections', () => {
    const { store, input } = setup();
    const item = saveCatalog(store);
    const original: TimeCommand = {
      type: 'entry.create',
      requestId: 'stable-request',
      input: input({ hours: undefined, deliverable: item.code, quantity: 2 }),
    };
    const receipt = store.time.mutate(original, 'agent');
    saveCatalog(store, 40, 1, 'catalog-two');
    store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'correct',
        id: receipt.entry!.id,
        expectedVersion: 1,
        input: { description: 'Corrected description' },
      },
      'manual',
    );
    const revision = store.snapshot().revision;
    const reordered = {
      input: { ...original.input },
      requestId: original.requestId,
      type: 'entry.create',
    } as TimeCommand;
    expect(store.time.mutate(reordered, 'agent')).toEqual(receipt);
    expect(store.snapshot().revision).toBe(revision);
    expectCode(() => store.time.mutate(original, 'manual'), 'CONFLICT');
    expectCode(
      () => store.time.mutate({ ...original, input: { ...original.input, hours: 8 } }, 'agent'),
      'CONFLICT',
    );
    expectCode(
      () => store.time.mutate({ ...original, unexpected: undefined } as TimeCommand, 'agent'),
      'INVALID_INPUT',
    );
    expectCode(
      () =>
        store.time.mutate(
          { ...original, input: { ...original.input, unexpected: undefined } } as TimeCommand,
          'agent',
        ),
      'INVALID_INPUT',
    );
  });

  it('keeps historical pricing under quantity/full-form corrections and honors deliberate changes', () => {
    const { store, create, db } = setup();
    const first = saveCatalog(store);
    const original = create({ hours: undefined, deliverable: first.code, quantity: 2 }).entry!;
    const explicit = create({ hours: 0.7, deliverable: first.code, quantity: 2 }).entry!;
    saveCatalog(store, 8, 1, 'repriced-catalog');
    const update = (
      entry: typeof original,
      requestId: string,
      input: Extract<TimeCommand, { type: 'entry.update' }>['input'],
    ) =>
      store.time.mutate(
        { type: 'entry.update', requestId, id: entry.id, expectedVersion: entry.version, input },
        'manual',
      ).entry!;
    const fullForm = update(original, 'full-form', {
      description: 'Corrected note',
      hours: 5,
      deliverable: ' TEST-DELIVERY ',
      quantity: 2,
    });
    expect(fullForm).toMatchObject({ tenths: 50, basis: original.basis });
    const quantity = update(fullForm, 'captured-quantity', { quantity: 3 });
    expect(quantity).toMatchObject({
      tenths: 75,
      basis: { kind: 'catalog', referenceTenths: 25, catalogVersion: 1, quantity: 3 },
    });
    const alias = update(quantity, 'same-name-alias', {
      deliverable: ' Test Delivery ',
      hours: 7.5,
      quantity: 3,
    });
    expect(alias.basis).toEqual(quantity.basis);
    const explicitQuantity = update(explicit, 'explicit-quantity', {
      quantity: 3,
      deliverable: first.code,
    });
    expect(explicitQuantity).toMatchObject({
      tenths: 7,
      basis: { kind: 'explicit', referenceTenths: 25, catalogVersion: 1, quantity: 3 },
    });
    const override = update(alias, 'changed-hours', { hours: 0.8 });
    expect(override).toMatchObject({
      tenths: 8,
      basis: { kind: 'explicit', referenceTenths: 25, catalogVersion: 1 },
    });
    const second = store.time.mutate(
      {
        type: 'catalog.save',
        requestId: 'second-item',
        expectedVersion: null,
        input: {
          code: 'new-4h-code',
          name: 'Another delivery',
          category: 'Testing',
          referenceHours: 4,
        },
      },
      'manual',
    ).catalog!;
    const changed = update(override, 'different-deliverable', {
      deliverable: second.code,
      quantity: 1,
    });
    expect(changed).toMatchObject({
      tenths: 40,
      basis: { kind: 'catalog', catalogCode: second.code, referenceTenths: 40 },
    });
    // A supplied explicit value wins for a new deliverable even if its number
    // happens to equal the old entry. Same-item resends above still keep basis.
    const stillExplicit = update(explicitQuantity, 'different-deliverable-explicit', {
      deliverable: second.code,
      hours: 0.7,
    });
    expect(stillExplicit).toMatchObject({
      tenths: 7,
      basis: { kind: 'explicit', catalogCode: second.code, referenceTenths: 40 },
    });
    validateTimeData(db);
  });

  it('preserves basis for metadata corrections, then records recalculation and void history', () => {
    const { store, create, db } = setup();
    saveCatalog(store);
    const original = create({
      hours: undefined,
      deliverable: 'test-delivery',
      quantity: 2,
      clientProject: 'Project',
    }).entry!;
    saveCatalog(store, 4, 1, 'new-reference');
    const corrected = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'correct-note',
        id: original.id,
        expectedVersion: 1,
        input: { description: 'Corrected', clientProject: '' },
      },
      'manual',
    ).entry!;
    expect(corrected).toMatchObject({
      tenths: 50,
      basis: original.basis,
      clientProject: '',
      companyName: original.companyName,
    });
    const recalculated = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'new-quantity',
        id: original.id,
        expectedVersion: 2,
        input: { quantity: 3 },
      },
      'manual',
    ).entry!;
    expect(recalculated).toMatchObject({
      tenths: 75,
      basis: { kind: 'catalog', catalogVersion: 1, referenceTenths: 25, quantity: 3 },
    });
    expectCode(
      () =>
        store.time.mutate(
          {
            type: 'entry.update',
            requestId: 'stale',
            id: original.id,
            expectedVersion: 1,
            input: { hours: 8 },
          },
          'manual',
        ),
      'CONFLICT',
    );
    store.time.mutate(
      {
        type: 'entry.void',
        requestId: 'void',
        id: original.id,
        expectedVersion: 3,
        reason: 'Duplicate booking',
      },
      'manual',
    );
    const snapshot = store.time.snapshot();
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      status: 'void',
      version: 4,
      tenths: 75,
      voidReason: 'Duplicate booking',
    });
    const history = snapshot.history.filter((h) => h.entryId === original.id);
    expect(history.map((h) => h.action)).toEqual([
      'entry.create',
      'entry.update',
      'entry.update',
      'entry.void',
    ]);
    expect(history[0].after).toEqual(original);
    expectCode(
      () =>
        store.time.mutate(
          {
            type: 'entry.update',
            requestId: 'void-edit',
            id: original.id,
            expectedVersion: 4,
            input: { hours: 2 },
          },
          'manual',
        ),
      'CONFLICT',
    );
    validateTimeData(db);
  });

  it('keeps bundled originals and never reuses override versions after reset or removal', () => {
    const { store, db } = setup();
    expect(store.time.snapshot().catalog).toHaveLength(124);
    expect(new Set(BUNDLED_TIME_CATALOG.map((c) => c.code)).size).toBe(124);
    seedTimeCatalog(db);
    const original = store.time.snapshot().catalog.find((c) => c.code === 'annual-budget')!;
    const save = (expectedVersion: number, hours: number, requestId: string) =>
      store.time.mutate(
        {
          type: 'catalog.save',
          expectedVersion,
          requestId,
          input: {
            code: original.code,
            name: original.name,
            category: original.category,
            referenceHours: hours,
          },
        },
        'manual',
      );
    expect(save(1, 2.5, 'override').catalog).toMatchObject({
      version: 2,
      origin: 'local',
      referenceTenths: 25,
    });
    const reset = store.time.mutate(
      { type: 'catalog.remove', requestId: 'reset', code: original.code, expectedVersion: 2 },
      'manual',
    ).catalog!;
    expect(reset).toEqual({ ...original, version: 3 });
    expectCode(() => save(1, 5, 'stale-catalog'), 'CONFLICT');
    expect(save(3, 8, 'override-again').catalog!.version).toBe(4);
    const local = saveCatalog(store);
    store.time.mutate(
      { type: 'catalog.remove', requestId: 'remove-local', code: local.code, expectedVersion: 1 },
      'manual',
    );
    expect(saveCatalog(store, 8, null, 'restore-local').version).toBe(3);
    validateTimeData(db);
  });

  it('honors explicit historical membership and preserves archived entry corrections', () => {
    const { store, a, b, agent, apply, create } = setup();
    expectCode(() => create({ companyId: b.id }), 'NO_ASSIGNMENT');
    apply([{ type: 'assignment.add', agentId: agent.id, companyId: b.id }]);
    const assignment = store.snapshot().assignments.find((x) => x.companyId === b.id)!;
    apply([{ type: 'assignment.end', id: assignment.id }]);
    const historic = create({ companyId: b.id }).entry!;
    expect(historic.companyId).toBe(b.id);
    expect(create({ companyId: undefined }).entry!.companyId).toBe(a.id);
    apply([{ type: 'company.archive', id: b.id }]);
    expectCode(() => create({ companyId: b.id }), 'ARCHIVED_ENTITY');
    const corrected = store.time.mutate(
      {
        type: 'entry.update',
        requestId: 'archived-correction',
        id: historic.id,
        expectedVersion: 1,
        input: { hours: 0.2 },
      },
      'manual',
    ).entry!;
    expect(corrected).toMatchObject({ companyId: b.id, companyName: 'B', tenths: 2 });
    store.time.mutate(
      {
        type: 'entry.void',
        requestId: 'archived-void',
        id: historic.id,
        expectedVersion: 2,
        reason: 'Correction was unnecessary',
      },
      'manual',
    );
  });

  it('validates existing work/run identity without accepting or creating work', () => {
    const { store, a, b, agent, db, create } = setup();
    const run = { id: 'run-good', agentId: agent.id, companyId: a.id };
    db.prepare('INSERT INTO integration_runs VALUES (?,?,?,?)').run(
      run.id,
      'external-run-request',
      JSON.stringify(run),
      '{}',
    );
    db.prepare('INSERT INTO integration_runs VALUES (?,?,?,?)').run(
      'run-wrong',
      'wrong-request',
      JSON.stringify({ ...run, companyId: b.id }),
      '{}',
    );
    // Dedicated valid domain work fixture; no runtime is executed.
    db.prepare('INSERT INTO work VALUES (?,?,?,?,?,?,?,?,?,?)').run(
      'work-good',
      a.id,
      agent.id,
      'Existing work',
      'Output',
      'manual',
      'submitted',
      new Date().toISOString(),
      null,
      'run-good',
    );
    expect(create({ runId: 'run-good', workId: 'work-good' }).entry).toMatchObject({
      runId: 'run-good',
      workId: 'work-good',
    });
    expectCode(() => create({ runId: 'run-wrong' }), 'INVALID_REFERENCE');
    expectCode(() => create({ workId: 'missing' }), 'INVALID_REFERENCE');
    expectCode(() => create({ runId: 'run-wrong', workId: 'work-good' }), 'INVALID_REFERENCE');
    expect(store.snapshot().work[0].status).toBe('submitted');
  });

  it('rolls back an entry, revision, receipt and audit together on storage failure', () => {
    const { store, db, create } = setup();
    const revision = store.snapshot().revision;
    db.exec(
      "CREATE TRIGGER fail_time_history BEFORE INSERT ON time_history BEGIN SELECT RAISE(ABORT,'injected failure'); END;",
    );
    expect(() => create()).toThrow('injected failure');
    expect(store.snapshot().revision).toBe(revision);
    for (const table of ['time_entries', 'time_history', 'time_requests'])
      expect(db.prepare(`SELECT count(*) n FROM ${table}`).get()!.n).toBe(0);
    expect(db.prepare("SELECT count(*) n FROM changes WHERE action LIKE 'time.%'").get()!.n).toBe(
      0,
    );
    db.exec('DROP TRIGGER fail_time_history');
    create();
    validateTimeData(db);
  });

  it('uses strict real dates and a saved timezone across midnight and DST', () => {
    expect(calendarDate('2024-02-29')).toBe('2024-02-29');
    expectCode(() => calendarDate('2023-02-29'), 'INVALID_DATE');
    expectCode(() => timezoneOf('+02:00'), 'INVALID_TIMEZONE');
    expectCode(() => timezoneOf('No/Such_Zone'), 'INVALID_TIMEZONE');
    expect(todayIn('America/Los_Angeles', new Date('2026-03-08T07:30:00Z'))).toBe('2026-03-07');
    expect(todayIn('America/Los_Angeles', new Date('2026-03-08T10:30:00Z'))).toBe('2026-03-08');
    const { store, create } = setup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:30:00Z'));
    store.time.mutate(
      { type: 'timezone.set', requestId: 'zone', timezone: 'America/Los_Angeles' },
      'manual',
    );
    expect(store.time.snapshot().today).toBe('2025-12-31');
    expectCode(() => create({ date: '2026-01-01' }), 'INVALID_DATE');
    const entry = create({ date: '2025-12-31' }).entry!;
    store.time.mutate({ type: 'timezone.set', requestId: 'zone2', timezone: 'UTC' }, 'manual');
    expect(store.time.snapshot().entries[0].date).toBe(entry.date);
  });
});
