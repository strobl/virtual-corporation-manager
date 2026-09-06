/** Delivery hours are booked human-equivalent effort, never runtime duration. */
export type TimeSource = 'manual' | 'agent';
export interface CatalogItem {
  code: string;
  name: string;
  category: string;
  referenceTenths: number;
  version: number;
  origin: 'bundled' | 'local';
}
export interface TimeBasis {
  kind: 'explicit' | 'catalog' | 'fallback';
  requestedDeliverable: string | null;
  catalogCode: string | null;
  catalogName: string | null;
  catalogVersion: number | null;
  referenceTenths: number | null;
  quantity: number;
}
export interface TimeEntry {
  id: string;
  companyId: string;
  agentId: string;
  companyName: string;
  agentName: string;
  date: string;
  tenths: number;
  description: string;
  clientProject: string;
  basis: TimeBasis;
  source: TimeSource;
  status: 'booked' | 'void';
  voidReason: string | null;
  workId: string | null;
  runId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface TimeEntryInput {
  agentId: string;
  companyId?: string;
  date: string;
  hours?: number;
  deliverable?: string;
  quantity?: number;
  description: string;
  clientProject?: string;
  workId?: string | null;
  runId?: string | null;
}
/** Identity stays fixed; a correction changes only explicitly supplied fields. */
export type TimeEntryEdit = Partial<Omit<TimeEntryInput, 'agentId' | 'companyId'>>;
export interface CatalogInput {
  code: string;
  name: string;
  category: string;
  referenceHours: number;
}
export type TimeCommand =
  | { type: 'entry.create'; requestId: string; input: TimeEntryInput }
  | {
      type: 'entry.update';
      requestId: string;
      id: string;
      expectedVersion: number;
      input: TimeEntryEdit;
    }
  | { type: 'entry.void'; requestId: string; id: string; expectedVersion: number; reason: string }
  | {
      type: 'catalog.save';
      requestId: string;
      expectedVersion: number | null;
      input: CatalogInput;
    }
  | { type: 'catalog.remove'; requestId: string; code: string; expectedVersion: number }
  | { type: 'timezone.set'; requestId: string; timezone: string };
export interface TimeHistoryEntry {
  id: string;
  entryId: string | null;
  catalogCode: string | null;
  action: TimeCommand['type'];
  source: TimeSource;
  createdAt: string;
  reason: string | null;
  before: TimeEntry | CatalogItem | { timezone: string } | null;
  after: TimeEntry | CatalogItem | { timezone: string } | null;
}
/** Persisted unchanged and returned verbatim when an identical request is replayed. */
export interface TimeReceipt {
  requestId: string;
  revision: number;
  entry?: TimeEntry;
  catalog?: CatalogItem | null;
  timezone?: string;
}
export interface TimeSnapshot {
  revision: number;
  timezone: string;
  today: string;
  entries: TimeEntry[];
  catalog: CatalogItem[];
  history: TimeHistoryEntry[];
}
export interface TimeStore {
  snapshot(): TimeSnapshot;
  mutate(command: TimeCommand, source: TimeSource): TimeReceipt;
}
export interface TimeIngressEntry extends TimeEntryInput {
  requestId: string;
}
export type TimeIngressResult =
  | { index: number; ok: true; receipt: TimeReceipt }
  | { index: number; ok: false; error: { code: string; message: string } };
