import type { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { DomainError, requireDomain as check } from '../domain/errors.js';
import type { WorkspaceState } from '../domain/contracts.js';
import type {
  CatalogItem,
  TimeBasis,
  TimeCommand,
  TimeEntry,
  TimeHistoryEntry,
  TimeReceipt,
  TimeSource,
  TimeStore,
} from './contracts.js';
import { BUNDLED_TIME_CATALOG } from './catalog-defaults.js';
import {
  calculateHours,
  calendarDate,
  catalogCode,
  keys,
  normalizeCommand,
  object,
  quantityOf,
  roundReferenceTenths,
  tenthsOf,
  text,
  timezoneOf,
  todayIn,
  validateEntryFields,
} from './rules.js';

/** Stable IDs and captured labels deliberately have no cascading configuration FKs.
 * Config snapshots may delete/reinsert their rows. Time history survives that operation.
 * Only the workspace migrator executes this string and calls seedTimeCatalog in its transaction.
 */
export const TIME_MIGRATION = `
CREATE TABLE time_meta (id INTEGER PRIMARY KEY CHECK(id=1), timezone TEXT NOT NULL, seeded INTEGER NOT NULL CHECK(seeded IN (0,1)));
CREATE TABLE time_entries (id TEXT PRIMARY KEY, info TEXT NOT NULL CHECK(json_valid(info)));
CREATE INDEX time_entries_company_date ON time_entries(json_extract(info,'$.companyId'),json_extract(info,'$.date'));
CREATE INDEX time_entries_agent_date ON time_entries(json_extract(info,'$.agentId'),json_extract(info,'$.date'));
CREATE TABLE time_history (id TEXT PRIMARY KEY, revision INTEGER NOT NULL UNIQUE, info TEXT NOT NULL CHECK(json_valid(info)));
CREATE TABLE time_catalog (code TEXT PRIMARY KEY COLLATE NOCASE, bundled TEXT CHECK(bundled IS NULL OR json_valid(bundled)), override TEXT CHECK(override IS NULL OR json_valid(override)), version INTEGER NOT NULL CHECK(version>=1));
CREATE TABLE time_requests (request_id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, receipt TEXT NOT NULL CHECK(json_valid(receipt)));
`;

type CatalogData = Omit<CatalogItem, 'origin' | 'version'>;
type Row = Record<string, unknown>;
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T;
const json = (value: unknown) => JSON.stringify(value);
const canonicalHash = (command: TimeCommand, source: TimeSource) =>
  createHash('sha256')
    .update(json({ command: normalizeCommand(command), source }))
    .digest('hex');
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const positiveVersion = (value: unknown) => {
  check(
    Number.isSafeInteger(value) && Number(value) >= 1,
    'INVALID_INPUT',
    'A positive expected version is required.',
  );
  return Number(value);
};

export function seedTimeCatalog(db: DatabaseSync): void {
  const meta = db.prepare('SELECT seeded FROM time_meta WHERE id=1').get();
  if (meta?.seeded === 1) return;
  check(!meta, 'INVALID_DATABASE', 'Incomplete Time Tracker initialization.');
  db.prepare('INSERT INTO time_meta VALUES (1,?,1)').run('UTC');
  const seen = new Set<string>();
  for (const value of BUNDLED_TIME_CATALOG) {
    validateCatalogData(value);
    check(!seen.has(value.code), 'INVALID_DATABASE', 'Bundled catalog codes must be unique.');
    seen.add(value.code);
    db.prepare('INSERT INTO time_catalog (code,bundled,override,version) VALUES (?,?,NULL,1)').run(
      value.code,
      json(value),
    );
  }
}

function effectiveCatalog(row: Row | undefined): CatalogItem | null {
  if (!row || (row.override === null && row.bundled === null)) return null;
  return {
    ...parse<CatalogData>(row.override ?? row.bundled),
    version: Number(row.version),
    origin: row.override !== null ? 'local' : 'bundled',
  };
}
function catalog(db: DatabaseSync): CatalogItem[] {
  return db
    .prepare('SELECT * FROM time_catalog ORDER BY code')
    .all()
    .flatMap((row) => {
      const item = effectiveCatalog(row);
      return item ? [item] : [];
    });
}
function validateCatalogData(value: unknown): asserts value is CatalogData {
  const item = object(value);
  keys(item, ['code', 'name', 'category', 'referenceTenths']);
  check(catalogCode(item.code) === item.code, 'INVALID_INPUT', 'Stored catalog code is invalid.');
  text(item.name, 'Catalog name', 160);
  text(item.category, 'Category', 100, true);
  check(
    Number.isSafeInteger(item.referenceTenths) &&
      Number(item.referenceTenths) >= 1 &&
      Number(item.referenceTenths) <= 5000,
    'INVALID_INPUT',
    'Invalid catalog reference hours.',
  );
}
function validateCatalogItem(value: unknown): asserts value is CatalogItem {
  const item = object(value);
  keys(item, ['code', 'name', 'category', 'referenceTenths', 'version', 'origin']);
  validateCatalogData({
    code: item.code,
    name: item.name,
    category: item.category,
    referenceTenths: item.referenceTenths,
  });
  positiveVersion(item.version);
  check(
    item.origin === 'bundled' || item.origin === 'local',
    'INVALID_INPUT',
    'Invalid catalog origin.',
  );
}
function validateBasis(value: unknown, tenths: number): asserts value is TimeBasis {
  const b = object(value);
  keys(b, [
    'kind',
    'requestedDeliverable',
    'catalogCode',
    'catalogName',
    'catalogVersion',
    'referenceTenths',
    'quantity',
  ]);
  check(
    ['explicit', 'catalog', 'fallback'].includes(String(b.kind)),
    'INVALID_INPUT',
    'Invalid hours basis.',
  );
  quantityOf(b.quantity);
  if (b.requestedDeliverable !== null) text(b.requestedDeliverable, 'Requested deliverable', 160);
  if (b.catalogCode !== null) {
    check(
      catalogCode(b.catalogCode) === b.catalogCode,
      'INVALID_INPUT',
      'Invalid captured catalog code.',
    );
    text(b.catalogName, 'Captured catalog name', 160);
    positiveVersion(b.catalogVersion);
    check(
      b.requestedDeliverable !== null,
      'INVALID_INPUT',
      'Catalog basis requires a requested deliverable.',
    );
  } else
    check(
      b.catalogName === null && b.catalogVersion === null,
      'INVALID_INPUT',
      'Invalid captured catalog identity.',
    );
  if (b.referenceTenths !== null)
    check(
      Number.isSafeInteger(b.referenceTenths) &&
        Number(b.referenceTenths) >= 1 &&
        Number(b.referenceTenths) <= 5000,
      'INVALID_INPUT',
      'Invalid captured reference hours.',
    );
  if (b.kind === 'catalog')
    check(
      b.catalogCode !== null && b.referenceTenths !== null,
      'INVALID_INPUT',
      'Incomplete catalog basis.',
    );
  if (b.kind === 'fallback')
    check(
      b.requestedDeliverable !== null && b.catalogCode === null && b.referenceTenths === 80,
      'INVALID_INPUT',
      'Incomplete fallback estimate.',
    );
  if (b.kind !== 'explicit')
    check(
      roundReferenceTenths(Number(b.referenceTenths), Number(b.quantity)) === tenths,
      'INVALID_INPUT',
      'Captured calculation does not match delivery hours.',
    );
}
function timestamp(value: unknown) {
  check(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value)),
    'INVALID_INPUT',
    'Invalid stored timestamp.',
  );
}
function validateEntry(value: unknown): asserts value is TimeEntry {
  const e = object(value);
  keys(e, [
    'id',
    'companyId',
    'agentId',
    'companyName',
    'agentName',
    'date',
    'tenths',
    'description',
    'clientProject',
    'basis',
    'source',
    'status',
    'voidReason',
    'workId',
    'runId',
    'version',
    'createdAt',
    'updatedAt',
  ]);
  for (const field of ['id', 'companyId', 'agentId', 'companyName', 'agentName'])
    text(e[field], field);
  calendarDate(e.date);
  check(
    Number.isSafeInteger(e.tenths) && Number(e.tenths) >= 1 && Number(e.tenths) <= 5000,
    'INVALID_INPUT',
    'Invalid stored delivery hours.',
  );
  text(e.description, 'Description', 500);
  text(e.clientProject, 'Client project', 160, true);
  validateBasis(e.basis, Number(e.tenths));
  check(e.source === 'manual' || e.source === 'agent', 'INVALID_INPUT', 'Invalid source.');
  check(e.status === 'booked' || e.status === 'void', 'INVALID_INPUT', 'Invalid entry status.');
  if (e.status === 'void') text(e.voidReason, 'Void reason', 500);
  else check(e.voidReason === null, 'INVALID_INPUT', 'A booked entry cannot have a void reason.');
  for (const field of ['workId', 'runId']) if (e[field] !== null) text(e[field], field);
  positiveVersion(e.version);
  timestamp(e.createdAt);
  timestamp(e.updatedAt);
  check(
    String(e.updatedAt) >= String(e.createdAt),
    'INVALID_INPUT',
    'Entry timestamps are out of order.',
  );
}

