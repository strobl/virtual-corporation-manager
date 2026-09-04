import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  GitBranch,
  Layers3,
  LayoutGrid,
  List,
  Menu,
  Pencil,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Undo2,
  X,
} from 'lucide-react';
import { brand } from '../brand';
import type {
  Agent,
  ChangePreview,
  DomainCommand,
  TemplateSummary,
  WorkspaceState,
} from '../domain/contracts';
import { DenseTree } from '../components/ds/DenseTree';
import { CorporationOrgChart } from '../components/organization/CorporationOrgChart';
import { client, request, type UndoPreview } from './client';
import {
  companyAgents,
  companyForSelection,
  organizationTree,
  parseSelection,
  selectionKey,
  selectedTreeRows,
  toSnapshot,
  type Selection,
} from './model';
import { Dialog, EntityEditor, PreviewDialog, type EditorTarget } from './Dialogs';
import { CompanyMap } from './CompanyMap';
import { TextDisclosure } from './TextDisclosure';
import { BrandMark } from './BrandMark';
import { createWorkViewModel, getRunTargetCompany } from './work-view-model';
import { AdvancedDialog, type AdvancedTarget } from './AdvancedDialogs';
import {
  IntegrationsView,
  RunDialog,
  WorkView,
  type IntegrationStatus,
  type RunInfo,
} from './Work';

