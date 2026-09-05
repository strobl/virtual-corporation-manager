import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Clock3, Download, Plus, RefreshCw, Search } from 'lucide-react';
import type { WorkspaceState } from '../domain/contracts';
import type {
  CatalogItem,
  TimeCommand,
  TimeEntry,
  TimeEntryInput,
  TimeHistoryEntry,
  TimeReceipt,
  TimeSnapshot,
} from '../time/contracts';
import { request } from './client';
import { Dialog } from './Dialogs';
import { roleLabel } from './model';
import {
  addTimeDays,
  aggregateTime,
  canBookTime,
  canSaveTimeDate,
  formatTenths,
  previewTimeCorrection,
  parseTimeHours,
  realTimeDate,
  resolveTimeEstimate,
  timeBasisLabel,
  timeDates,
  timeIdentities,
  timeMonday,
  timeRange,
  type TimeRangePreset,
} from './time-view-model';

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The local server could not save this change. Retry with your entered content.';
type Mutate = (command: TimeCommand) => Promise<TimeReceipt>;
type Day = { companyId: string; agentId: string; date: string };
type Modal =
  | { type: 'day'; day: Day }
  | { type: 'entry'; id: string }
  | { type: 'new'; day?: Day; deliverable?: string }
  | { type: 'edit'; id: string }
  | { type: 'void'; id: string }
  | { type: 'catalog'; item?: CatalogItem }
  | { type: 'catalog-remove'; item: CatalogItem };

function useTimeData(revision: number, onChanged: () => Promise<void>) {
  const [snapshot, setSnapshot] = useState<TimeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    setLoading(true);
    try {
      const next = await request<TimeSnapshot>('/api/time');
      if (ticket === sequence.current) {
        setSnapshot(next);
        setError(null);
      }
    } catch (cause) {
      if (ticket === sequence.current) setError(errorMessage(cause));
    } finally {
      if (ticket === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, revision]);
  const mutate: Mutate = async (command) => {
    const receipt = await request<TimeReceipt>('/api/time/mutate', command);
    if (receipt.entry)
      setSnapshot((current) =>
        current
          ? {
              ...current,
              revision: receipt.revision,
              entries: [
                ...current.entries.filter((row) => row.id !== receipt.entry!.id),
                receipt.entry!,
              ],
            }
          : current,
      );
    await refresh();
    await onChanged();
    return receipt;
  };
  return { snapshot, loading, error, refresh, mutate };
}

/** A transport failure keeps the same key for an identical retry, never another booking. */
function useRequestKey() {
  const previous = useRef({ signature: '', key: '' });
  return (payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (signature !== previous.current.signature)
      previous.current = { signature, key: crypto.randomUUID() };
    return previous.current.key;
  };
}

