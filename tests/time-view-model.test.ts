import { describe, expect, it } from 'vitest';
import type { WorkspaceState } from '../src/domain/contracts';
import type { CatalogItem, TimeEntry, TimeSnapshot } from '../src/time/contracts';
import {
  aggregateTime,
  canBookTime,
  canSaveTimeDate,
  parseTimeHours,
  previewTimeCorrection,
  realTimeDate,
  resolveTimeEstimate,
  timeDates,
  timeIdentities,
  timeMonday,
  timeRange,
} from '../src/web/time-view-model';

const catalog: CatalogItem[] = [
  {
    code: 'review',
    name: 'Review deliverable',
    category: 'Engineering',
    referenceTenths: 25,
    version: 1,
    origin: 'bundled',
  },
];
function entry(patch: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'fixture-entry',
    companyId: 'a',
    agentId: 'member',
    companyName: 'Synthetic company A',
    agentName: 'Synthetic member',
    date: '2026-09-05',
    tenths: 50,
    description: 'Synthetic test entry',
    clientProject: '',
    basis: {
      kind: 'catalog',
      requestedDeliverable: 'review',
      catalogCode: 'review',
      catalogName: 'Review deliverable',
      catalogVersion: 1,
      referenceTenths: 25,
      quantity: 2,
    },
    source: 'manual',
    status: 'booked',
    voidReason: null,
    workId: null,
    runId: null,
    version: 1,
    createdAt: '2026-09-05T12:00:00Z',
    updatedAt: '2026-09-05T12:00:00Z',
    ...patch,
  };
}
describe('delivery hours frontend model', () => {
  it('preserves an unchanged saved date after a timezone rollback, but refuses a newly chosen future date', () => {
    const savedDate = '2026-09-05';
    const todayAfterTimezoneChange = '2026-09-04';
    expect(canSaveTimeDate(savedDate, todayAfterTimezoneChange, savedDate)).toBe(true);
    expect(canSaveTimeDate('2026-09-06', todayAfterTimezoneChange, savedDate)).toBe(false);
    expect(canSaveTimeDate(savedDate, todayAfterTimezoneChange)).toBe(false);
    expect(canSaveTimeDate('2026-09-04', todayAfterTimezoneChange, savedDate)).toBe(true);
    expect(canSaveTimeDate('2026-02-30', todayAfterTimezoneChange, '2026-02-30')).toBe(false);
  });
  it('reconciles 0.1 + 0.2 across every total without binary floating drift', () => {
    const totals = aggregateTime(
      [entry({ id: 'a', tenths: 1 }), entry({ id: 'b', tenths: 2 })],
      '2026-08-31',
      '2026-09-06',
    );
    expect(totals.tenths).toBe(3);
    expect(totals.days.reduce((sum, day) => sum + day.tenths, 0)).toBe(3);
    expect(totals.companies[0].tenths).toBe(3);
    expect(totals.members[0].tenths).toBe(3);
    expect(totals.count).toBe(2);
    expect(totals.activeDays).toBe(1);
    expect(totals.days).toHaveLength(7);
    expect(totals.days.filter((day) => day.tenths === 0)).toHaveLength(6);
  });
  it('excludes voids and out-of-window entries from hours, counts, and active days', () => {
    const totals = aggregateTime(
      [
        entry({ tenths: 2 }),
        entry({ id: 'void', tenths: 500, status: 'void', date: '2026-09-04' }),
        entry({ id: 'old', date: '2025-01-01' }),
      ],
      '2026-09-01',
      '2026-09-05',
    );
    expect(totals).toMatchObject({ tenths: 2, count: 1, activeDays: 1, dayCount: 5 });
  });
  it('paginates zero-filled long ranges while preserving whole-window totals', () => {
    const totals = aggregateTime(
      [entry({ date: '2026-09-05', tenths: 2 })],
      '0001-01-01',
      '9999-12-31',
      { offset: 0, limit: 31 },
    );
    expect(totals.days).toHaveLength(31);
    expect(totals.dayCount).toBeGreaterThan(3000000);
    expect(totals.tenths).toBe(2);
    expect(totals.activeDays).toBe(1);
    expect(totals.days.every((day) => day.tenths === 0)).toBe(true);
  });
  it('uses exact decimals for catalog multiplication, with explicit precedence and labelled fallback', () => {
    expect(resolveTimeEstimate('', 'review', '2', catalog)).toMatchObject({
      tenths: 50,
      kind: 'catalog',
    });
    expect(resolveTimeEstimate('0.7', 'review', '2', catalog)).toMatchObject({
      tenths: 7,
      kind: 'explicit',
    });
    expect(resolveTimeEstimate('', 'unknown-code', '2', catalog)).toMatchObject({
      tenths: 160,
      kind: 'fallback',
      label: expect.stringContaining('not in the catalog'),
    });
    expect(
      resolveTimeEstimate('', 'review', '1.005', [{ ...catalog[0], referenceTenths: 100 }]),
    ).toMatchObject({ tenths: 101 });
    expect(
      resolveTimeEstimate('', 'review', '1', [{ ...catalog[0], referenceTenths: 800 }]),
    ).toMatchObject({ tenths: 800 });
  });
  it('enforces the same entry range and quantity constraints before saving', () => {
    expect(parseTimeHours('500')).toBe(5000);
    for (const invalid of ['', '0', '-1', '0.15', '500.1', 'Infinity'])
      expect(parseTimeHours(invalid)).toBeNull();
    expect(resolveTimeEstimate('', 'review', '0', catalog)).toHaveProperty('error');
    expect(resolveTimeEstimate('', 'review', '101', catalog)).toHaveProperty('error');
    expect(
      resolveTimeEstimate('', 'review', '100', [{ ...catalog[0], referenceTenths: 800 }]),
    ).toHaveProperty('error');
    expect(resolveTimeEstimate('', '', '1', catalog)).toHaveProperty('error');
  });
  it('uses unique codes and refuses ambiguous catalog names, including explicit-hours requests', () => {
    const duplicate = [...catalog, { ...catalog[0], code: 'second', referenceTenths: 80 }];
    expect(resolveTimeEstimate('', 'Review deliverable', '1', duplicate)).toHaveProperty('error');
    expect(resolveTimeEstimate('0.7', 'Review deliverable', '1', duplicate)).toHaveProperty(
      'error',
    );
    expect(resolveTimeEstimate('', ' REVIEW ', '1', duplicate)).toMatchObject({ tenths: 25 });
  });
  it('retains captured reference and only sends changed calculation fields', () => {
    const updated = [{ ...catalog[0], referenceTenths: 80, version: 2 }];
    const quantityOnly = previewTimeCorrection(entry(), '', ' REVIEW ', '3', updated);
    expect(quantityOnly.changes).toEqual({ quantity: 3 });
    expect(quantityOnly.estimate).toMatchObject({
      tenths: 75,
      kind: 'catalog',
      label: expect.stringContaining('v1'),
    });
    expect(
      previewTimeCorrection(entry(), '5.0', 'Review deliverable', '2', updated).changes,
    ).toEqual({});
    expect(previewTimeCorrection(entry(), '', '', '2', updated).estimate).toMatchObject({
      tenths: 50,
    });
  });
  it('keeps explicit hours on quantity change and uses current prices only for a different deliverable', () => {
    const explicit = entry({ tenths: 7, basis: { ...entry().basis, kind: 'explicit' } });
    expect(previewTimeCorrection(explicit, '0.7', 'review', '3', catalog)).toMatchObject({
      changes: { quantity: 3 },
      estimate: { tenths: 7, kind: 'explicit' },
    });
    expect(previewTimeCorrection(entry(), '0.7', 'review', '2', catalog)).toMatchObject({
      changes: { hours: 0.7 },
      estimate: { tenths: 7, kind: 'explicit' },
    });
    expect(previewTimeCorrection(entry(), '', 'new-code', '2', catalog)).toMatchObject({
      changes: { deliverable: 'new-code' },
      estimate: { tenths: 160, kind: 'fallback' },
    });
    expect(previewTimeCorrection(explicit, '0.7', 'new-code', '2', catalog)).toMatchObject({
      changes: { hours: 0.7, deliverable: 'new-code' },
      estimate: { tenths: 7, kind: 'explicit' },
    });
  });
  it('uses inclusive calendar windows and Monday weeks across DST and year boundaries', () => {
    expect(timeMonday('2026-01-01')).toBe('2025-12-29');
    expect(timeMonday('2026-03-29')).toBe('2026-03-23');
    expect(timeDates('2026-03-28', '2026-03-30')).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
    ]);
    expect(timeDates('9999-12-31', '9999-12-31')).toEqual(['9999-12-31']);
    expect(timeRange('30', '2026-03-01', '', '')).toEqual({ from: '2026-01-31', to: '2026-03-01' });
    expect(timeRange('month', '2026-03-01', '', '')).toEqual({
      from: '2026-03-01',
      to: '2026-03-01',
    });
    expect(realTimeDate('2026-02-30')).toBe(false);
    expect(realTimeDate('0000-01-01')).toBe(false);
    expect(realTimeDate('2026-09-05T00:00Z')).toBe(false);
  });
  it('keeps 100 roles and captured identities in scope, while archived identities cannot book new time', () => {
    const state = {
      companies: [{ id: 'a', status: 'active' }],
      agents: Array.from({ length: 100 }, (_, i) => ({
        id: `member-${i}`,
        name: `Synthetic ${i}`,
        role: `Role ${i}`,
        status: i === 99 ? 'archived' : 'active',
      })),
      assignments: Array.from({ length: 100 }, (_, i) => ({
        id: `assignment-${i}`,
        companyId: 'a',
        agentId: `member-${i}`,
        endedAt: i === 98 ? '2026-01-01' : null,
      })),
    } as WorkspaceState;
    const snapshot = {
      entries: [entry({ agentId: 'removed', agentName: 'Captured historical member' })],
    } as TimeSnapshot;
    const rows = timeIdentities(state, snapshot, 'a');
    expect(rows).toHaveLength(101);
    expect(rows.find((row) => row.id === 'removed')).toMatchObject({
      name: 'Captured historical member',
      archived: true,
    });
    expect(canBookTime(state, 'a', 'member-98')).toBe(true);
    expect(canBookTime(state, 'a', 'member-99')).toBe(false);
    expect(canBookTime(state, 'b', 'member-98')).toBe(false);
  });
});
