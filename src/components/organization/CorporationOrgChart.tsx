// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
/**
 * Internal Org Chart — Layer B.
 *
 * This canvas answers exactly one question: inside ONE virtual corporation,
 * who is above whom? It never draws holdings, PropCos or ownership; those are
 * Layer A (the Corporate Structure Explorer). People and agents are the only
 * nodes, and the default Pyramid layout makes the reporting depth obvious at
 * a glance: one row per level, top leader centred at the top.
 */
import { useMemo, useState } from 'react';
import {
  EMPTY_PYRAMID_FILTERS,
  buildOrgPyramid,
  commandChain,
  filterPyramid,
  pyramidTreeRows,
  type OrgPerson,
  type PyramidFilters,
} from '@/lib/organization/org-pyramid';
import type { WorkspaceSnapshot } from '@/lib/organization/tree';

export const ORG_CHART_LAYOUTS = ['pyramid', 'tree', 'manager'] as const;
export type OrgChartLayout = (typeof ORG_CHART_LAYOUTS)[number];

const LAYOUT_LABELS: Record<OrgChartLayout, string> = {
  pyramid: 'Pyramid',
  tree: 'Tree',
  manager: 'Manager',
};

const LEVEL_CAPTIONS = [
  'Company lead',
  'Department heads',
  'Team leads',
  'Seniors & specialists',
  'Individual contributors',
];

function levelCaption(level: number): string {
  return LEVEL_CAPTIONS[level] ?? `Level ${level}`;
}

function KindBadge({ kind }: { kind: OrgPerson['kind'] }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-1 py-px text-micro font-medium text-muted-foreground">
      <span aria-hidden="true">{kind === 'agent' ? '✦' : '☺'}</span>
      {kind === 'agent' ? 'Agent' : 'Human'}
    </span>
  );
}

function PersonCard({
  person,
  selected,
  dimmed,
  onSelect,
}: {
  person: OrgPerson;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`org-person-${person.id}`}
      className={`focus-console flex w-44 flex-col gap-0.5 rounded-lg bg-card px-2.5 py-1.5 text-left transition-opacity ${
        selected
          ? 'border-2 border-primary'
          : person.kind === 'agent'
            ? 'border border-dashed border-foreground/40 hover:border-foreground/70'
            : 'border border-border hover:border-foreground/50'
      } ${dimmed ? 'opacity-35' : ''}`}
    >
      <span className="truncate text-xs font-medium text-foreground">{person.name}</span>
      <span className="truncate text-micro text-muted-foreground">{person.role || '—'}</span>
      <span className="flex flex-wrap items-center gap-1 text-micro text-muted-foreground">
        <KindBadge kind={person.kind} />
        <span>Level {person.level}</span>
      </span>
      <span className="truncate text-micro tabular-nums text-muted-foreground">
        {person.directReportIds.length} direct
        {person.department ? ` · ${person.department}` : ''}
      </span>
    </button>
  );
}

export interface CorporationOrgChartProps {
  snapshot: WorkspaceSnapshot;
  corporationId: string;
  corporationName: string;
  /** Called after a reporting line changed, so the caller can refetch. */
  selection?: string | null;
  onSelectAgent?: (id: string | null) => void;
  onBack?: () => void;
}

