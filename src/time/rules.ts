import { DomainError, requireDomain as check } from '../domain/errors.js';
import type { CatalogItem, TimeBasis, TimeCommand, TimeEntryInput } from './contracts.js';

export function object(value: unknown, label = 'Input'): Record<string, unknown> {
  check(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_INPUT',
    `${label} must be an object.`,
  );
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: readonly string[]) {
  check(
    Object.keys(value).every((key) => allowed.includes(key)),
    'INVALID_INPUT',
    'The request contains unsupported fields.',
  );
}
export function text(value: unknown, label: string, max = 200, optional = false): string {
  check(typeof value === 'string', 'INVALID_INPUT', `${label} must be text.`);
  const clean = value.trim();
  check(
    (optional || clean.length > 0) &&
      clean.length <= max &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean),
    'INVALID_INPUT',
    `${label} must contain ${optional ? '0' : '1'}–${max} characters without control characters.`,
  );
  return clean;
}
export function tenthsOf(value: unknown): number {
  check(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0 &&
      value <= 500 &&
      Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
    'INVALID_INPUT',
    'Delivery hours must be a positive multiple of 0.1, at most 500.',
  );
  return Math.round(value * 10);
}
export function quantityOf(value: unknown): number {
  check(
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100,
    'INVALID_INPUT',
    'Quantity must be greater than zero and at most 100.',
  );
  return value;
}
/** Multiply the canonical decimal quantity exactly, then round half up once.
 * Delivery quantities such as 1.005 must not inherit binary float rounding errors.
 * This browser-safe helper returns integer tenths; callers enforce the entry limit.
 */