function companyOptions(state: WorkspaceState, snapshot: TimeSnapshot) {
  const rows = new Map(
    state.companies.map((row) => [
      row.id,
      { id: row.id, name: row.name, archived: row.status === 'archived' },
    ]),
  );
  for (const entry of snapshot.entries)
    if (!rows.has(entry.companyId))
      rows.set(entry.companyId, { id: entry.companyId, name: entry.companyName, archived: true });
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function TimeTracker({
  state,
  selectedCompanyId,
  selectedAgentId,
  onChanged,
  onOpenAgent,
  onOpenCompany,
  bookingRequest,
  onBookingRequestConsumed,
  onAddAgent,
}: {
  state: WorkspaceState;
  selectedCompanyId: string | null;
  selectedAgentId?: string | null;
  onChanged: () => Promise<void>;
  onOpenAgent: (id: string, companyId: string) => void;
  onOpenCompany: (id: string) => void;
  bookingRequest?: { id: number; companyId: string; agentId: string | null } | null;
  onBookingRequestConsumed?: () => void;
  onAddAgent?: (companyId: string) => void;
}) {
  const { snapshot, loading, error, refresh, mutate } = useTimeData(state.revision, onChanged);
  const [tab, setTab] = useState<'week' | 'catalog' | 'analytics'>('week');
  const [companyId, setCompanyId] = useState(selectedCompanyId ?? '');
  const [memberId, setMemberId] = useState(selectedAgentId ?? '');
  const [week, setWeek] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState('');
  const consumedBooking = useRef<number | null>(null);
  useEffect(() => {
    setCompanyId(selectedCompanyId ?? '');
    setMemberId(selectedAgentId ?? '');
  }, [selectedCompanyId, selectedAgentId]);
  useEffect(() => {
    if (snapshot && !week) setWeek(timeMonday(snapshot.today));
  }, [snapshot, week]);
  const companies = snapshot ? companyOptions(state, snapshot) : [];
  useEffect(() => {
    if (snapshot && !companyId && companies.length) setCompanyId(companies[0].id);
  }, [snapshot, companyId]);
  const members = useMemo(
    () => (snapshot && companyId ? timeIdentities(state, snapshot, companyId) : []),
    [state, snapshot, companyId],
  );
  useEffect(() => {
    if (!bookingRequest || !snapshot || consumedBooking.current === bookingRequest.id) return;
    consumedBooking.current = bookingRequest.id;
    const target = bookingRequest.companyId;
    const agentId =
      bookingRequest.agentId ??
      timeIdentities(state, snapshot, target).find((row) => canBookTime(state, target, row.id))?.id;
    setCompanyId(target);
    setMemberId(bookingRequest.agentId ?? '');
    setTab('week');
    if (agentId && canBookTime(state, target, agentId)) {
      setNotice('');
      setModal({ type: 'new', day: { companyId: target, agentId, date: snapshot.today } });
    } else {
      setNotice(
        bookingRequest.agentId
          ? 'This member cannot record a new entry for this corporation. Choose an eligible member in the Time Tracker.'
          : 'Add an agent to this corporation before recording delivery hours.',
      );
    }
    onBookingRequestConsumed?.();
  }, [bookingRequest, snapshot, state, onBookingRequestConsumed]);
  const filteredMembers = members.filter(
    (row) =>
      (!memberId || row.id === memberId) &&
      `${row.name} ${row.role}`.toLowerCase().includes(query.toLowerCase()),
  );
  const dates = week ? timeDates(week, addTimeDays(week, 6)) : [];
  const weekEntries =
    snapshot?.entries.filter(
      (row) =>
        row.companyId === companyId &&
        (!memberId || row.agentId === memberId) &&
        row.date >= week &&
        row.date <= (dates[6] ?? ''),
    ) ?? [];
  const weekTotal = weekEntries
    .filter((row) => row.status === 'booked')
    .reduce((sum, row) => sum + row.tenths, 0);
  const byCell = useMemo(() => {
    const index = new Map<string, TimeEntry[]>();
    for (const row of weekEntries) {
      const key = `${row.agentId}:${row.date}`;
      index.set(key, [...(index.get(key) ?? []), row]);
    }
    return index;
  }, [snapshot, companyId, memberId, week]);
  const selectedEntry =
    modal && 'id' in modal ? snapshot?.entries.find((row) => row.id === modal.id) : undefined;
  const done = (receipt: TimeReceipt) => {
    setNotice(
      receipt.entry
        ? 'Entry saved locally. Delivery hours and history updated.'
        : 'Catalog saved locally. Existing entry estimates are unchanged.',
    );
    setModal(receipt.entry ? { type: 'entry', id: receipt.entry.id } : null);
  };
  if (!snapshot)
    return (
      <div className="page-content time-page">
        <h1>Time Tracker</h1>
        <p role={error ? 'alert' : 'status'}>{error ?? 'Loading delivery hours…'}</p>
        {error && (
          <button className="button" onClick={() => void refresh()}>
            Retry
          </button>
        )}
      </div>
    );
  return (
    <div className="page-content time-page">
      <div className="section-intro compact-intro">
        <div>
          <h1>
            <Clock3 size={22} /> Time Tracker
          </h1>
          <p>
            Book human-equivalent delivery effort. Runtime duration and Work acceptance stay
            separate.
          </p>
        </div>
        <button className="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error} Previous data is shown.{' '}
          <button className="text-button" onClick={() => void refresh()}>
            Retry loading
          </button>
        </div>
      )}
      {notice && (
        <p className="time-notice" role="status">
          {notice}
        </p>
      )}
      <div className="time-topline">
        <div className="view-tabs" role="group" aria-label="Time Tracker view">
          {(
            [
              ['week', 'Weekly entries'],
              ['catalog', 'Deliverable catalog'],
              ['analytics', 'Hours analytics'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="muted small">
          Timezone: <strong>{snapshot.timezone}</strong>
        </span>
      </div>
      {tab === 'week' && (
        <>
          <div className="time-filters">
            <label>
              Company
              <select
                value={companyId}
                onChange={(event) => {
                  setCompanyId(event.target.value);
                  setMemberId('');
                }}
              >
                {companies.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.archived ? ' · historical' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Member
              <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                <option value="">All company members</option>
                {members.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.archived ? ' · historical' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="time-search">
              Find a role
              <input
                type="search"
                placeholder="Name or role…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={
                !companyId || !members.some((member) => canBookTime(state, companyId, member.id))
              }
              onClick={() =>
                setModal({
                  type: 'new',
                  ...(memberId
                    ? { day: { companyId, agentId: memberId, date: snapshot.today } }
                    : {}),
                })
              }
            >
              <Plus size={14} /> Book entry
            </button>
          </div>
          {!members.some((member) => canBookTime(state, companyId, member.id)) &&
            state.companies.some((row) => row.id === companyId && row.status === 'active') && (
              <div className="time-company-guidance">
                <div>
                  <strong>Add a member to start recording delivery hours</strong>
                  <p>
                    Create an agent with a role in this corporation, then log its work in the weekly
                    ledger.
                  </p>
                </div>
                {onAddAgent && (
                  <button className="button" onClick={() => onAddAgent(companyId)}>
                    <Plus size={14} /> Add agent
                  </button>
                )}
              </div>
            )}
          <div className="time-week-controls">
            <div className="button-row">
              <button
                className="icon-button"
                aria-label="Previous week"
                onClick={() => setWeek(addTimeDays(week, -7))}
                disabled={!week}
              >
                <ArrowLeft size={17} />
              </button>
              <strong>
                {week} – {dates[6]}
              </strong>
              <button
                className="icon-button"
                aria-label="Next week"
                onClick={() => setWeek(addTimeDays(week, 7))}
                disabled={!week}
              >
                <ArrowRight size={17} />
              </button>
              <button className="button" onClick={() => setWeek(timeMonday(snapshot.today))}>
                This week
              </button>
            </div>
            <span>
              <strong>{formatTenths(weekTotal)}h</strong> in{' '}
              {memberId ? 'selected member' : 'company'} week
            </span>
          </div>
          <p className="small muted time-context">
            Monday–Sunday · Each cell can hold multiple entries. Historical assignments support
            retroactive booking.{' '}
            {query &&
              'Search filters visible rows; the week total keeps the selected company/member scope.'}
          </p>
          <div
            className="time-grid-wrap"
            tabIndex={0}
            role="region"
            aria-label="Weekly delivery hours, horizontally scrollable"
          >
            <table className="time-grid">
              <caption className="sr-only">
                Weekly delivery hours for{' '}
                {companies.find((row) => row.id === companyId)?.name ?? 'company'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  {dates.map((date) => (
                    <th scope="col" key={date}>
                      <span>
                        {new Date(`${date}T12:00:00Z`).toLocaleDateString('en', {
                          weekday: 'short',
                          timeZone: 'UTC',
                        })}
                      </span>
                      <small>{date.slice(5)}</small>
                    </th>
                  ))}
                  <th scope="col">Week</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <th scope="row">
                      <button
                        className="text-button"
                        onClick={() => onOpenAgent(member.id, companyId)}
                      >
                        {member.name}
                      </button>
                      <small>
                        {member.archived ? 'Historical identity' : roleLabel(member.role)}
                      </small>
                    </th>
                    {dates.map((date) => {
                      const rows = byCell.get(`${member.id}:${date}`) ?? [];
                      const booked = rows.filter((row) => row.status === 'booked');
                      const tenths = booked.reduce((sum, row) => sum + row.tenths, 0);
                      return (
                        <td key={date}>
                          <button
                            className={`time-cell ${rows.length ? 'has-entries' : ''}`}
                            disabled={
                              (date > snapshot.today ||
                                !canBookTime(state, companyId, member.id)) &&
                              !rows.length
                            }
                            aria-label={`${member.name}, ${date}: ${formatTenths(tenths)} delivery hours, ${booked.length} booked entries${rows.length > booked.length ? `, ${rows.length - booked.length} void entries` : ''}`}
                            onClick={() =>
                              setModal({
                                type: 'day',
                                day: { companyId, agentId: member.id, date },
                              })
                            }
                          >
                            <strong>
                              {rows.length
                                ? `${formatTenths(tenths)}h`
                                : date > snapshot.today
                                  ? '—'
                                  : '+'}
                            </strong>
                            <small>
                              {rows.length
                                ? `${booked.length} ${booked.length === 1 ? 'entry' : 'entries'}`
                                : date > snapshot.today
                                  ? 'Future'
                                  : !canBookTime(state, companyId, member.id)
                                    ? 'Archived'
                                    : 'Add'}
                            </small>
                          </button>
                        </td>
                      );
                    })}
                    <td className="time-total">
                      {formatTenths(
                        weekEntries
                          .filter((row) => row.agentId === member.id && row.status === 'booked')
                          .reduce((sum, row) => sum + row.tenths, 0),
                      )}
                      h
                    </td>
                  </tr>
                ))}
                {!filteredMembers.length && (
                  <tr>
                    <td colSpan={9} className="list-empty">
                      {query || memberId
                        ? 'No members match these filters.'
                        : 'No assigned members. Add an agent to this company before booking time.'}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{query ? 'Visible rows' : 'Daily total'}</th>
                  {dates.map((date) => (
                    <td key={date}>
                      {formatTenths(
                        weekEntries
                          .filter(
                            (row) =>
                              row.date === date &&
                              row.status === 'booked' &&
                              filteredMembers.some((member) => member.id === row.agentId),
                          )
                          .reduce((sum, row) => sum + row.tenths, 0),
                      )}
                      h
                    </td>
                  ))}
                  <td>
                    {formatTenths(
                      weekEntries
                        .filter(
                          (row) =>
                            row.status === 'booked' &&
                            filteredMembers.some((member) => member.id === row.agentId),
                        )
                        .reduce((sum, row) => sum + row.tenths, 0),
                    )}
                    h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="time-entry-heading">
            <h2>Entries in this week</h2>
            <span className="small muted">
              Voids retain their history and contribute zero hours.
            </span>
          </div>
          <EntryList
            entries={weekEntries.filter(
              (row) => !query || filteredMembers.some((member) => member.id === row.agentId),
            )}
            onOpen={(id) => setModal({ type: 'entry', id })}
          />
        </>
      )}
      {tab === 'catalog' && (
        <CatalogView
          snapshot={snapshot}
          onEdit={(item) => setModal({ type: 'catalog', item })}
          onRemove={(item) => setModal({ type: 'catalog-remove', item })}
          onBook={(item) => setModal({ type: 'new', deliverable: item.code })}
        />
      )}
      {tab === 'analytics' && (
        <TimeAnalytics
          state={state}
          snapshot={snapshot}
          initialCompanyId={companyId}
          onOpenEntry={(id) => setModal({ type: 'entry', id })}
        />
      )}
      {modal?.type === 'day' && (
        <Dialog
          title={`${members.find((row) => row.id === modal.day.agentId)?.name ?? 'Member'} · ${modal.day.date}`}
          onClose={() => setModal(null)}
          wide
        >
          <div className="dialog-body">
            <p>
              {companies.find((row) => row.id === modal.day.companyId)?.name} · {snapshot.timezone}
            </p>
            <EntryList
              entries={snapshot.entries.filter(
                (row) =>
                  row.companyId === modal.day.companyId &&
                  row.agentId === modal.day.agentId &&
                  row.date === modal.day.date,
              )}
              onOpen={(id) => setModal({ type: 'entry', id })}
            />
            <div className="dialog-actions">
              <button className="button" onClick={() => setModal(null)}>
                Close
              </button>
              <button
                className="button primary"
                disabled={
                  modal.day.date > snapshot.today ||
                  !canBookTime(state, modal.day.companyId, modal.day.agentId)
                }
                onClick={() => setModal({ type: 'new', day: modal.day })}
              >
                <Plus size={14} /> Add entry
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {(modal?.type === 'new' || modal?.type === 'edit') && (
        <TimeEntryEditor
          key={modal.type === 'edit' ? modal.id : JSON.stringify(modal.day ?? {})}
          state={state}
          snapshot={snapshot}
          companyId={companyId}
          initialDay={modal.type === 'new' ? modal.day : undefined}
          initialDeliverable={modal.type === 'new' ? modal.deliverable : undefined}
          entry={modal.type === 'edit' ? selectedEntry : undefined}
          mutate={mutate}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'entry' && selectedEntry && (
        <EntryDetail
          entry={selectedEntry}
          history={snapshot.history.filter((row) => row.entryId === selectedEntry.id)}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ type: 'edit', id: selectedEntry.id })}
          onVoid={() => setModal({ type: 'void', id: selectedEntry.id })}
          onOpenAgent={() => {
            setModal(null);
            onOpenAgent(selectedEntry.agentId, selectedEntry.companyId);
          }}
          onOpenCompany={() => {
            setModal(null);
            onOpenCompany(selectedEntry.companyId);
          }}
        />
      )}
      {modal?.type === 'void' && selectedEntry && (
        <VoidEntry
          entry={selectedEntry}
          mutate={mutate}
          onDone={done}
          onClose={() => setModal({ type: 'entry', id: selectedEntry.id })}
        />
      )}
      {modal?.type === 'catalog' && (
        <CatalogEditor
          key={modal.item?.code ?? 'new'}
          item={modal.item}
          history={snapshot.history.filter((row) => row.catalogCode === modal.item?.code)}
          mutate={mutate}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'catalog-remove' && (
        <RemoveCatalog
          item={modal.item}
          mutate={mutate}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function EntryList({ entries, onOpen }: { entries: TimeEntry[]; onOpen: (id: string) => void }) {
  if (!entries.length)
    return (
      <p className="time-empty">
        No entries in this period. Book a dated entry to record delivery effort.
      </p>
    );
  return (
    <ul className="time-entries">
      {[...entries]
        .sort((a, b) => b.date.localeCompare(a.date) || a.createdAt.localeCompare(b.createdAt))
        .map((entry) => (
          <li key={entry.id}>
            <button
              className={`time-entry ${entry.status === 'void' ? 'is-void' : ''}`}
              onClick={() => onOpen(entry.id)}
            >
              <span className="time-entry-value">
                {formatTenths(entry.tenths)}h
                {entry.status === 'void' && <small>Void · excluded</small>}
              </span>
              <span className="time-entry-copy">
                <strong>{entry.description}</strong>
                <small>
                  {entry.date} · {entry.agentName} · {entry.companyName}
                  {entry.clientProject ? ` · ${entry.clientProject}` : ''}
                </small>
                <small>{timeBasisLabel(entry)}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          </li>
        ))}
    </ul>
  );
}

function TimeEntryEditor({
  state,
  snapshot,
  companyId: currentCompany,
  initialDay,
  initialDeliverable,
  entry: initialEntry,
  mutate,
  onDone,
  onClose,
}: {
  state: WorkspaceState;
  snapshot: TimeSnapshot;
  companyId: string;
  initialDay?: Day;
  initialDeliverable?: string;
  entry?: TimeEntry;
  mutate: Mutate;
  onDone: (receipt: TimeReceipt) => void;
  onClose: () => void;
}) {
  const [entry] = useState(initialEntry);
  const [companyId, setCompanyId] = useState(
    entry?.companyId ?? initialDay?.companyId ?? currentCompany,
  );
  const [agentId, setAgentId] = useState(entry?.agentId ?? initialDay?.agentId ?? '');
  const [date, setDate] = useState(entry?.date ?? initialDay?.date ?? snapshot.today);
  const [hours, setHours] = useState(
    entry?.basis.kind === 'explicit' ? formatTenths(entry.tenths) : '',
  );
  const [deliverable, setDeliverable] = useState(
    entry?.basis.requestedDeliverable ?? initialDeliverable ?? '',
  );
  const [quantity, setQuantity] = useState(String(entry?.basis.quantity ?? 1));
  const [description, setDescription] = useState(entry?.description ?? '');
  const [project, setProject] = useState(entry?.clientProject ?? '');
  const [workId, setWorkId] = useState(entry?.workId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyFor = useRequestKey();
  const members = timeIdentities(state, snapshot, companyId).filter(
    (row) =>
      state.agents.some((agent) => agent.id === row.id) &&
      state.assignments.some(
        (assignment) => assignment.agentId === row.id && assignment.companyId === companyId,
      ),
  );
  const correction = entry
    ? previewTimeCorrection(entry, hours, deliverable, quantity, snapshot.catalog)
    : null;
  const estimate =
    correction?.estimate ?? resolveTimeEstimate(hours, deliverable, quantity, snapshot.catalog);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!description.trim()) {
      setError('Describe what was delivered.');
      return;
    }
    if (!canSaveTimeDate(date, snapshot.today, entry?.date)) {
      setError(`Choose a real date on or before ${snapshot.today} (${snapshot.timezone}).`);
      return;
    }
    if ('error' in estimate) {
      setError(estimate.error);
      return;
    }
    if (!entry && (!companyId || !agentId)) {
      setError('Choose a company and one of its assigned members.');
      return;
    }
    const linked = state.work.find((row) => row.id === workId);
    const input = {
      ...(!entry || date !== entry.date ? { date } : {}),
      ...(!entry || description.trim() !== entry.description
        ? { description: description.trim() }
        : {}),
      ...(!entry || project.trim() !== entry.clientProject
        ? { clientProject: project.trim() }
        : {}),
      ...(correction
        ? correction.changes
        : {
            ...(hours.trim() ? { hours: Number(hours) } : {}),
            ...(deliverable.trim() ? { deliverable: deliverable.trim() } : {}),
            quantity: Number(quantity),
          }),
      ...(workId !== (entry?.workId ?? '')
        ? { workId: workId || null, runId: linked?.runId ?? null }
        : {}),
    };
    if (entry && !Object.keys(input).length) {
      setError(
        'No values have changed. Change a field or cancel. Saved hours and their basis are retained.',
      );
      return;
    }
    const payload = entry
      ? { type: 'entry.update' as const, id: entry.id, expectedVersion: entry.version, input }
      : {
          type: 'entry.create' as const,
          input: { ...input, companyId, agentId } as TimeEntryInput,
        };
    setBusy(true);
    setError(null);
    try {
      onDone(await mutate({ ...payload, requestId: keyFor(payload) }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={entry ? 'Correct time entry' : 'Book delivery hours'}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form className="dialog-body editor-form time-form" onSubmit={submit}>
        <p className="muted small">
          Delivery hours are booked effort, not elapsed runtime. Existing or historical company
          assignments allow retroactive booking.{' '}
          {entry && 'Company and member identity stay fixed; corrections retain history.'}
        </p>
        <div className="form-row time-entry-identity">
          <label>
            Company
            <select
              required
              value={companyId}
              disabled={!!entry || busy}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setAgentId('');
                setWorkId('');
              }}
            >
              <option value="">Choose company</option>
              {companyOptions(state, snapshot).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.archived ? ' · historical' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Member
            <select
              required
              value={agentId}
              disabled={!!entry || busy}
              onChange={(event) => {
                setAgentId(event.target.value);
                setWorkId('');
              }}
            >
              <option value="">Choose member</option>
              {entry && !members.some((row) => row.id === entry.agentId) && (
                <option value={entry.agentId}>{entry.agentName} · historical</option>
              )}
              {members.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.archived ? ' · archived' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Date · {snapshot.timezone}
          <input
            required
            type="date"
            max={entry && entry.date > snapshot.today ? entry.date : snapshot.today}
            value={date}
            disabled={busy}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            Hours · optional explicit override
            <input
              type="number"
              min="0.1"
              max="500"
              step="0.1"
              inputMode="decimal"
              placeholder="0.1–500, or use a deliverable"
              value={hours}
              disabled={busy}
              onChange={(event) => {
                setHours(event.target.value);
              }}
            />
          </label>
          <label>
            Quantity
            <input
              required
              type="number"
              min="0"
              max="100"
              step="any"
              value={quantity}
              disabled={busy}
              onChange={(event) => {
                setQuantity(event.target.value);
              }}
            />
          </label>
        </div>
        <label>
          Deliverable code or exact name · optional
          <input
            list="time-deliverable-options"
            maxLength={160}
            value={deliverable}
            disabled={busy}
            placeholder="Choose a catalog code or enter an unmatched deliverable"
            onChange={(event) => {
              setDeliverable(event.target.value);
            }}
          />
          <datalist id="time-deliverable-options">
            {snapshot.catalog.map((row) => (
              <option key={row.code} value={row.code}>
                {row.name} · {formatTenths(row.referenceTenths)}h
              </option>
            ))}
          </datalist>
        </label>
        <p
          className={`time-basis ${'kind' in estimate && estimate.kind === 'fallback' ? 'time-fallback' : ''}`}
          role="status"
        >
          {'error' in estimate ? estimate.error : estimate.label}
        </p>
        <label>
          What was delivered
          <textarea
            required
            maxLength={500}
            rows={4}
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          Client project · optional
          <input
            maxLength={160}
            value={project}
            disabled={busy}
            onChange={(event) => setProject(event.target.value)}
          />
        </label>
        <label>
          Link to an existing work result · optional
          <select
            value={workId}
            disabled={busy}
            onChange={(event) => setWorkId(event.target.value)}
          >
            <option value="">No linked result</option>
            {entry?.workId && !state.work.some((row) => row.id === entry.workId) && (
              <option value={entry.workId}>Historical work · {entry.workId}</option>
            )}
            {state.work
              .filter((row) => row.companyId === companyId && row.agentId === agentId)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title.slice(0, 100)} · {row.status}
                </option>
              ))}
          </select>
          <span className="small muted">Linking creates no run and does not accept a result.</span>
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {error} Your entered content is retained.
          </p>
        )}
        <div className="dialog-actions">
          <button className="button" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || 'error' in estimate}>
            {busy ? 'Saving…' : entry ? 'Save correction' : 'Book entry'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function EntryFacts({ entry }: { entry: TimeEntry }) {
  return (
    <dl className="time-facts">
      <dt>Delivery hours</dt>
      <dd>
        {formatTenths(entry.tenths)}h ·{' '}
        {entry.status === 'void' ? 'void, excluded from totals' : 'booked'}
      </dd>
      <dt>Date</dt>
      <dd>{entry.date}</dd>
      <dt>What was delivered</dt>
      <dd className="time-full-text">{entry.description}</dd>
      <dt>Client project</dt>
      <dd>{entry.clientProject || '—'}</dd>
      <dt>Calculation basis</dt>
      <dd>{timeBasisLabel(entry)}</dd>
      {entry.basis.requestedDeliverable && (
        <>
          <dt>Requested deliverable</dt>
          <dd>{entry.basis.requestedDeliverable}</dd>
          <dt>Quantity</dt>
          <dd>{entry.basis.quantity}</dd>
          <dt>Captured reference</dt>
          <dd>
            {entry.basis.catalogCode ?? 'No matched catalog code'}
            {entry.basis.referenceTenths !== null
              ? ` · ${formatTenths(entry.basis.referenceTenths)}h`
              : ''}
            {entry.basis.catalogVersion !== null ? ` · v${entry.basis.catalogVersion}` : ''}
          </dd>
        </>
      )}
      <dt>Origin</dt>
      <dd>
        {entry.source} · version {entry.version}
      </dd>
      {entry.voidReason && (
        <>
          <dt>Void reason</dt>
          <dd>{entry.voidReason}</dd>
        </>
      )}
    </dl>
  );
}
function History({ rows }: { rows: TimeHistoryEntry[] }) {
  if (!rows.length)
    return <p className="muted small">No history is present in the loaded snapshot.</p>;
  return (
    <ol className="time-history">
      {[...rows].reverse().map((row) => (
        <li key={row.id}>
          <details>
            <summary>
              {row.action.replace('entry.', '').replace('catalog.', '')} · {row.createdAt} ·{' '}
              {row.source}
            </summary>
            {row.reason && <p>{row.reason}</p>}
            {(['before', 'after'] as const).map((side) => {
              const value = row[side];
              return (
                <div key={side}>
                  <h4>{side === 'before' ? 'Before' : 'After'}</h4>
                  {value && 'tenths' in value ? (
                    <EntryFacts entry={value} />
                  ) : value && 'referenceTenths' in value ? (
                    <p>
                      {value.code} · {value.name} · {value.category} ·{' '}
                      {formatTenths(value.referenceTenths)}h · v{value.version}
                    </p>
                  ) : (
                    <p>{value && 'timezone' in value ? value.timezone : 'No record'}</p>
                  )}
                </div>
              );
            })}
          </details>
        </li>
      ))}
    </ol>
  );
}
function EntryDetail({
  entry,
  history,
  onClose,
  onEdit,
  onVoid,
  onOpenAgent,
  onOpenCompany,
}: {
  entry: TimeEntry;
  history: TimeHistoryEntry[];
  onClose: () => void;
  onEdit: () => void;
  onVoid: () => void;
  onOpenAgent: () => void;
  onOpenCompany: () => void;
}) {
  return (
    <Dialog title="Time entry details" onClose={onClose} wide>
      <div className="dialog-body">
        <div className="time-detail-context">
          <button className="text-button" onClick={onOpenCompany}>
            {entry.companyName}
          </button>
          <span> / </span>
          <button className="text-button" onClick={onOpenAgent}>
            {entry.agentName}
          </button>
        </div>
        <EntryFacts entry={entry} />
        <details className="text-disclosure">
          <summary>Identity and timestamps</summary>
          <dl className="time-facts">
            <dt>Entry ID</dt>
            <dd>{entry.id}</dd>
            <dt>Company ID</dt>
            <dd>{entry.companyId}</dd>
            <dt>Member ID</dt>
            <dd>{entry.agentId}</dd>
            <dt>Created</dt>
            <dd>{entry.createdAt}</dd>
            <dt>Updated</dt>
            <dd>{entry.updatedAt}</dd>
            {entry.workId && (
              <>
                <dt>Linked work ID</dt>
                <dd>{entry.workId}</dd>
              </>
            )}
            {entry.runId && (
              <>
                <dt>Linked run ID</dt>
                <dd>{entry.runId}</dd>
              </>
            )}
          </dl>
        </details>
        <h3>Correction history</h3>
        <History rows={history} />
        <div className="dialog-actions">
          <button className="button" onClick={onClose}>
            Close
          </button>
          {entry.status === 'booked' && (
            <>
              <button className="button danger" onClick={onVoid}>
                Void entry
              </button>
              <button className="button primary" onClick={onEdit}>
                Correct entry
              </button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
function VoidEntry({
  entry: initialEntry,
  mutate,
  onDone,
  onClose,
}: {
  entry: TimeEntry;
  mutate: Mutate;
  onDone: (receipt: TimeReceipt) => void;
  onClose: () => void;
}) {
  const [entry] = useState(initialEntry);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyFor = useRequestKey();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !reason.trim()) return;
    setBusy(true);
    setError(null);
    const payload = {
      type: 'entry.void' as const,
      id: entry.id,
      expectedVersion: entry.version,
      reason: reason.trim(),
    };
    try {
      onDone(await mutate({ ...payload, requestId: keyFor(payload) }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Void time entry"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="dialog-body editor-form" onSubmit={submit}>
        <p>
          Exclude {formatTenths(entry.tenths)}h from every total. The original entry and its
          correction history remain inspectable. This does not change Work acceptance.
        </p>
        <p className="time-full-text">{entry.description}</p>
        <label>
          Reason
          <input
            required
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="button danger" disabled={busy || !reason.trim()}>
            {busy ? 'Saving…' : 'Confirm void'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function CatalogView({
  snapshot,
  onEdit,
  onRemove,
  onBook,
}: {
  snapshot: TimeSnapshot;
  onEdit: (item?: CatalogItem) => void;
  onRemove: (item: CatalogItem) => void;
  onBook: (item: CatalogItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const categories = [...new Set(snapshot.catalog.map((row) => row.category))]
    .filter(Boolean)
    .sort();
  const items = snapshot.catalog.filter(
    (row) =>
      (!category || row.category === category) &&
      `${row.code} ${row.name} ${row.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="time-catalog">
      <div className="time-filters">
        <label className="time-search">
          Search catalog
          <input
            type="search"
            value={query}
            placeholder="Code, name, or business category…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Business category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="button primary" onClick={() => onEdit()}>
          <Plus size={14} /> Add deliverable
        </button>
      </div>
      <p className="small muted">
        {items.length} of {snapshot.catalog.length} deliverables. Reference hours estimate delivery
        effort. A local override replaces its bundled code; existing entry calculations remain
        unchanged.
      </p>
      <div
        className="time-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Deliverable catalog, horizontally scrollable"
      >
        <table className="time-table">
          <thead>
            <tr>
              <th>Code / deliverable</th>
              <th>Business category</th>
              <th>Reference hours</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code}>
                <td>
                  <code>{item.code}</code>
                  <strong>{item.name}</strong>
                </td>
                <td>{item.category || '—'}</td>
                <td>{formatTenths(item.referenceTenths)}h</td>
                <td>
                  {item.origin === 'bundled' ? 'Bundled' : 'Local override'} · v{item.version}
                </td>
                <td>
                  <div className="time-row-actions">
                    <button className="button" onClick={() => onBook(item)}>
                      Book
                    </button>
                    <button className="button" onClick={() => onEdit(item)}>
                      {item.origin === 'bundled' ? 'Override' : 'Edit'}
                    </button>
                    {item.origin === 'local' && (
                      <button className="text-button danger" onClick={() => onRemove(item)}>
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5}>
                  No deliverables match. Clear the filters or add a local deliverable.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CatalogEditor({
  item: initialItem,
  history,
  mutate,
  onDone,
  onClose,
}: {
  item?: CatalogItem;
  history: TimeHistoryEntry[];
  mutate: Mutate;
  onDone: (receipt: TimeReceipt) => void;
  onClose: () => void;
}) {
  const [item] = useState(initialItem);
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [hours, setHours] = useState(item ? formatTenths(item.referenceTenths) : '1.0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyFor = useRequestKey();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!code.trim() || !name.trim() || parseTimeHours(hours) === null) {
      setError('Enter a unique code, a name, and 0.1–500 reference hours in tenths.');
      return;
    }
    const payload = {
      type: 'catalog.save' as const,
      expectedVersion: item?.version ?? null,
      input: {
        code: code.trim(),
        name: name.trim(),
        category: category.trim(),
        referenceHours: Number(hours),
      },
    };
    setBusy(true);
    setError(null);
    try {
      onDone(await mutate({ ...payload, requestId: keyFor(payload) }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={
        item
          ? item.origin === 'bundled'
            ? 'Override catalog deliverable'
            : 'Edit catalog deliverable'
          : 'Add catalog deliverable'
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="dialog-body editor-form" onSubmit={submit}>
        <p className="muted small">
          This changes future estimates. Previously booked entries keep their captured reference and
          calculation history.
        </p>
        <label>
          Unique code
          <input
            required
            maxLength={60}
            value={code}
            disabled={busy || !!item}
            onChange={(event) => setCode(event.target.value)}
            placeholder="DELIVERABLE_CODE"
          />
        </label>
        <label>
          Name
          <input
            required
            maxLength={160}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Business category
          <input
            maxLength={80}
            value={category}
            disabled={busy}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        <label>
          Reference delivery hours
          <input
            required
            type="number"
            min="0.1"
            max="500"
            step="0.1"
            value={hours}
            disabled={busy}
            onChange={(event) => setHours(event.target.value)}
          />
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {error} Your draft is retained.
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save deliverable'}
          </button>
        </div>
        {!!history.length && (
          <details className="text-disclosure">
            <summary>Catalog history</summary>
            <History rows={history} />
          </details>
        )}
      </form>
    </Dialog>
  );
}

function RemoveCatalog({
  item: initialItem,
  mutate,
  onDone,
  onClose,
}: {
  item: CatalogItem;
  mutate: Mutate;
  onDone: (receipt: TimeReceipt) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyFor = useRequestKey();
  const [item] = useState(initialItem);
  const remove = async () => {
    if (busy) return;
    const payload = {
      type: 'catalog.remove' as const,
      code: item.code,
      expectedVersion: item.version,
    };
    setBusy(true);
    setError(null);
    try {
      onDone(await mutate({ ...payload, requestId: keyFor(payload) }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Remove local catalog override"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="dialog-body">
        <p>
          Remove{' '}
          <strong>
            {item.code} · {item.name}
          </strong>{' '}
          from the local catalog. If a bundled definition exists for this code, it becomes available
          again. Booked entries and catalog history are retained.
        </p>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button danger" disabled={busy} onClick={() => void remove()}>
            {busy ? 'Removing…' : 'Remove override'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function TimeAnalytics({
  state,
  snapshot,
  initialCompanyId,
  onOpenEntry,
}: {
  state: WorkspaceState;
  snapshot: TimeSnapshot;
  initialCompanyId: string;
  onOpenEntry: (id: string) => void;
}) {
  const [preset, setPreset] = useState<TimeRangePreset>('7');
  const [from, setFrom] = useState(addTimeDays(snapshot.today, -6));
  const [to, setTo] = useState(snapshot.today);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [memberId, setMemberId] = useState('');
  const [dayPage, setDayPage] = useState(0);
  const range = timeRange(preset, snapshot.today, from, to);
  const valid = realTimeDate(range.from) && realTimeDate(range.to) && range.from <= range.to;
  const entries = snapshot.entries.filter(
    (row) => (!companyId || row.companyId === companyId) && (!memberId || row.agentId === memberId),
  );
  const members = companyId
    ? timeIdentities(state, snapshot, companyId)
    : [
        ...new Map(
          snapshot.entries.map((row) => [row.agentId, { id: row.agentId, name: row.agentName }]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name));
  const totals = useMemo(
    () =>
      valid
        ? aggregateTime(entries, range.from, range.to, { offset: dayPage * 31, limit: 31 })
        : null,
    [snapshot, companyId, memberId, range.from, range.to, valid, dayPage],
  );
  useEffect(() => {
    setDayPage(0);
  }, [range.from, range.to, companyId, memberId]);
  const max = totals?.maxDayTenths ?? 1;
  const dayRows = totals?.days ?? [];
  return (
    <section className="time-analytics">
      <div className="time-filters">
        <label>
          Company
          <select
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setMemberId('');
            }}
          >
            <option value="">All companies</option>
            {companyOptions(state, snapshot).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.archived ? ' · historical' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Member
          <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">All members in scope</option>
            {members.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Inclusive period
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as TimeRangePreset)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="month">Current month</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label>
              From
              <input
                type="date"
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <p className="small muted">
        {range.from} – {range.to} · {snapshot.timezone} · Every booked entry counts; voids are
        excluded.
      </p>
      {!valid && (
        <p className="inline-error" role="alert">
          Choose two real dates with the end on or after the start.
        </p>
      )}
      {totals && (
        <>
          <div className="time-metrics">
            <div>
              <span>Delivery hours</span>
              <strong>{formatTenths(totals.tenths)}h</strong>
            </div>
            <div>
              <span>Hours per active day</span>
              <strong>
                {totals.activeDays ? (totals.tenths / 10 / totals.activeDays).toFixed(1) : '0.0'}h
              </strong>
              <small>
                {totals.activeDays} of {totals.dayCount} days booked
              </small>
            </div>
            <div>
              <span>Booked entries</span>
              <strong>{totals.count}</strong>
            </div>
          </div>
          {!totals.count && (
            <p className="time-empty">
              No delivery hours in this scope and period. Zero days remain visible below.
            </p>
          )}
          <div className="time-analytics-grid">
            <section className="time-analysis-card">
              <h2>Daily delivery hours</h2>
              <p className="small muted">Inclusive calendar dates, including zero days.</p>
              <table className="time-daily">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Delivery hours</th>
                    <th>Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{day.date}</th>
                      <td>
                        <span
                          className="time-bar"
                          aria-hidden="true"
                          style={{ width: `${(day.tenths / max) * 100}%` }}
                        />
                        <span>{formatTenths(day.tenths)}h</span>
                      </td>
                      <td>{day.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totals.dayCount > 31 && (
                <div className="time-pagination">
                  <button
                    className="button"
                    disabled={dayPage === 0}
                    onClick={() => setDayPage((page) => page - 1)}
                  >
                    Earlier dates
                  </button>
                  <span>
                    {dayPage * 31 + 1}–{Math.min((dayPage + 1) * 31, totals.dayCount)} of{' '}
                    {totals.dayCount} days
                  </span>
                  <button
                    className="button"
                    disabled={(dayPage + 1) * 31 >= totals.dayCount}
                    onClick={() => setDayPage((page) => page + 1)}
                  >
                    Later dates
                  </button>
                </div>
              )}
            </section>
            <div className="time-breakdowns">
              {(
                [
                  ['By company', totals.companies],
                  ['By member', totals.members],
                ] as const
              ).map(([title, rows]) => (
                <section className="time-analysis-card" key={title}>
                  <h2>{title}</h2>
                  <table className="time-breakdown">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Hours</th>
                        <th>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <th scope="row">{row.name}</th>
                          <td>{formatTenths(row.tenths)}h</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>Total</th>
                        <td>{formatTenths(totals.tenths)}h</td>
                        <td>{totals.count}</td>
                      </tr>
                    </tfoot>
                  </table>
                </section>
              ))}
            </div>
          </div>
          <details className="text-disclosure time-range-entries">
            <summary>Inspect entries in this period</summary>
            <EntryList
              entries={entries.filter((row) => row.date >= range.from && row.date <= range.to)}
              onOpen={onOpenEntry}
            />
          </details>
        </>
      )}
    </section>
  );
}

export function TimezoneSettings({
  revision,
  onChanged,
}: {
  revision: number;
  onChanged: () => Promise<void>;
}) {
  const { snapshot, error: loadError, mutate, refresh } = useTimeData(revision, onChanged);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const keyFor = useRequestKey();
  useEffect(() => {
    if (snapshot) setValue(snapshot.timezone);
  }, [snapshot?.timezone]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    try {
      if (/^[+-]/.test(value.trim())) throw new Error('IANA timezone required');
      new Intl.DateTimeFormat('en', { timeZone: value.trim() }).format();
    } catch {
      setError('Enter a valid IANA timezone, for example UTC or Europe/Berlin.');
      return;
    }
    const payload = { type: 'timezone.set' as const, timezone: value.trim() };
    setBusy(true);
    setError(null);
    try {
      const receipt = await mutate({ ...payload, requestId: keyFor(payload) });
      setSaved(`Timezone saved: ${receipt.timezone}. Existing booked dates are unchanged.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-card time-settings">
      <Clock3 size={24} />
      <h3>Time Tracker calendar</h3>
      <p>
        One saved timezone defines today, Monday weeks, and future-date validation. Changing it
        never shifts historical booked dates.
      </p>
      {!snapshot ? (
        <p role={loadError ? 'alert' : 'status'}>
          {loadError ?? 'Loading calendar…'}
          {loadError && (
            <button className="text-button" onClick={() => void refresh()}>
              Retry
            </button>
          )}
        </p>
      ) : (
        <form className="editor-form" onSubmit={submit}>
          <label>
            IANA timezone
            <input
              required
              value={value}
              disabled={busy}
              placeholder="Europe/Berlin"
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <span className="small muted">Current workspace date: {snapshot.today}</span>
          {(error || loadError) && (
            <p className="inline-error" role="alert">
              {error || loadError}
            </p>
          )}
          {saved && <p role="status">{saved}</p>}
          <button
            className="button"
            disabled={busy || !value.trim() || value === snapshot.timezone}
          >
            {busy ? 'Saving…' : 'Save timezone'}
          </button>
        </form>
      )}
      <a className="button" href="/api/time/export" download="gitflash-time-ledger.json">
        <Download size={14} /> Export time ledger & catalog
      </a>
    </section>
  );
}