export function CorporationOrgChart({
  snapshot,
  corporationId,
  corporationName,
  selection = null,
  onSelectAgent,
  onBack,
}: CorporationOrgChartProps) {
  const pyramid = useMemo(
    () => buildOrgPyramid(snapshot, corporationId),
    [snapshot, corporationId],
  );
  const [layout, setLayout] = useState<OrgChartLayout>('pyramid');
  const [filters, setFilters] = useState<PyramidFilters>(EMPTY_PYRAMID_FILTERS);
  const [groupByDepartment, setGroupByDepartment] = useState(false);
  const [highlightChain, setHighlightChain] = useState(true);
  const focusedId = selection;
  const setFocusedId = (value: string | null | ((id: string | null) => string | null)) =>
    onSelectAgent?.(typeof value === 'function' ? value(focusedId) : value);
  const [collapsedIds, setCollapsedIds] = useState<readonly string[]>([]);

  const rows = useMemo(() => filterPyramid(pyramid, filters), [pyramid, filters]);
  const chain = useMemo(
    () => (highlightChain ? commandChain(pyramid, focusedId) : new Set<string>()),
    [pyramid, focusedId, highlightChain],
  );
  const focused = focusedId ? (pyramid.byId.get(focusedId) ?? null) : null;

  const dimmed = (person: OrgPerson) => chain.size > 0 && !chain.has(person.id);

  if (pyramid.counts.people === 0) {
    return (
      <div className="flex flex-col gap-3" data-testid="corporation-org-chart">
        <Header
          corporationName={corporationName}
          pyramid={pyramid}
          onBack={onBack ?? null}
          layout={layout}
          setLayout={setLayout}
        />
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
          No people or agents are assigned to {corporationName} yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="corporation-org-chart">
      <Header
        corporationName={corporationName}
        pyramid={pyramid}
        onBack={onBack ?? null}
        layout={layout}
        setLayout={setLayout}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-header/50 px-2 py-1.5">
        <input
          type="search"
          value={filters.query}
          onChange={(event) => setFilters((f) => ({ ...f, query: event.target.value }))}
          placeholder="Search people, roles, teams…"
          aria-label="Search org chart"
          data-testid="org-chart-search"
          className="focus-console w-52 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
        />
        <label className="flex items-center gap-1 text-micro text-muted-foreground">
          Kind
          <select
            aria-label="Filter by kind"
            value={filters.kind}
            onChange={(event) =>
              setFilters((f) => ({ ...f, kind: event.target.value as PyramidFilters['kind'] }))
            }
            className="focus-console rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
          >
            <option value="all">Humans & agents</option>
            <option value="human">Humans only</option>
            <option value="agent">Agents only</option>
          </select>
        </label>
        {pyramid.departments.length > 0 ? (
          <label className="flex items-center gap-1 text-micro text-muted-foreground">
            Team
            <select
              aria-label="Filter by department"
              value={filters.department}
              onChange={(event) => setFilters((f) => ({ ...f, department: event.target.value }))}
              className="focus-console rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
            >
              <option value="all">All teams</option>
              {pyramid.departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-1 text-micro text-muted-foreground">
          Depth
          <select
            aria-label="Filter by level"
            data-testid="org-chart-depth"
            value={filters.maxLevel === null ? 'all' : String(filters.maxLevel)}
            onChange={(event) =>
              setFilters((f) => ({
                ...f,
                maxLevel: event.target.value === 'all' ? null : Number(event.target.value),
              }))
            }
            className="focus-console rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
          >
            <option value="all">Expand all</option>
            {pyramid.levels.map((_, level) => (
              <option key={level} value={level}>
                Levels 0–{level}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-micro text-muted-foreground">
          <input
            type="checkbox"
            checked={groupByDepartment}
            onChange={(event) => setGroupByDepartment(event.target.checked)}
            className="focus-console size-3.5 rounded border-border"
          />
          Group by department
        </label>
        <label className="flex items-center gap-1 text-micro text-muted-foreground">
          <input
            type="checkbox"
            checked={highlightChain}
            onChange={(event) => setHighlightChain(event.target.checked)}
            className="focus-console size-3.5 rounded border-border"
          />
          Highlight chain of command
        </label>
        {layout === 'tree' ? (
          <>
            <button
              type="button"
              onClick={() => setCollapsedIds(pyramid.people.map((p) => p.id))}
              className="focus-console rounded border border-border px-2 py-0.5 text-micro text-muted-foreground hover:text-foreground"
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={() => setCollapsedIds([])}
              className="focus-console rounded border border-border px-2 py-0.5 text-micro text-muted-foreground hover:text-foreground"
            >
              Expand all
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setFilters(EMPTY_PYRAMID_FILTERS);
            setFocusedId(null);
          }}
          className="focus-console ml-auto rounded border border-border px-2 py-0.5 text-micro text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          {layout === 'pyramid' ? (
            <div className="flex flex-col gap-3" data-testid="org-chart-pyramid">
              {rows.map((row, level) =>
                row.length === 0 ? null : (
                  <section
                    key={level}
                    data-testid={`org-level-${level}`}
                    className="rounded-xl border border-border bg-surface-header/40 px-3 py-2"
                  >
                    <header className="mb-1.5 flex items-baseline gap-2">
                      <h4 className="text-xs font-semibold text-foreground">Level {level}</h4>
                      <span className="text-micro text-muted-foreground">
                        {levelCaption(level)} · {row.length}{' '}
                        {row.length === 1 ? 'member' : 'members'}
                      </span>
                    </header>
                    {groupByDepartment ? (
                      <div className="flex flex-col gap-2">
                        {groupRows(row).map(([department, people]) => (
                          <div key={department} className="flex flex-col gap-1">
                            <span className="text-micro uppercase tracking-wide text-muted-foreground">
                              {department}
                            </span>
                            <div className="flex flex-wrap justify-center gap-2">
                              {people.map((person) => (
                                <PersonCard
                                  key={person.id}
                                  person={person}
                                  selected={focusedId === person.id}
                                  dimmed={dimmed(person)}
                                  onSelect={() =>
                                    setFocusedId((id) => (id === person.id ? null : person.id))
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-2">
                        {row.map((person) => (
                          <PersonCard
                            key={person.id}
                            person={person}
                            selected={focusedId === person.id}
                            dimmed={dimmed(person)}
                            onSelect={() =>
                              setFocusedId((id) => (id === person.id ? null : person.id))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ),
              )}
            </div>
          ) : null}

          {layout === 'tree' ? (
            <ul className="flex flex-col gap-1" data-testid="org-chart-tree">
              {pyramidTreeRows(pyramid, new Set(collapsedIds))
                .filter(({ person }) => rows[person.level]?.includes(person))
                .map(({ person, depth }) => (
                  <li key={person.id} style={{ paddingLeft: depth * 20 }}>
                    <div className="flex items-center gap-2">
                      {person.directReportIds.length > 0 ? (
                        <button
                          type="button"
                          aria-label={
                            collapsedIds.includes(person.id) ? 'Expand branch' : 'Collapse branch'
                          }
                          onClick={() =>
                            setCollapsedIds((ids) =>
                              ids.includes(person.id)
                                ? ids.filter((id) => id !== person.id)
                                : [...ids, person.id],
                            )
                          }
                          className="focus-console w-4 text-micro text-muted-foreground"
                        >
                          {collapsedIds.includes(person.id) ? '▸' : '▾'}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                      <PersonCard
                        person={person}
                        selected={focusedId === person.id}
                        dimmed={dimmed(person)}
                        onSelect={() => setFocusedId((id) => (id === person.id ? null : person.id))}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          ) : null}

          {layout === 'manager' ? (
            <div className="flex flex-col gap-3" data-testid="org-chart-manager">
              {pyramid.people
                .filter((person) => person.directReportIds.length > 0)
                .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
                .map((manager) => (
                  <section
                    key={manager.id}
                    className="rounded-xl border border-border bg-surface-header/40 px-3 py-2"
                  >
                    <header className="mb-1.5 flex flex-wrap items-baseline gap-2">
                      <h4 className="text-xs font-semibold text-foreground">{manager.name}</h4>
                      <span className="text-micro text-muted-foreground">
                        {manager.role} · Level {manager.level} · {manager.directReportIds.length}{' '}
                        direct · {manager.totalReports} total
                      </span>
                    </header>
                    <div className="flex flex-wrap gap-2">
                      {manager.directReportIds
                        .map((id) => pyramid.byId.get(id))
                        .filter((p): p is OrgPerson => Boolean(p))
                        .map((person) => (
                          <PersonCard
                            key={person.id}
                            person={person}
                            selected={focusedId === person.id}
                            dimmed={dimmed(person)}
                            onSelect={() =>
                              setFocusedId((id) => (id === person.id ? null : person.id))
                            }
                          />
                        ))}
                    </div>
                  </section>
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function groupRows(row: readonly OrgPerson[]): [string, OrgPerson[]][] {
  const map = new Map<string, OrgPerson[]>();
  for (const person of row) {
    const key = person.department ?? 'Unassigned';
    const bucket = map.get(key);
    if (bucket) bucket.push(person);
    else map.set(key, [person]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function Header({
  corporationName,
  pyramid,
  onBack,
  layout,
  setLayout,
}: {
  corporationName: string;
  pyramid: ReturnType<typeof buildOrgPyramid>;
  onBack: (() => void) | null;
  layout: OrgChartLayout;
  setLayout: (layout: OrgChartLayout) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          data-testid="org-chart-back"
          className="focus-console rounded border border-border px-2 py-0.5 text-micro text-muted-foreground hover:text-foreground"
        >
          ← Structure
        </button>
      ) : null}
      <h3 className="text-xs font-semibold text-foreground">{corporationName} — Reporting lines</h3>
      <span className="text-micro tabular-nums text-muted-foreground">
        {pyramid.counts.humans} people · {pyramid.counts.agents} agents ·{' '}
        {pyramid.counts.departments} teams · {pyramid.counts.depth} levels
      </span>
      <div
        role="tablist"
        aria-label="Org chart layout"
        className="ml-auto flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-[2px]"
      >
        {ORG_CHART_LAYOUTS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={layout === candidate}
            data-testid={`org-layout-${candidate}`}
            onClick={() => setLayout(candidate)}
            className={
              layout === candidate
                ? 'focus-console rounded-md bg-card px-3 py-1 text-xs font-medium text-foreground shadow-xs'
                : 'focus-console rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
            }
          >
            {LAYOUT_LABELS[candidate]}
          </button>
        ))}
      </div>
    </div>
  );
}