/** Validate stored data without re-resolving mutable assignments/catalogs or repricing history. */
export function validateTimeData(db: DatabaseSync): void {
  try {
    const meta = db.prepare('SELECT * FROM time_meta').all();
    check(
      meta.length === 1 && meta[0]!.id === 1 && meta[0]!.seeded === 1,
      'INVALID_DATABASE',
      'Time Tracker settings are incomplete.',
    );
    timezoneOf(meta[0]!.timezone);
    const revision = Number(
      db.prepare('SELECT revision FROM workspace_meta WHERE id=1').get()!.revision,
    );
    const entries = new Map<string, TimeEntry>();
    for (const row of db.prepare('SELECT * FROM time_entries').all()) {
      const entry = parse<TimeEntry>(row.info);
      validateEntry(entry);
      check(entry.id === row.id, 'INVALID_DATABASE', 'Time entry identity does not match its row.');
      entries.set(entry.id, entry);
    }
    for (const row of db.prepare('SELECT * FROM time_catalog').all()) {
      check(catalogCode(row.code) === row.code, 'INVALID_DATABASE', 'Invalid catalog row code.');
      positiveVersion(row.version);
      for (const field of ['bundled', 'override'])
        if (row[field] !== null) {
          const data = parse<CatalogData>(row[field]);
          validateCatalogData(data);
          check(
            data.code === row.code,
            'INVALID_DATABASE',
            'Catalog identity does not match its row.',
          );
        }
    }
    const previous = new Map<string, TimeEntry>();
    const historyRevisions = new Set<number>();
    for (const row of db.prepare('SELECT * FROM time_history ORDER BY revision').all()) {
      const h = parse<TimeHistoryEntry>(row.info);
      keys(object(h), [
        'id',
        'entryId',
        'catalogCode',
        'action',
        'source',
        'createdAt',
        'reason',
        'before',
        'after',
      ]);
      check(
        h.id === row.id &&
          Number.isSafeInteger(row.revision) &&
          Number(row.revision) >= 1 &&
          Number(row.revision) <= revision,
        'INVALID_DATABASE',
        'Invalid time history identity or revision.',
      );
      check(
        h.source === 'manual' || h.source === 'agent',
        'INVALID_DATABASE',
        'Invalid history source.',
      );
      timestamp(h.createdAt);
      if (h.reason !== null) text(h.reason, 'Reason', 500);
      check(
        [
          'entry.create',
          'entry.update',
          'entry.void',
          'catalog.save',
          'catalog.remove',
          'timezone.set',
        ].includes(h.action),
        'INVALID_DATABASE',
        'Invalid time history action.',
      );
      const change = db
        .prepare('SELECT action,undoable FROM changes WHERE revision=?')
        .get(Number(row.revision));
      check(
        change?.action === `time.${h.action}` && change.undoable === 0,
        'INVALID_DATABASE',
        'Time history has no matching irreversible workspace change.',
      );
      if (h.action.startsWith('entry.')) {
        check(
          h.entryId !== null && h.catalogCode === null,
          'INVALID_DATABASE',
          'Invalid entry history target.',
        );
        validateEntry(h.after);
        check(
          h.after.id === h.entryId && entries.has(h.entryId),
          'INVALID_DATABASE',
          'History refers to an unavailable entry.',
        );
        const old = previous.get(h.entryId);
        if (h.action === 'entry.create')
          check(
            !old && h.before === null && h.after.version === 1 && h.after.status === 'booked',
            'INVALID_DATABASE',
            'Invalid entry creation history.',
          );
        else {
          validateEntry(h.before);
          check(
            old &&
              json(old) === json(h.before) &&
              h.after.version === old.version + 1 &&
              h.after.agentId === old.agentId &&
              h.after.companyId === old.companyId &&
              h.after.createdAt === old.createdAt &&
              old.status === 'booked',
            'INVALID_DATABASE',
            'Entry correction history is discontinuous.',
          );
          check(
            h.after.status === (h.action === 'entry.void' ? 'void' : 'booked'),
            'INVALID_DATABASE',
            'Invalid correction status.',
          );
        }
        previous.set(h.entryId, h.after);
      } else if (h.action.startsWith('catalog.')) {
        check(
          h.entryId === null &&
            h.catalogCode !== null &&
            catalogCode(h.catalogCode) === h.catalogCode,
          'INVALID_DATABASE',
          'Invalid catalog history target.',
        );
        if (h.before !== null) validateCatalogItem(h.before);
        if (h.after !== null) validateCatalogItem(h.after);
      } else {
        check(
          h.entryId === null && h.catalogCode === null && h.before !== null && h.after !== null,
          'INVALID_DATABASE',
          'Invalid timezone history.',
        );
        timezoneOf((h.before as { timezone: string }).timezone);
        timezoneOf((h.after as { timezone: string }).timezone);
      }
      historyRevisions.add(Number(row.revision));
    }
    for (const [id, entry] of entries)
      check(
        json(previous.get(id)) === json(entry),
        'INVALID_DATABASE',
        'The current time entry does not match its history.',
      );
    const receipts = db.prepare('SELECT * FROM time_requests').all();
    check(
      receipts.length === historyRevisions.size,
      'INVALID_DATABASE',
      'Time receipt and history counts differ.',
    );
    const receiptRevisions = new Set<number>();
    for (const row of receipts) {
      text(row.request_id, 'Request ID', 120);
      check(
        typeof row.request_hash === 'string' && /^[a-f0-9]{64}$/.test(row.request_hash),
        'INVALID_DATABASE',
        'Invalid time request fingerprint.',
      );
      const receipt = parse<TimeReceipt>(row.receipt);
      keys(object(receipt), ['requestId', 'revision', 'entry', 'catalog', 'timezone']);
      check(
        receipt.requestId === row.request_id &&
          historyRevisions.has(receipt.revision) &&
          !receiptRevisions.has(receipt.revision),
        'INVALID_DATABASE',
        'Invalid stored time receipt.',
      );
      receiptRevisions.add(receipt.revision);
      if (receipt.entry) validateEntry(receipt.entry);
      if (receipt.catalog) validateCatalogItem(receipt.catalog);
      if (receipt.timezone) timezoneOf(receipt.timezone);
    }
  } catch (error) {
    if (error instanceof DomainError && error.code === 'INVALID_DATABASE') throw error;
    throw new DomainError(
      'INVALID_DATABASE',
      'Time Tracker data is invalid or incomplete. Restore a verified backup.',
    );
  }
}