type Area = 'organization' | 'work' | 'integrations' | 'activity' | 'settings';
type View = 'map' | 'reporting' | 'list';
const AREA_NAMES: Record<Area, string> = {
  organization: 'Organization',
  work: 'Work',
  integrations: 'Integrations',
  activity: 'Activity',
  settings: 'Settings',
};
const AREAS = [
  { id: 'organization', icon: Building2 },
  { id: 'work', icon: Activity },
  { id: 'integrations', icon: PlugZap },
] as const;
type PendingChange =
  | { kind: 'commands'; commands: DomainCommand[]; summary: string }
  | { kind: 'template'; id: string };
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function App() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [area, setArea] = useState<Area>('organization');
  const [workScope, setWorkScope] = useState<'company' | 'all'>('company');
  const [view, setView] = useState<View>('map');
  const [selection, setSelection] = useState<Selection | null>(() =>
    parseSelection(new URLSearchParams(location.search).get('selected') ?? ''),
  );
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedTarget | null>(null);
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [undoPreview, setUndoPreview] = useState<UndoPreview | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [runAgent, setRunAgent] = useState<Agent | null>(null);
  const [initialRunId, setInitialRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const drawerUsed = useRef(false);
  useEffect(() => {
    if (navOpen) {
      drawerUsed.current = true;
      drawerClose.current?.focus();
    } else if (drawerUsed.current) menuButton.current?.focus();
  }, [navOpen]);
  const [showInspector, setShowInspector] = useState(true);
  const [archived, setArchived] = useState(false);

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      client.state(),
      client.templates(),
      request<IntegrationStatus>('/api/integrations'),
      request<RunInfo[]>('/api/runs'),
    ]);
    if (results[0].status === 'fulfilled') {
      setState(results[0].value);
      setError(null);
    } else setError(message(results[0].reason));
    if (results[1].status === 'fulfilled') setTemplates(results[1].value);
    if (results[2].status === 'fulfilled') setStatus(results[2].value);
    if (results[3].status === 'fulfilled') setRuns(results[3].value);
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const running = runs.some((run) => run.status === 'queued' || run.status === 'running');
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [running, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const url = new URL(location.href);
    if (selection) url.searchParams.set('selected', selectionKey(selection));
    else url.searchParams.delete('selected');
    history.replaceState(null, '', url);
  }, [selection]);
  useEffect(() => {
    if (!state) return;
    const valid =
      selection &&
      (selection.kind === 'company'
        ? state.companies.some((row) => row.id === selection.id && row.status === 'active')
        : selection.kind === 'department'
          ? state.departments.some(
              (row) =>
                row.id === selection.id &&
                state.companies.some(
                  (company) => company.id === row.companyId && company.status === 'active',
                ),
            )
          : state.agents.some((row) => row.id === selection.id && row.status === 'active'));
    if (!valid) {
      const first = state.companies.find((row) => row.status === 'active');
      setSelection(first ? { kind: 'company', id: first.id } : null);
    }
    setExpanded((previous) => [
      ...new Set([...previous, ...state.companies.map((row) => `company:${row.id}`)]),
    ]);
  }, [state]);
  const companyId = state ? companyForSelection(state, selection) : null;
  const company = state?.companies.find((row) => row.id === companyId);
  const companyWork = state ? createWorkViewModel(state, runs, companyId) : null;
  const runCompany = state && runAgent ? getRunTargetCompany(state, runAgent.id) : null;
  const tree = useMemo(() => (state ? organizationTree(state, query) : []), [state, query]);
  const snapshot = useMemo(() => (state ? toSnapshot(state) : null), [state]);
  const select = (value: Selection) => {
    setInitialRunId(null);
    setWorkScope('company');
    setSelection(
      value.kind === 'agent' && !value.companyId && companyId ? { ...value, companyId } : value,
    );
    setShowInspector(true);
    setNavOpen(false);
  };
  const openAdvanced = (target: AdvancedTarget) => {
    setModalError(null);
    setAdvanced(target);
  };
  const openEditor = (target: EditorTarget) => {
    setModalError(null);
    setEditor(target);
  };
  const announce = (text: string) => setToast(text);
  const prepare = async (change: PendingChange, revision?: number) => {
    if (!state) return;
    setBusy(true);
    setModalError(null);
    setPending(change);
    try {
      const next =
        change.kind === 'template'
          ? await client.template(change.id, revision ?? state.revision)
          : await client.preview(change.commands, revision ?? state.revision, change.summary);
      setPreview(next);
      setEditor(null);
      setTemplatesOpen(false);
      setAdvanced(null);
    } catch (cause) {
      setModalError(message(cause));
      if (!editor && !preview && !templatesOpen && !advanced) setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const refreshPreview = async () => {
    if (!pending) return;
    try {
      const fresh = await client.state();
      setState(fresh);
      await prepare(pending, fresh.revision);
    } catch (cause) {
      setModalError(message(cause));
    }
  };
  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    setModalError(null);
    try {
      const result = await client.apply(preview.id);
      setState(result.state);
      setPreview(null);
      setPending(null);
      announce(
        result.replayed
          ? 'This change was already applied.'
          : 'Changes saved. Your company is up to date.',
      );
    } catch (cause) {
      setModalError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const undo = async (id: string) => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    setModalError(null);
    try {
      setUndoPreview(await client.undoPreview(id, state.revision));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const confirmUndo = async () => {
    if (!undoPreview || busy) return;
    setBusy(true);
    setModalError(null);
    try {
      setState(await client.undo(undoPreview.changeId, undoPreview.baseRevision));
      setUndoPreview(null);
      announce('Configuration change undone. Work evidence was retained.');
    } catch (cause) {
      setModalError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const command = (commands: DomainCommand[], summary: string) =>
    prepare({ kind: 'commands', commands, summary });
  const activeCompanies = state?.companies.filter((row) => row.status === 'active') ?? [];
  const activeAgents = state?.agents.filter((row) => row.status === 'active') ?? [];
  const agents = state && companyId ? companyAgents(state, companyId) : [];
  const selectedDepartment =
    selection?.kind === 'department'
      ? state?.departments.find((row) => row.id === selection.id)
      : null;
  const selectedAgent =
    selection?.kind === 'agent' ? state?.agents.find((row) => row.id === selection.id) : null;
  const filteredAgents = agents.filter(
    (agent) =>
      (!selectedDepartment || agent.departmentId === selectedDepartment.id) &&
      (!query ||
        [agent.name, agent.role, ...agent.responsibilities].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        )),
  );
  const navigate = (value: Area) => {
    setInitialRunId(null);
    if (value === 'work') setWorkScope('company');
    setArea(value);
    setNavOpen(false);
  };

  return (
    <div className="gitflash" style={{ '--brand-accent': brand.accent } as React.CSSProperties}>
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      {navOpen && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${navOpen ? 'open' : ''}`}
        aria-label="Workspace navigation"
        onKeyDown={(event) => {
          if (!navOpen) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            setNavOpen(false);
          }
          if (event.key === 'Tab') {
            const elements = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input, [tabindex="0"]',
              ),
            ).filter((element) => element.getClientRects().length > 0);
            const first = elements[0],
              last = elements.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <button
          ref={drawerClose}
          className="icon-button drawer-close"
          aria-label="Close navigation drawer"
          onClick={() => setNavOpen(false)}
        >
          <X size={18} />
        </button>
        <a className="brand" href="/" aria-label={`${brand.name} home`}>
          <BrandMark size={36} decorative />
          <strong>{brand.name}</strong>
          <span className="local-badge">local</span>
        </a>
        <nav className="primary-nav" aria-label="Primary">
          {AREAS.map(({ id, icon: Icon }) => (
            <button
              className={area === id ? 'active' : ''}
              aria-current={area === id ? 'page' : undefined}
              onClick={() => navigate(id)}
              key={id}
            >
              <Icon size={17} />
              {AREA_NAMES[id]}
              {id === 'work' && !!companyWork?.stats.reviewable && (
                <span
                  className="activity-count"
                  aria-label={`${companyWork.stats.reviewable} results need your review in ${companyWork.scopeName}`}
                >
                  {companyWork.stats.reviewable}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-label">
          <span>YOUR COMPANIES</span>
          <button
            className="icon-button"
            aria-label="Create company"
            onClick={() => openEditor({ kind: 'company' })}
          >
            <Plus size={16} />
          </button>
        </div>
        <label className="sidebar-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a team or agent…"
            aria-label="Search organization"
          />
          {query && (
            <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={12} />
            </button>
          )}
        </label>
        <div className="organization-navigation">
          {tree.length ? (
            <DenseTree
              label="Company organization"
              nodes={tree}
              expandedIds={query ? allTreeIds(tree) : expanded}
              onExpandedChange={(ids) => setExpanded([...ids])}
              selectedIds={selectedTreeRows(tree, selection)}
              typeahead
              onSelect={(key) => {
                const next = parseSelection(key);
                if (next) {
                  select(next);
                  setArea('organization');
                }
              }}
            />
          ) : (
            <p className="sidebar-empty">
              {query
                ? 'No matches. Try a name or responsibility.'
                : 'Your company will appear here.'}
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <button
            onClick={() => navigate('activity')}
            className={area === 'activity' ? 'active' : ''}
          >
            <Activity size={16} />
            Activity & undo
          </button>
          <button
            onClick={() => navigate('settings')}
            className={area === 'settings' ? 'active' : ''}
          >
            <Settings2 size={16} />
            Settings
          </button>
          <div className="local-status">
            <span className="live-dot" />
            <span>On your computer</span>
            <ShieldCheck size={13} />
          </div>
        </div>
      </aside>
      <div className="workspace" inert={navOpen || undefined}>
        <header className="topbar">
          <button
            ref={menuButton}
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>{AREA_NAMES[area]}</span>
            {company && area === 'organization' && (
              <>
                <ChevronRight size={14} />
                <button onClick={() => select({ kind: 'company', id: company.id })}>
                  {company.name}
                </button>
                {selectedDepartment && (
                  <>
                    <ChevronRight size={14} />
                    <span>{selectedDepartment.name}</span>
                  </>
                )}
                {selectedAgent && (
                  <>
                    <ChevronRight size={14} />
                    <span>{selectedAgent.name}</span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="topbar-actions">
            <span className="saved-status">
              <CheckCircle2 size={13} />
              {loading ? 'Connecting…' : 'Saved locally'}
            </span>
            {area === 'organization' && (
              <button
                className="button"
                aria-label="Templates"
                onClick={() => {
                  setModalError(null);
                  setTemplatesOpen(true);
                }}
              >
                <Layers3 size={15} />
                <span>Templates</span>
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <button onClick={() => void refresh()} className="text-button">
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {loading ? (
            <div className="empty-state">
              <RefreshCw className="spin" size={25} />
              <h2>Opening your company…</h2>
              <p>Connecting to the local server.</p>
            </div>
          ) : !state ? (
            <div className="empty-state">
              <h2>The local server is unavailable</h2>
              <p>Start GitFlash in your terminal, then retry.</p>
              <button className="button primary" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {area === 'organization' && (
                <>
                  {!activeCompanies.length ? (
                    <div className="welcome">
                      <div className="welcome-copy">
                        <span className="eyebrow">GIVE YOUR IDEA A PLACE TO WORK</span>
                        <h1>
                          Your company.
                          <br />
                          <span>In your hands.</span>
                        </h1>
                        <p>
                          Your own company of AI agents. Organize your team, assign work, and decide
                          what happens next.
                        </p>
                        <div className="welcome-actions">
                          <button
                            className="button primary large"
                            onClick={() => openEditor({ kind: 'company' })}
                          >
                            Create a company
                            <ArrowRight size={17} />
                          </button>
                          <button className="button large" onClick={() => setTemplatesOpen(true)}>
                            Explore templates
                          </button>
                        </div>
                        <div className="welcome-note">
                          <ShieldCheck size={15} />
                          Local first. Open source. No account required.
                        </div>
                      </div>
                      <div className="welcome-illustration">
                        <div className="flash-stage">
                          <span className="flash-orbit" aria-hidden="true" />
                          <img
                            className="welcome-flash"
                            src="/flash-character.svg"
                            width={300}
                            height={350}
                            alt="Flash, the GitFlash character"
                          />
                          <div className="flash-role role-product">
                            <span aria-hidden="true">P</span>Product
                          </div>
                          <div className="flash-role role-marketing">
                            <span aria-hidden="true">M</span>Marketing
                          </div>
                          <div className="flash-role role-care">
                            <span aria-hidden="true">C</span>Customer care
                          </div>
                        </div>
                        <span className="illustration-caption">
                          Example roles · Your company starts empty
                        </span>
                      </div>
                      <div className="welcome-steps">
                        <div>
                          <b>01</b>
                          <strong>Shape your company</strong>
                          <span>Start small or use a ready-made team.</span>
                        </div>
                        <div>
                          <b>02</b>
                          <strong>Make ownership clear</strong>
                          <span>Connect departments, agents, and responsibilities.</span>
                        </div>
                        <div>
                          <b>03</b>
                          <strong>Get useful work done</strong>
                          <span>Connect a runtime and inspect the real result.</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <section className="organization-header">
                        <div>
                          <span className="eyebrow">YOUR COMPANY · YOUR NEXT MOVE</span>
                          <h1>{company?.name ?? 'Your organization'}</h1>
                          <TextDisclosure
                            text={
                              company?.description ||
                              'A clear view of the people, agents, and teams behind your work.'
                            }
                          />
                        </div>
                        <div className="company-control-actions">
                          <img
                            className="company-flash"
                            src="/flash-character.svg"
                            width={84}
                            height={98}
                            alt=""
                          />
                          <div className="organization-actions">
                            <button
                              className="button"
                              onClick={() =>
                                openEditor({
                                  kind: 'department',
                                  companyId: companyId ?? undefined,
                                })
                              }
                              disabled={!companyId}
                            >
                              <Plus size={15} />
                              Department
                            </button>
                            <button
                              className="button primary"
                              onClick={() =>
                                openEditor({
                                  kind: 'agent',
                                  companyId: companyId ?? undefined,
                                  departmentId: selectedDepartment?.id,
                                })
                              }
                              disabled={!companyId}
                            >
                              <Plus size={15} />
                              Agent
                            </button>
                          </div>
                        </div>
                      </section>
                      <div
                        className="company-instruments"
                        aria-label={`Activity for ${company?.name ?? 'this company'}`}
                      >
                        <div className="company-instrument">
                          <span>
                            <Bot size={16} />
                            Configured roles
                          </span>
                          <strong>{agents.filter((row) => row.kind === 'agent').length}</strong>
                          <small>
                            {state.departments.filter((row) => row.companyId === companyId).length}{' '}
                            departments
                          </small>
                        </div>
                        <div className="company-instrument">
                          <span>
                            <Activity size={16} />
                            Running
                          </span>
                          <strong>{companyWork?.stats.running ?? 0}</strong>
                          <small>{companyWork?.stats.queued ?? 0} queued</small>
                        </div>
                        <button
                          className="company-instrument instrument-review"
                          onClick={() => navigate('work')}
                        >
                          <span>
                            <ArrowUpRight size={16} />
                            Needs your review
                          </span>
                          <strong>{companyWork?.stats.reviewable ?? 0}</strong>
                          <small>
                            {companyWork?.stats.reviewable ? 'Review work' : 'View company work'}{' '}
                            <ArrowRight size={13} />
                          </small>
                        </button>
                        <div className="company-instrument">
                          <span>
                            <CheckCircle2 size={16} />
                            Accepted
                          </span>
                          <strong>{companyWork?.stats.accepted ?? 0}</strong>
                          <small>Results you approved</small>
                        </div>
                      </div>
                      <div className="company-scope-note">
                        <ShieldCheck size={13} />
                        Saved configuration stays idle until you run a task.
                      </div>
                      <div className="view-toolbar">
                        <div className="view-tabs" role="tablist" aria-label="Organization view">
                          {(
                            [
                              {
                                id: 'map',
                                icon: LayoutGrid,
                                label: 'Company map',
                              },
                              {
                                id: 'reporting',
                                icon: GitBranch,
                                label: 'Reporting lines',
                              },
                              { id: 'list', icon: List, label: 'Agent list' },
                            ] as const
                          ).map(({ id, icon: Icon, label }) => (
                            <button
                              key={id}
                              role="tab"
                              aria-selected={view === id}
                              className={view === id ? 'active' : ''}
                              onClick={() => setView(id)}
                            >
                              <Icon size={14} />
                              {label}
                            </button>
                          ))}
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setShowInspector((value) => !value)}
                        >
                          {showInspector ? 'Hide details' : 'Show details'}
                        </button>
                      </div>
                      <div className="organization-body">
                        <div className="organization-canvas">
                          {companyId && view === 'map' && (
                            <CompanyMap
                              state={state}
                              companyId={companyId}
                              selection={selection}
                              onSelect={select}
                              onCreateDepartment={() =>
                                openEditor({ kind: 'department', companyId })
                              }
                            />
                          )}
                          {companyId && snapshot && view === 'reporting' && (
                            <div className="reporting-view">
                              <CorporationOrgChart
                                snapshot={snapshot}
                                corporationId={companyId}
                                corporationName={company?.name ?? ''}
                                selection={selection?.kind === 'agent' ? selection.id : null}
                                onSelectAgent={(id) =>
                                  id
                                    ? select({ kind: 'agent', id })
                                    : select({ kind: 'company', id: companyId })
                                }
                              />
                            </div>
                          )}
                          {view === 'list' && (
                            <div className="agent-list-view">
                              <div className="list-heading">
                                <h2>{selectedDepartment?.name ?? 'All company agents'}</h2>
                                <span className="muted small">{filteredAgents.length} members</span>
                              </div>
                              <AgentList
                                agents={filteredAgents}
                                state={state}
                                selection={selection}
                                onSelect={(id) => select({ kind: 'agent', id })}
                              />
                              {!filteredAgents.length && (
                                <p className="list-empty">
                                  {query
                                    ? 'No agents match your search.'
                                    : 'Add your first agent to start defining responsibilities.'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        {showInspector && company && selection && (
                          <aside className="inspector" aria-label="Inspector">
                            <div className="inspector-top">
                              <span>{selection.kind} details</span>
                              <button
                                className="icon-button"
                                aria-label="Close details"
                                onClick={() => setShowInspector(false)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className="inspector-identity">
                              <span className="inspector-symbol">
                                {selection.kind === 'agent' ? (
                                  <Bot size={24} />
                                ) : selection.kind === 'department' ? (
                                  <Layers3 size={24} />
                                ) : (
                                  <Building2 size={24} />
                                )}
                              </span>
                              <h2>
                                {selectedAgent?.name ?? selectedDepartment?.name ?? company.name}
                              </h2>
                              <p>
                                {selectedAgent?.role ??
                                  (selectedDepartment ? 'Department' : company.shortCode)}
                              </p>
                              <button
                                className="button small-button"
                                onClick={() =>
                                  openEditor({
                                    kind: selection.kind,
                                    id: selection.id,
                                    companyId: company.id,
                                  })
                                }
                              >
                                <Pencil size={12} />
                                Edit details
                              </button>
                            </div>
                            {selectedAgent ? (
                              <>
                                <section className="inspector-section">
                                  <h3>Responsibilities</h3>
                                  {selectedAgent.responsibilities.length ? (
                                    <ul className="responsibilities">
                                      {selectedAgent.responsibilities.map((item, index) => (
                                        <li key={index}>{item}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p>No responsibilities defined yet.</p>
                                  )}
                                </section>
                                <section className="inspector-section">
                                  <h3>Instructions</h3>
                                  <p className="preserve-lines">
                                    {selectedAgent.instructions ||
                                      'Add working context and constraints to guide this agent.'}
                                  </p>
                                </section>
                                <section className="inspector-section">
                                  <div className="section-title">
                                    <h3>Organization</h3>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        openAdvanced({
                                          kind: 'assignments',
                                          agentId: selectedAgent.id,
                                        })
                                      }
                                    >
                                      Assignments
                                    </button>
                                  </div>
                                  <dl className="details-list">
                                    <dt>Department</dt>
                                    <dd>
                                      {state.departments.find(
                                        (row) => row.id === selectedAgent.departmentId,
                                      )?.name ?? 'Company level'}
                                    </dd>
                                    <dt>Reports to</dt>
                                    <dd>
                                      {state.agents.find(
                                        (row) => row.id === selectedAgent.managerId,
                                      )?.name ?? 'No manager'}
                                    </dd>
                                    <dt>Type</dt>
                                    <dd>{selectedAgent.kind === 'agent' ? 'AI agent' : 'Human'}</dd>
                                  </dl>
                                </section>
                                <section className="inspector-section run-cta">
                                  <h3>Put this agent to work</h3>
                                  <p>Run a specific task and review its result.</p>
                                  <button
                                    className="button primary"
                                    onClick={() => setRunAgent(selectedAgent)}
                                  >
                                    <Play size={14} />
                                    Run a task
                                  </button>
                                  <button
                                    className="text-button"
                                    onClick={() => navigate('integrations')}
                                  >
                                    Runtime connections
                                    <ArrowUpRight size={12} />
                                  </button>
                                </section>
                                <section className="inspector-section">
                                  <button
                                    className="text-button danger"
                                    disabled={busy}
                                    onClick={() =>
                                      void command(
                                        [
                                          {
                                            type: 'agent.archive',
                                            id: selectedAgent.id,
                                          },
                                        ],
                                        `Archive agent: ${selectedAgent.name}`,
                                      )
                                    }
                                  >
                                    <Archive size={13} />
                                    Archive agent
                                  </button>
                                </section>
                              </>
                            ) : (
                              <>
                                <section className="inspector-section">
                                  <h3>Purpose</h3>
                                  <TextDisclosure
                                    text={
                                      (selectedDepartment?.description ?? company.description) ||
                                      'Add a purpose so every agent knows what matters.'
                                    }
                                  />
                                  {selectedDepartment?.managerId && (
                                    <p className="muted small">
                                      Led by{' '}
                                      {
                                        state.agents.find(
                                          (row) => row.id === selectedDepartment.managerId,
                                        )?.name
                                      }
                                    </p>
                                  )}
                                </section>
                                <section className="inspector-section">
                                  <div className="section-title">
                                    <h3>{selectedDepartment ? 'Team members' : 'Departments'}</h3>
                                    <button
                                      className="icon-button"
                                      aria-label={
                                        selectedDepartment
                                          ? 'Add agent to department'
                                          : 'Add department'
                                      }
                                      onClick={() =>
                                        openEditor({
                                          kind: selectedDepartment ? 'agent' : 'department',
                                          companyId: company.id,
                                          departmentId: selectedDepartment?.id,
                                        })
                                      }
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                  {selectedDepartment ? (
                                    <div className="inspector-members">
                                      {agents
                                        .filter((row) => row.departmentId === selectedDepartment.id)
                                        .map((agent) => (
                                          <button
                                            onClick={() =>
                                              select({
                                                kind: 'agent',
                                                id: agent.id,
                                              })
                                            }
                                            key={agent.id}
                                          >
                                            <span className="tiny-avatar">
                                              <Bot size={12} />
                                            </span>
                                            <span>
                                              <strong>{agent.name}</strong>
                                              <small>{agent.role}</small>
                                            </span>
                                            <ChevronRight size={12} />
                                          </button>
                                        ))}
                                    </div>
                                  ) : (
                                    state.departments
                                      .filter((row) => row.companyId === company.id)
                                      .map((department) => (
                                        <button
                                          className="inspector-department"
                                          onClick={() =>
                                            select({
                                              kind: 'department',
                                              id: department.id,
                                            })
                                          }
                                          key={department.id}
                                        >
                                          <Layers3 size={14} />
                                          <span>{department.name}</span>
                                          <b>
                                            {
                                              agents.filter(
                                                (row) => row.departmentId === department.id,
                                              ).length
                                            }
                                          </b>
                                          <ChevronRight size={12} />
                                        </button>
                                      ))
                                  )}
                                </section>
                                {!selectedDepartment && (
                                  <section className="inspector-section">
                                    <button
                                      className="text-button company-links"
                                      onClick={() =>
                                        openAdvanced({
                                          kind: 'relationships',
                                          companyId: company.id,
                                        })
                                      }
                                    >
                                      <GitBranch size={13} />
                                      Company relationships
                                    </button>
                                    <button className="text-button" onClick={() => setView('list')}>
                                      View all {agents.length} members
                                      <ArrowRight size={13} />
                                    </button>
                                    <button
                                      className="text-button danger archive-company"
                                      disabled={busy}
                                      onClick={() =>
                                        void command(
                                          [
                                            {
                                              type: 'company.archive',
                                              id: company.id,
                                            },
                                          ],
                                          `Archive company: ${company.name}`,
                                        )
                                      }
                                    >
                                      <Archive size={13} />
                                      Archive company
                                    </button>
                                  </section>
                                )}
                              </>
                            )}
                          </aside>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              {area === 'work' && (
                <WorkView
                  companyId={workScope === 'all' ? null : companyId}
                  selectedCompanyName={company?.name ?? null}
                  onScopeChange={(scope) => {
                    setInitialRunId(null);
                    setWorkScope(scope);
                  }}
                  initialRunId={initialRunId}
                  state={state}
                  runs={runs}
                  onAccept={(id, title) =>
                    void command([{ type: 'work.accept', id }], `Accept result: ${title}`)
                  }
                  onSelectAgent={(id) => {
                    select({ kind: 'agent', id });
                    setArea('organization');
                  }}
                  onRefresh={() => void refresh()}
                />
              )}
              {area === 'integrations' && (
                <IntegrationsView
                  status={status}
                  companyId={companyId}
                  onRefresh={() => void refresh()}
                />
              )}
              {area === 'activity' && (
                <div className="page-content">
                  <div className="section-intro">
                    <div>
                      <span className="eyebrow">A clear change history</span>
                      <h2>Activity & recovery</h2>
                      <p>
                        Every saved change has a receipt. Undo is available while a configuration
                        change is still safe to reverse.
                      </p>
                    </div>
                    <button className="button" onClick={() => setArchived((value) => !value)}>
                      <Archive size={14} />
                      {archived ? 'Show changes' : 'Archived entities'}
                    </button>
                  </div>
                  {archived ? (
                    <div className="history-list">
                      {state.companies
                        .filter((row) => row.status === 'archived')
                        .map((row) => (
                          <article key={row.id}>
                            <div>
                              <strong>{row.name}</strong>
                              <span>Archived company</span>
                            </div>
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() =>
                                void command(
                                  [{ type: 'company.restore', id: row.id }],
                                  `Restore company: ${row.name}`,
                                )
                              }
                            >
                              Restore
                            </button>
                          </article>
                        ))}
                      {state.agents
                        .filter((row) => row.status === 'archived')
                        .map((row) => (
                          <article key={row.id}>
                            <div>
                              <strong>{row.name}</strong>
                              <span>Archived agent</span>
                            </div>
                            <button
                              className="button"
                              disabled={busy || !companyId}
                              onClick={() =>
                                companyId &&
                                void command(
                                  [
                                    {
                                      type: 'agent.restore',
                                      id: row.id,
                                      companyId,
                                    },
                                  ],
                                  `Restore agent: ${row.name}`,
                                )
                              }
                            >
                              Restore to {company?.name ?? 'a company'}
                            </button>
                          </article>
                        ))}
                    </div>
                  ) : (
                    <div className="history-list">
                      {state.history.length ? (
                        [...state.history]
                          .sort((a, b) => b.revision - a.revision)
                          .map((row) => (
                            <article key={row.id}>
                              <span className="history-dot">
                                <CheckCircle2 size={17} />
                              </span>
                              <div>
                                <strong>{row.summary}</strong>
                                <span>
                                  {new Date(row.createdAt).toLocaleString()} · Revision{' '}
                                  {row.revision}
                                </span>
                              </div>
                              {row.undoable && (
                                <button
                                  className="button"
                                  aria-disabled={busy}
                                  onClick={() => void undo(row.id)}
                                >
                                  <Undo2 size={14} />
                                  Undo
                                </button>
                              )}
                            </article>
                          ))
                      ) : (
                        <div className="empty-state">
                          <Activity size={28} />
                          <h3>Your history starts with the first change</h3>
                          <p>Create a company or review a template to get started.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {area === 'settings' && (
                <div className="page-content">
                  <div className="section-intro">
                    <div>
                      <span className="eyebrow">Local by design</span>
                      <h2>Your workspace</h2>
                      <p>You own your organization and its configuration.</p>
                    </div>
                  </div>
                  <div className="settings-grid">
                    <section className="settings-card">
                      <ShieldCheck size={24} />
                      <h3>Local storage</h3>
                      <p>
                        Your company configuration and work records are saved in SQLite on this
                        computer. No GitFlash account is required.
                      </p>
                      <dl className="details-list">
                        <dt>Companies</dt>
                        <dd>{activeCompanies.length}</dd>
                        <dt>Configured agents</dt>
                        <dd>{activeAgents.length}</dd>
                        <dt>Schema</dt>
                        <dd>{state.schemaVersion}</dd>
                        <dt>Revision</dt>
                        <dd>{state.revision}</dd>
                      </dl>
                    </section>
                    <section className="settings-card">
                      <Download size={24} />
                      <h3>Export & backup</h3>
                      <p>
                        Export a portable company definition. It contains structure and
                        responsibilities. Use the CLI backup command to preserve the complete
                        workspace, including work and history.
                      </p>
                      <a className="button" href="/api/export" download="gitflash-company.json">
                        <Download size={14} />
                        Export company definition
                      </a>
                      <button
                        className="button import-button"
                        onClick={() => openAdvanced({ kind: 'import' })}
                      >
                        Import a company definition
                      </button>
                      <p className="small muted">
                        See the README for backup, restore, and upgrade commands.
                      </p>
                    </section>
                    <section className="settings-card">
                      <BrandMark size={40} decorative />
                      <h3>{brand.name}</h3>
                      <p>{brand.descriptor} Free local core, in your hands.</p>
                      <a
                        className="text-button"
                        href={brand.repository}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source & documentation
                        <ArrowUpRight size={14} />
                      </a>
                    </section>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>{brand.name} · Your AI company, on your computer</span>
          <span>
            {state ? `Revision ${state.revision}` : 'Local workspace'}
            <span className="footer-divider">/</span>Open source
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {advanced && state && (
        <AdvancedDialog
          target={advanced}
          state={state}
          busy={busy}
          error={modalError}
          onClose={() => {
            if (!busy) setAdvanced(null);
          }}
          onSubmit={command}
        />
      )}
      {editor && state && (
        <EntityEditor
          key={`${editor.kind}:${editor.id ?? 'new'}:${editor.departmentId ?? ''}`}
          target={editor}
          state={state}
          busy={busy}
          error={modalError}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
          onSubmit={command}
        />
      )}
      {preview && (
        <PreviewDialog
          preview={preview}
          busy={busy}
          error={modalError}
          onClose={() => {
            if (!busy) {
              setPreview(null);
              setPending(null);
              setModalError(null);
            }
          }}
          onApply={() => void apply()}
          onRefresh={() => void refreshPreview()}
        />
      )}
      {undoPreview && (
        <Dialog
          title="Review undo"
          wide
          onClose={() => {
            if (!busy) {
              setUndoPreview(null);
              setModalError(null);
            }
          }}
        >
          <div className="dialog-body">
            <div className="draft-label">
              <span /> Review · Nothing has been undone
            </div>
            <h3 className="preview-title">{undoPreview.summary}</h3>
            <p className="muted">
              Confirm these exact configuration reversals at revision {undoPreview.baseRevision}. A
              later change will require a new review.
            </p>
            <ol className="preview-list">
              {undoPreview.changes.map((change, index) => (
                <li key={index}>
                  <span className="change-number">{index + 1}</span>
                  {change}
                </li>
              ))}
            </ol>
            <p className="preview-note">
              <ShieldCheck size={16} /> Real work and accepted evidence are retained. Undo does not
              reverse external actions.
            </p>
            {modalError && (
              <div className="error-box" role="alert">
                <p>{modalError}</p>
                <p>Cancel and reopen Undo to review the current workspace.</p>
              </div>
            )}
            <footer className="dialog-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  setUndoPreview(null);
                  setModalError(null);
                }}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || Boolean(modalError)}
                onClick={() => void confirmUndo()}
              >
                <Undo2 size={16} />
                {busy ? 'Undoing…' : 'Confirm undo'}
              </button>
            </footer>
          </div>
        </Dialog>
      )}
      {templatesOpen && (
        <Dialog
          title="Start with a clear structure"
          wide
          onClose={() => {
            if (!busy) setTemplatesOpen(false);
          }}
        >
          <div className="dialog-body">
            <p className="muted">
              A template gives your agents roles and responsibilities. Preview the entire structure
              before adding it. It contains no fabricated work.
            </p>
            <div className="template-grid">
              {templates.map((template) => (
                <button
                  className="template-card"
                  key={template.id}
                  disabled={busy}
                  onClick={() => void prepare({ kind: 'template', id: template.id })}
                >
                  <span className="template-icon">
                    <Layers3 size={22} />
                  </span>
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                  <span className="template-counts">
                    {template.agentCount} agents · {template.departmentCount} departments
                  </span>
                  <span className="text-button">
                    {busy ? 'Preparing…' : 'Preview structure'}
                    <ArrowRight size={14} />
                  </span>
                </button>
              ))}
            </div>
            {!templates.length && (
              <p className="connection-note">
                No templates are available yet. You can create a company and define its structure
                manually.
              </p>
            )}
            {modalError && (
              <p className="error-box" role="alert">
                {modalError}
              </p>
            )}
          </div>
        </Dialog>
      )}
      {runAgent && (
        <RunDialog
          agent={runAgent}
          status={status}
          actualCompanyName={runCompany?.name ?? null}
          selectedCompanyName={company?.name ?? null}
          targetDiffersFromSelection={!!runCompany && !!companyId && runCompany.id !== companyId}
          onClose={() => setRunAgent(null)}
          onStarted={async (startedRun) => {
            await refresh();
            setRuns((current) =>
              current.some((run) => run.id === startedRun.id) ? current : [startedRun, ...current],
            );
            setSelection({ kind: 'company', id: startedRun.companyId });
            setInitialRunId(startedRun.id);
            setWorkScope('company');
            setArea('work');
            announce('Task recorded. Opened its company and run.');
          }}
        />
      )}
    </div>
  );
}

function allTreeIds(nodes: ReturnType<typeof organizationTree>): string[] {
  return nodes.flatMap((node) => [node.id, ...allTreeIds(node.children ?? [])]);
}
function AgentList({
  agents,
  state,
  selection,
  onSelect,
}: {
  agents: Agent[];
  state: WorkspaceState;
  selection: Selection | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="agent-table-wrap">
      <table className="agent-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Role</th>
            <th>Department</th>
            <th>Responsibilities</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr
              key={agent.id}
              className={selection?.kind === 'agent' && selection.id === agent.id ? 'selected' : ''}
            >
              <td>
                <button className="agent-name" onClick={() => onSelect(agent.id)}>
                  <span className="tiny-avatar">
                    <Bot size={13} />
                  </span>
                  {agent.name}
                </button>
              </td>
              <td>{agent.role}</td>
              <td>
                {state.departments.find((row) => row.id === agent.departmentId)?.name ??
                  'Company level'}
              </td>
              <td>{agent.responsibilities.length}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Inspect ${agent.name}`}
                  onClick={() => onSelect(agent.id)}
                >
                  <ChevronRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