export function roundReferenceTenths(referenceTenths: number, quantity: number): number {
  check(
    Number.isSafeInteger(referenceTenths) && referenceTenths >= 1 && referenceTenths <= 5000,
    'INVALID_INPUT',
    'Reference hours must be positive integer tenths, at most 500 hours.',
  );
  quantityOf(quantity);
  const [mantissa, exponentText = '0'] = quantity.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const exponent = Number(exponentText) - fraction.length;
  let numerator = BigInt(whole + fraction) * BigInt(referenceTenths);
  let denominator = 1n;
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
  else denominator = 10n ** BigInt(-exponent);
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}
export function calendarDate(value: unknown): string {
  check(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value),
    'INVALID_DATE',
    'Use a real date in YYYY-MM-DD format.',
  );
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T00:00:00.000Z`);
  check(
    year >= 1 &&
      Number.isFinite(date.getTime()) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day,
    'INVALID_DATE',
    'Use a real date in YYYY-MM-DD format.',
  );
  return value;
}
export function timezoneOf(value: unknown): string {
  check(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 100 &&
      value.trim() === value &&
      !/^[+-]/.test(value),
    'INVALID_TIMEZONE',
    'Choose a valid IANA timezone, for example Europe/Berlin or UTC.',
  );
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    throw new DomainError(
      'INVALID_TIMEZONE',
      'Choose a valid IANA timezone, for example Europe/Berlin or UTC.',
    );
  }
}
export function todayIn(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}
export function catalogCode(value: unknown): string {
  const code = text(value, 'Catalog code', 80).toLowerCase();
  check(
    /^[a-z0-9][a-z0-9_.-]*$/.test(code),
    'INVALID_INPUT',
    'Catalog codes use letters, numbers, dots, underscores and hyphens.',
  );
  return code;
}
export const ENTRY_FIELDS = [
  'agentId',
  'companyId',
  'date',
  'hours',
  'deliverable',
  'quantity',
  'description',
  'clientProject',
  'workId',
  'runId',
] as const;
export function validateEntryFields(input: Record<string, unknown>, editing = false) {
  keys(
    input,
    editing ? ENTRY_FIELDS.filter((key) => key !== 'agentId' && key !== 'companyId') : ENTRY_FIELDS,
  );
  if (!editing || 'agentId' in input) text(input.agentId, 'Agent ID');
  if ('companyId' in input) text(input.companyId, 'Company ID');
  if (!editing || 'date' in input) calendarDate(input.date);
  if (!editing || 'description' in input) text(input.description, 'Description', 500);
  if ('clientProject' in input) text(input.clientProject, 'Client project', 160, true);
  if ('hours' in input) tenthsOf(input.hours);
  if ('quantity' in input) quantityOf(input.quantity);
  if ('deliverable' in input) text(input.deliverable, 'Deliverable', 160);
  for (const key of ['workId', 'runId'])
    if (key in input && input[key] !== null) text(input[key], key);
}
export function calculateHours(
  input: Pick<TimeEntryInput, 'hours' | 'deliverable' | 'quantity'>,
  catalog: readonly CatalogItem[],
): { tenths: number; basis: TimeBasis } {
  const quantity = input.quantity === undefined ? 1 : quantityOf(input.quantity);
  const requestedDeliverable =
    input.deliverable === undefined ? null : text(input.deliverable, 'Deliverable', 160);
  const explicit = input.hours === undefined ? null : tenthsOf(input.hours);
  const codeMatch =
    requestedDeliverable === null
      ? undefined
      : catalog.find((row) => row.code.toLowerCase() === requestedDeliverable.toLowerCase());
  const nameMatches =
    requestedDeliverable === null || codeMatch
      ? []
      : catalog.filter((row) => row.name.toLowerCase() === requestedDeliverable.toLowerCase());
  check(
    nameMatches.length <= 1,
    'INVALID_INPUT',
    'Several catalog items have that name. Use the exact catalog code.',
  );
  const item = codeMatch ?? nameMatches[0];
  check(
    explicit !== null || requestedDeliverable !== null,
    'INVALID_INPUT',
    'Enter delivery hours or request a deliverable.',
  );
  const referenceTenths = item?.referenceTenths ?? (requestedDeliverable === null ? null : 80);
  const tenths = explicit ?? roundReferenceTenths(referenceTenths!, quantity);
  check(
    Number.isSafeInteger(tenths) && tenths >= 1 && tenths <= 5000,
    'INVALID_INPUT',
    'The calculated delivery hours must be greater than zero and at most 500. Change the quantity or enter explicit hours.',
  );
  return {
    tenths,
    basis: {
      kind: explicit !== null ? 'explicit' : item ? 'catalog' : 'fallback',
      requestedDeliverable,
      catalogCode: item?.code ?? null,
      catalogName: item?.name ?? null,
      catalogVersion: item?.version ?? null,
      referenceTenths,
      quantity,
    },
  };
}
function canonical(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    check(Number.isFinite(value), 'INVALID_INPUT', 'Numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  const row = object(value);
  return Object.fromEntries(
    Object.keys(row)
      .filter((key) => row[key] !== undefined)
      .sort()
      .map((key) => [key, canonical(row[key])]),
  );
}
/** Direct optional fields have the same meaning as their JSON transport: absent. */
export function normalizeCommand(command: TimeCommand): TimeCommand {
  // Validate field names before optional undefined values are omitted. Otherwise a
  // direct caller could conceal unsupported input that JSON transport rejects.
  const row = object(command);
  switch (row.type) {
    case 'entry.create':
      keys(row, ['type', 'requestId', 'input']);
      keys(object(row.input), ENTRY_FIELDS);
      break;
    case 'entry.update':
      keys(row, ['type', 'requestId', 'id', 'expectedVersion', 'input']);
      keys(
        object(row.input),
        ENTRY_FIELDS.filter((key) => key !== 'agentId' && key !== 'companyId'),
      );
      break;
    case 'entry.void':
      keys(row, ['type', 'requestId', 'id', 'expectedVersion', 'reason']);
      break;
    case 'catalog.save':
      keys(row, ['type', 'requestId', 'expectedVersion', 'input']);
      keys(object(row.input), ['code', 'name', 'category', 'referenceHours']);
      break;
    case 'catalog.remove':
      keys(row, ['type', 'requestId', 'code', 'expectedVersion']);
      break;
    case 'timezone.set':
      keys(row, ['type', 'requestId', 'timezone']);
      break;
    default:
      throw new DomainError('INVALID_INPUT', 'Unsupported Time Tracker command.');
  }
  return canonical(command) as TimeCommand;
}