export function createTimeStore(db: DatabaseSync, workspace: () => WorkspaceState): TimeStore {
  const readEntry = (id: string): TimeEntry => {
    const row = db.prepare('SELECT info FROM time_entries WHERE id=?').get(id);
    check(row, 'NOT_FOUND', 'Time entry not found.');
    return parse<TimeEntry>(row.info);
  };
  const verifyLinks = (
    entry: Pick<TimeEntry, 'agentId' | 'companyId' | 'workId' | 'runId'>,
    state: WorkspaceState,
  ) => {
    if (entry.workId !== null) {
      const work = state.work.find((row) => row.id === entry.workId);
      check(
        work && work.agentId === entry.agentId && work.companyId === entry.companyId,
        'INVALID_REFERENCE',
        'The linked work must belong to this agent and company.',
      );
      if (entry.runId !== null)
        check(
          work.runId === entry.runId,
          'INVALID_REFERENCE',
          'The linked work and run must belong together.',
        );
    }
    if (entry.runId !== null) {
      const run = db.prepare('SELECT info FROM integration_runs WHERE id=?').get(entry.runId);
      const info = run ? parse<Row>(run.info) : null;
      check(
        info && info.agentId === entry.agentId && info.companyId === entry.companyId,
        'INVALID_REFERENCE',
        'The linked run must belong to this agent and company.',
      );
    }
  };
  return {
    snapshot() {
      const timezone = String(
        db.prepare('SELECT timezone FROM time_meta WHERE id=1').get()!.timezone,
      );
      return {
        revision: Number(
          db.prepare('SELECT revision FROM workspace_meta WHERE id=1').get()!.revision,
        ),
        timezone,
        today: todayIn(timezone),
        entries: db
          .prepare("SELECT info FROM time_entries ORDER BY json_extract(info,'$.date') DESC,rowid")
          .all()
          .map((row) => parse<TimeEntry>(row.info)),
        catalog: catalog(db),
        history: db
          .prepare('SELECT info FROM time_history ORDER BY revision')
          .all()
          .map((row) => parse<TimeHistoryEntry>(row.info)),
      };
    },
    mutate(command: TimeCommand, source: TimeSource): TimeReceipt {
      command = normalizeCommand(command);
      const raw = object(command, 'Command');
      check(
        source === 'manual' || source === 'agent',
        'INVALID_INPUT',
        'Time source must be manual or agent.',
      );
      const requestId = text(raw.requestId, 'Request ID', 120);
      check(
        requestId === raw.requestId,
        'INVALID_INPUT',
        'Request ID must not contain outer whitespace.',
      );
      const hash = canonicalHash(command, source);
      db.exec('BEGIN IMMEDIATE');
      try {
        const replay = db
          .prepare('SELECT request_hash,receipt FROM time_requests WHERE request_id=?')
          .get(requestId);
        if (replay) {
          check(
            replay.request_hash === hash,
            'CONFLICT',
            'This request ID was already used for different input or source. Use a new request ID.',
          );
          const receipt = parse<TimeReceipt>(replay.receipt);
          db.exec('COMMIT');
          return receipt;
        }
        const state = workspace();
        const oldRevision = Number(
          db.prepare('SELECT revision FROM workspace_meta WHERE id=1').get()!.revision,
        );
        check(
          state.revision === oldRevision,
          'CONFLICT',
          'Workspace changed. Refresh before recording time.',
        );
        const now = new Date().toISOString();
        const timezone = String(
          db.prepare('SELECT timezone FROM time_meta WHERE id=1').get()!.timezone,
        );
        const today = todayIn(timezone);
        const history: TimeHistoryEntry = {
          id: randomUUID(),
          entryId: null,
          catalogCode: null,
          action: command.type,
          source,
          createdAt: now,
          reason: null,
          before: null,
          after: null,
        };
        const receipt: TimeReceipt = { requestId, revision: oldRevision + 1 };
        let summary: string;
        switch (command.type) {
          case 'entry.create': {
            keys(raw, ['type', 'requestId', 'input']);
            const input = object(command.input);
            validateEntryFields(input);
            const agentId = text(input.agentId, 'Agent ID');
            const agent = state.agents.find((row) => row.id === agentId);
            check(agent, 'NOT_FOUND', 'Agent not found.');
            let companyId =
              input.companyId === undefined ? null : text(input.companyId, 'Company ID');
            if (companyId === null) {
              const primary = state.assignments.filter(
                (row) =>
                  row.agentId === agentId &&
                  row.endedAt === null &&
                  row.isPrimary &&
                  state.companies.some(
                    (company) => company.id === row.companyId && company.status === 'active',
                  ),
              );
              check(
                primary.length === 1,
                'AMBIGUOUS_COMPANY',
                'Specify a company: this agent has no unambiguous active primary assignment.',
              );
              companyId = primary[0]!.companyId;
            }
            const company = state.companies.find((row) => row.id === companyId);
            check(company, 'NOT_FOUND', 'Company not found.');
            check(
              agent.status === 'active' && company.status === 'active',
              'ARCHIVED_ENTITY',
              'Restore the archived agent and company, or select active identities, before recording new delivery hours. Existing entries can still be corrected or voided.',
            );
            check(
              state.assignments.some(
                (row) => row.agentId === agentId && row.companyId === companyId,
              ),
              'NO_ASSIGNMENT',
              'This agent must have a current or historical assignment to the specified company.',
            );
            const date = calendarDate(input.date);
            check(
              date <= today,
              'INVALID_DATE',
              `Delivery date cannot be after ${today} in ${timezone}.`,
            );
            const calculation = calculateHours(command.input, catalog(db));
            const entry: TimeEntry = {
              id: randomUUID(),
              companyId,
              agentId,
              companyName: company.name,
              agentName: agent.name,
              date,
              ...calculation,
              description: text(input.description, 'Description', 500),
              clientProject:
                input.clientProject === undefined
                  ? ''
                  : text(input.clientProject, 'Client project', 160, true),
              source,
              status: 'booked',
              voidReason: null,
              workId: input.workId == null ? null : text(input.workId, 'Work ID'),
              runId: input.runId == null ? null : text(input.runId, 'Run ID'),
              version: 1,
              createdAt: now,
              updatedAt: now,
            };
            verifyLinks(entry, state);
            validateEntry(entry);
            db.prepare('INSERT INTO time_entries (id,info) VALUES (?,?)').run(
              entry.id,
              json(entry),
            );
            history.entryId = entry.id;
            history.after = entry;
            receipt.entry = entry;
            summary = `Record ${entry.tenths / 10} delivery hours for ${entry.agentName}`;
            break;
          }
          case 'entry.update': {
            keys(raw, ['type', 'requestId', 'id', 'expectedVersion', 'input']);
            const before = readEntry(text(command.id, 'Entry ID'));
            check(
              before.version === positiveVersion(command.expectedVersion),
              'CONFLICT',
              'This time entry changed. Refresh before correcting it.',
            );
            check(
              before.status === 'booked',
              'CONFLICT',
              'A void entry cannot be corrected. Record a new entry if needed.',
            );
            const input = object(command.input);
            validateEntryFields(input, true);
            check(
              Object.keys(input).length > 0,
              'INVALID_INPUT',
              'Supply at least one correction.',
            );
            const entry = structuredClone(before);
            if (own(input, 'date')) {
              entry.date = calendarDate(input.date);
              check(
                entry.date <= today,
                'INVALID_DATE',
                `Delivery date cannot be after ${today} in ${timezone}.`,
              );
            }
            if (own(input, 'description'))
              entry.description = text(input.description, 'Description', 500);
            if (own(input, 'clientProject'))
              entry.clientProject = text(input.clientProject, 'Client project', 160, true);
            if (['hours', 'deliverable', 'quantity'].some((key) => own(input, key))) {
              const quantity = own(input, 'quantity')
                ? quantityOf(input.quantity)
                : before.basis.quantity;
              const requested = own(input, 'deliverable')
                ? text(input.deliverable, 'Deliverable', 160)
                : null;
              const sameDeliverable =
                requested === null ||
                [
                  before.basis.requestedDeliverable,
                  before.basis.catalogCode,
                  before.basis.catalogName,
                ].some(
                  (value) => value !== null && value.toLowerCase() === requested.toLowerCase(),
                );
              const hoursChanged = own(input, 'hours') && tenthsOf(input.hours) !== before.tenths;
              if (!sameDeliverable) {
                const calculated = calculateHours(
                  {
                    ...(own(input, 'hours') ? { hours: command.input.hours } : {}),
                    deliverable: requested!,
                    quantity,
                  },
                  catalog(db),
                );
                entry.tenths = calculated.tenths;
                entry.basis = calculated.basis;
              } else {
                // A quantity correction uses the original captured reference, even if the
                // live catalog changed or was removed. Resending current hours is a no-op.
                entry.basis = {
                  ...before.basis,
                  quantity,
                  ...(hoursChanged ? { kind: 'explicit' as const } : {}),
                };
                entry.tenths = hoursChanged
                  ? tenthsOf(input.hours)
                  : entry.basis.kind === 'explicit'
                    ? before.tenths
                    : roundReferenceTenths(entry.basis.referenceTenths!, quantity);
                check(
                  entry.tenths >= 1 && entry.tenths <= 5000,
                  'INVALID_INPUT',
                  'The corrected delivery hours must be greater than zero and at most 500.',
                );
              }
            }
            for (const key of ['workId', 'runId'] as const)
              if (own(input, key)) entry[key] = input[key] === null ? null : text(input[key], key);
            // Existing historical links remain intact if configuration is later archived/removed.
            if (own(input, 'workId') || own(input, 'runId')) verifyLinks(entry, state);
            entry.version += 1;
            entry.updatedAt = now;
            validateEntry(entry);
            db.prepare('UPDATE time_entries SET info=? WHERE id=?').run(json(entry), entry.id);
            history.entryId = entry.id;
            history.before = before;
            history.after = entry;
            receipt.entry = entry;
            summary = `Correct delivery hours for ${entry.agentName}`;
            break;
          }
          case 'entry.void': {
            keys(raw, ['type', 'requestId', 'id', 'expectedVersion', 'reason']);
            const before = readEntry(text(command.id, 'Entry ID'));
            check(
              before.version === positiveVersion(command.expectedVersion) &&
                before.status === 'booked',
              'CONFLICT',
              'This time entry changed or is already void. Refresh before voiding it.',
            );
            const reason = text(command.reason, 'Void reason', 500);
            const entry: TimeEntry = {
              ...before,
              status: 'void',
              voidReason: reason,
              version: before.version + 1,
              updatedAt: now,
            };
            db.prepare('UPDATE time_entries SET info=? WHERE id=?').run(json(entry), entry.id);
            history.entryId = entry.id;
            history.before = before;
            history.after = entry;
            history.reason = reason;
            receipt.entry = entry;
            summary = `Void delivery hours for ${entry.agentName}`;
            break;
          }
          case 'catalog.save': {
            keys(raw, ['type', 'requestId', 'expectedVersion', 'input']);
            const input = object(command.input);
            keys(input, ['code', 'name', 'category', 'referenceHours']);
            const code = catalogCode(input.code);
            const row = db.prepare('SELECT * FROM time_catalog WHERE code=?').get(code);
            const before = effectiveCatalog(row);
            check(
              command.expectedVersion === null
                ? before === null
                : before !== null && before.version === positiveVersion(command.expectedVersion),
              'CONFLICT',
              'This catalog item changed. Refresh before saving it.',
            );
            const data: CatalogData = {
              code,
              name: text(input.name, 'Catalog name', 160),
              category: text(input.category, 'Category', 100, true),
              referenceTenths: tenthsOf(input.referenceHours),
            };
            const version = row ? Number(row.version) + 1 : 1;
            db.prepare(
              'INSERT INTO time_catalog (code,bundled,override,version) VALUES (?,NULL,?,?) ON CONFLICT(code) DO UPDATE SET override=excluded.override,version=excluded.version',
            ).run(code, json(data), version);
            const after: CatalogItem = { ...data, version, origin: 'local' };
            history.catalogCode = code;
            history.before = before;
            history.after = after;
            receipt.catalog = after;
            summary = `Save delivery catalog item ${code}`;
            break;
          }
          case 'catalog.remove': {
            keys(raw, ['type', 'requestId', 'code', 'expectedVersion']);
            const code = catalogCode(command.code);
            const row = db.prepare('SELECT * FROM time_catalog WHERE code=?').get(code);
            const before = effectiveCatalog(row);
            check(row && before, 'NOT_FOUND', 'Catalog item not found.');
            check(
              before.version === positiveVersion(command.expectedVersion),
              'CONFLICT',
              'This catalog item changed. Refresh before removing its override.',
            );
            check(
              row.override !== null,
              'CATALOG_NOT_OVERRIDDEN',
              'This is a bundled default. Only a local override can be removed.',
            );
            db.prepare('UPDATE time_catalog SET override=NULL,version=version+1 WHERE code=?').run(
              code,
            );
            const after = effectiveCatalog(
              db.prepare('SELECT * FROM time_catalog WHERE code=?').get(code),
            );
            history.catalogCode = code;
            history.before = before;
            history.after = after;
            receipt.catalog = after;
            summary = `Remove local catalog override ${code}`;
            break;
          }
          case 'timezone.set': {
            keys(raw, ['type', 'requestId', 'timezone']);
            const next = timezoneOf(command.timezone);
            db.prepare('UPDATE time_meta SET timezone=? WHERE id=1').run(next);
            history.before = { timezone };
            history.after = { timezone: next };
            receipt.timezone = next;
            summary = `Set Time Tracker timezone to ${next}`;
            break;
          }
          default:
            throw new DomainError('INVALID_INPUT', 'Unsupported Time Tracker command.');
        }
        db.prepare('UPDATE workspace_meta SET revision=? WHERE id=1').run(receipt.revision);
        db.prepare(
          'INSERT INTO changes (id,action,summary,revision,createdAt,beforeJson,afterJson,undoable) VALUES (?,?,?,?,?,?,?,0)',
        ).run(
          randomUUID(),
          `time.${command.type}`,
          summary,
          receipt.revision,
          now,
          json({ ...state, history: [] }),
          json({ ...state, revision: receipt.revision, history: [] }),
        );
        db.prepare('INSERT INTO time_history (id,revision,info) VALUES (?,?,?)').run(
          history.id,
          receipt.revision,
          json(history),
        );
        db.prepare(
          'INSERT INTO time_requests (request_id,request_hash,receipt) VALUES (?,?,?)',
        ).run(requestId, hash, json(receipt));
        db.exec('COMMIT');
        return structuredClone(receipt);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
