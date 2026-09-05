import type { WorkspaceState } from '../domain/contracts';
import type {
  CatalogItem,
  TimeBasis,
  TimeEntry,
  TimeEntryEdit,
  TimeSnapshot,
} from '../time/contracts';
import { roundReferenceTenths } from '../time/rules';

// Calendar arithmetic and the multi-entry week model adapt the original
// org-manager-console timesheet. See THIRD_PARTY_NOTICES.md. No billing lifecycle.
export function addTimeDays(date: string, count: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
export function timeMonday(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addTimeDays(date, -(day === 0 ? 6 : day - 1));
}
export function realTimeDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date;
}
/** A timezone change must not invalidate an unchanged historical booking date. */
export function canSaveTimeDate(date: string, today: string, savedDate?: string): boolean {
  return realTimeDate(date) && (date === savedDate || date <= today);
}
export function timeDates(from: string, to: string): string[] {
  if (!realTimeDate(from) || !realTimeDate(to) || from > to) return [];
  const result: string[] = [];
  const end = new Date(`${to}T12:00:00Z`).getTime();
  for (let tick = new Date(`${from}T12:00:00Z`).getTime(); tick <= end; tick += 86400000)
    result.push(new Date(tick).toISOString().slice(0, 10));
  return result;
}
export const formatTenths = (tenths: number): string => (tenths / 10).toFixed(1);
export function parseTimeHours(raw: string): number | null {
  if (!raw.trim()) return null;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 500) return null;
  const tenths = Math.round(hours * 10);
  return Math.abs(tenths - hours * 10) < 1e-8 ? tenths : null;
}
export function resolveTimeEstimate(
  hours: string,
  requested: string,
  quantityRaw: string,
  catalog: CatalogItem[],
): { tenths: number; kind: TimeBasis['kind']; label: string } | { error: string } {
  const quantity = Number(quantityRaw);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100)
    return { error: 'Quantity must be greater than zero and at most 100.' };
  const key = requested.trim().toLowerCase();
  const codeMatch = catalog.find((row) => row.code.toLowerCase() === key);
  const nameMatches = catalog.filter((row) => row.name.toLowerCase() === key);
  if (!codeMatch && nameMatches.length > 1)
    return { error: 'Several catalog items have this name. Choose its unique code.' };
  if (hours.trim()) {
    const tenths = parseTimeHours(hours);
    return tenths === null
      ? { error: 'Enter 0.1–500 hours in 0.1-hour steps.' }
      : {
          tenths,
          kind: 'explicit',
          label: `Explicit hours: ${formatTenths(tenths)}h. Entered hours take precedence over catalog estimates.`,
        };
  }
  if (!key) return { error: 'Enter hours or choose a deliverable.' };
  const item = codeMatch ?? nameMatches[0];
  const reference = item?.referenceTenths ?? 80;
  const tenths = roundReferenceTenths(reference, quantity);
  if (tenths < 1 || tenths > 5000)
    return {
      error:
        'The calculated delivery hours must be 0.1–500. Change quantity or enter explicit hours.',
    };
  return {
    tenths,
    kind: item ? 'catalog' : 'fallback',
    label: item
      ? `Catalog reference: ${item.name} · ${formatTenths(reference)}h × ${quantity} = ${formatTenths(tenths)}h.`
      : `Fallback estimate: “${requested.trim()}” is not in the catalog. 8.0h × ${quantity} = ${formatTenths(tenths)}h.`,
  };
}
export function previewTimeCorrection(
  entry: TimeEntry,
  hours: string,
  deliverable: string,
  quantityRaw: string,
  catalog: CatalogItem[],
) {
  const quantity = Number(quantityRaw);
  const changes: TimeEntryEdit = {};
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100)
    return { changes, estimate: { error: 'Quantity must be greater than zero and at most 100.' } };
  if (hours.trim() && parseTimeHours(hours) === null)
    return { changes, estimate: { error: 'Enter 0.1–500 hours in 0.1-hour steps.' } };
  if (hours.trim() && parseTimeHours(hours) !== entry.tenths) changes.hours = Number(hours);
  const requested = deliverable.trim();
  const sameDeliverable =
    !requested ||
    [entry.basis.requestedDeliverable, entry.basis.catalogCode, entry.basis.catalogName].some(
      (value) => value !== null && value.toLowerCase() === requested.toLowerCase(),
    );
  if (!sameDeliverable) {
    changes.deliverable = requested;
    if (hours.trim()) changes.hours = Number(hours);
  }
  if (quantity !== entry.basis.quantity) changes.quantity = quantity;
  if (!sameDeliverable)
    return {
      changes,
      estimate: resolveTimeEstimate(
        changes.hours === undefined ? '' : String(changes.hours),
        requested,
        String(quantity),
        catalog,
      ),
    };
  const basis = {
    ...entry.basis,
    quantity,
    ...(changes.hours !== undefined ? { kind: 'explicit' as const } : {}),
  };
  const tenths =
    changes.hours !== undefined
      ? parseTimeHours(hours)!
      : basis.kind === 'explicit'
        ? entry.tenths
        : roundReferenceTenths(basis.referenceTenths!, quantity);
  return {
    changes,
    estimate:
      tenths < 1 || tenths > 5000
        ? {
            error:
              'The corrected delivery hours must be 0.1–500. Change quantity or enter explicit hours.',
          }
        : {
            tenths,
            kind: basis.kind,
            label: `${timeBasisLabel({ basis, tenths })}. Original reference is retained; only a different deliverable uses the current catalog.`,
          },
  };
}
export function canBookTime(state: WorkspaceState, companyId: string, agentId: string) {
  return (
    state.companies.some((row) => row.id === companyId && row.status === 'active') &&
    state.agents.some((row) => row.id === agentId && row.status === 'active') &&
    state.assignments.some((row) => row.companyId === companyId && row.agentId === agentId)
  );
}
export function timeBasisLabel(entry: Pick<TimeEntry, 'basis' | 'tenths'>): string {
  const { basis, tenths } = entry;
  if (basis.kind === 'explicit') return `Explicit hours · ${formatTenths(tenths)}h`;
  return `${basis.kind === 'catalog' ? 'Catalog reference' : 'Fallback estimate'} · ${basis.catalogName ?? basis.requestedDeliverable ?? 'Unknown deliverable'} · ${formatTenths(basis.referenceTenths ?? 80)}h × ${basis.quantity} = ${formatTenths(tenths)}h${basis.catalogVersion !== null ? ` · catalog v${basis.catalogVersion}` : ''}`;
}
export function timeIdentities(state: WorkspaceState, snapshot: TimeSnapshot, companyId: string) {
  const ids = new Set(
    state.assignments.filter((row) => row.companyId === companyId).map((row) => row.agentId),
  );
  snapshot.entries
    .filter((row) => row.companyId === companyId)
    .forEach((row) => ids.add(row.agentId));
  return [...ids]
    .map((id) => {
      const agent = state.agents.find((row) => row.id === id);
      const historical = snapshot.entries.find((row) => row.agentId === id);
      return {
        id,
        name: agent?.name ?? historical?.agentName ?? id,
        role: agent?.role ?? 'Historical identity',
        archived: !agent || agent.status === 'archived',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
export type TimeRangePreset = '7' | '30' | 'month' | 'custom';
export function timeRange(preset: TimeRangePreset, today: string, from: string, to: string) {
  return preset === 'custom'
    ? { from, to }
    : {
        from:
          preset === 'month'
            ? `${today.slice(0, 7)}-01`
            : addTimeDays(today, preset === '30' ? -29 : -6),
        to: today,
      };
}
export function aggregateTime(
  entries: TimeEntry[],
  from: string,
  to: string,
  page?: { offset: number; limit: number },
) {
  const dayCount =
    realTimeDate(from) && realTimeDate(to) && from <= to
      ? Math.round(
          (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) /
            86400000,
        ) + 1
      : 0;
  const offset = page?.offset ?? 0;
  const visibleCount = Math.max(0, Math.min(page?.limit ?? dayCount, dayCount - offset));
  const days = Array.from({ length: visibleCount }, (_, index) => ({
    date: addTimeDays(from, offset + index),
    tenths: 0,
    count: 0,
  }));
  const byDate = new Map<string, { date: string; tenths: number; count: number }>();
  const companies = new Map<string, { id: string; name: string; tenths: number; count: number }>();
  const members = new Map<string, { id: string; name: string; tenths: number; count: number }>();
  let tenths = 0,
    count = 0;
  for (const row of entries) {
    if (row.status === 'void' || row.date < from || row.date > to) continue;
    if (!dayCount) continue;
    const day = byDate.get(row.date) ?? { date: row.date, tenths: 0, count: 0 };
    day.tenths += row.tenths;
    day.count++;
    byDate.set(row.date, day);
    tenths += row.tenths;
    count++;
    for (const [map, id, name] of [
      [companies, row.companyId, row.companyName],
      [members, row.agentId, row.agentName],
    ] as const) {
      const group = map.get(id) ?? { id, name, tenths: 0, count: 0 };
      group.tenths += row.tenths;
      group.count++;
      map.set(id, group);
    }
  }
  return {
    tenths,
    count,
    activeDays: byDate.size,
    dayCount,
    maxDayTenths: Math.max(1, ...[...byDate.values()].map((day) => day.tenths)),
    days: days.map((day) => byDate.get(day.date) ?? day),
    companies: [...companies.values()].sort((a, b) => b.tenths - a.tenths),
    members: [...members.values()].sort((a, b) => b.tenths - a.tenths),
  };
}
