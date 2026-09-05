import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  ChevronRight,
  Download,
  GitBranch,
  Layers3,
  LayoutGrid,
  House,
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
import { brand } from './identity';
import type {
  Agent,
  ChangePreview,
  CompanyDefinition,
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
  roleLabel,
  toSnapshot,
  type Selection,
} from './model';
import { Dialog, EntityEditor, PreviewDialog, type EditorTarget } from './Dialogs';
import { CompanyMap } from './CompanyMap';
import { CorporationWorkspace } from './CorporationWorkspace';
import { CorporationSetup } from './CorporationSetup';
import { AgentPlacement } from './AgentPlacement';
import {
  applyRecovery,
  prepareRecoverableChange,
  readPendingApply,
  PENDING_APPLY_KEY,
  type ApplyRecovery,
  type PendingChange,
} from './change-recovery';
import type { TimeSnapshot } from '../time/contracts';
import { TextDisclosure, textExcerpt } from './TextDisclosure';
import { BrandMark } from './BrandMark';
import { createWorkViewModel, getRunTargetCompany, workAgentDestination } from './work-view-model';
import { TimeTracker, TimezoneSettings } from './TimeTracker';
import { timeCompanyContext } from './time-view-model';
import { JobsView } from './Jobs';
import type { JobInfo } from '../jobs/contracts';
import { AdvancedDialog, type AdvancedTarget } from './AdvancedDialogs';
import {
  IntegrationsView,
  RunDialog,
  WorkView,
  type IntegrationStatus,
  type RunInfo,
} from './Work';

type Area =
  | 'home'
  | 'corporation'
  | 'organization'
  | 'work'
  | 'time'
  | 'integrations'
  | 'activity'
  | 'settings';
type View = 'map' | 'reporting' | 'list';
const AREA_NAMES: Record<Area, string> = {
  home: 'Your corporations',
  corporation: 'Company overview',
  organization: 'Organization',
  work: 'Work',
  time: 'Time Tracker',
  integrations: 'Integrations',
  activity: 'Activity',
  settings: 'Settings',
};
const AREAS = [
  { id: 'home', icon: Building2 },
  { id: 'corporation', icon: House },
  { id: 'organization', icon: GitBranch },
  { id: 'time', icon: Clock3 },
  { id: 'work', icon: Activity },
  { id: 'integrations', icon: PlugZap },
] as const;
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function App() {
  const [resumingApply] = useState(() => readPendingApply(sessionStorage));
  const [saveRecovery, setSaveRecovery] = useState<ApplyRecovery | null>(
    resumingApply ? 'retry' : null,
  );
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [area, setArea] = useState<Area>(() => {
    const saved = new URLSearchParams(location.search).get('area');
    return saved && Object.hasOwn(AREA_NAMES, saved) ? (saved as Area) : 'home';
  });
  const [timeSnapshot, setTimeSnapshot] = useState<TimeSnapshot | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [corporationSetupOpen, setCorporationSetupOpen] = useState(false);
  const previewCompanyIds = useRef<Set<string>>(new Set(resumingApply?.companyIds ?? []));
  const [bookingRequest, setBookingRequest] = useState<{
    id: number;
    companyId: string;
    agentId: string | null;
  } | null>(null);
  const bookingSequence = useRef(0);
  useEffect(() => {
    const workspace = document.getElementById('main');
    workspace?.focus({ preventScroll: true });
    workspace?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [area]);
  const [workScope, setWorkScope] = useState<'company' | 'all'>('company');
  const [workMode, setWorkMode] = useState<'jobs' | 'tasks'>('jobs');
  const [startRequested, setStartRequested] = useState(false);
  const [setupAction, setSetupAction] = useState<'task' | 'time' | null>(null);
  const [view, setView] = useState<View>('map');
  const [selection, setSelection] = useState<Selection | null>(() =>
    parseSelection(new URLSearchParams(location.search).get('selected') ?? ''),
  );
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedTarget | null>(null);
  const [preview, setPreview] = useState<ChangePreview | null>(resumingApply?.preview ?? null);
  const [undoPreview, setUndoPreview] = useState<UndoPreview | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(resumingApply?.change ?? null);
  const [runAgent, setRunAgent] = useState<Agent | null>(null);
  const [initialRunId, setInitialRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(
    resumingApply
      ? 'A previous save still needs confirmation. Retry the same save to recover its result.'
      : null,
  );
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
  const [showInspector, setShowInspector] = useState(false);
  const inspector = useRef<HTMLElement>(null);
  useEffect(() => {
    if (
      area !== 'organization' ||
      !showInspector ||
      !window.matchMedia('(max-width: 920px)').matches
    )
      return;
    inspector.current?.focus({ preventScroll: true });
    inspector.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [area, showInspector, selection?.kind, selection?.id]);
  const [historicalIdentity, setHistoricalIdentity] = useState<{
    agentId?: string;
    companyId: string;
  } | null>(null);
  const [archived, setArchived] = useState(false);

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      client.state(),
      client.templates(),
      request<IntegrationStatus>('/api/integrations'),
      request<RunInfo[]>('/api/runs'),
      request<JobInfo[]>('/api/jobs'),
      request<TimeSnapshot>('/api/time'),
    ]);
    if (results[0].status === 'fulfilled') {
      setState(results[0].value);
      setError(null);
    } else setError(message(results[0].reason));
    if (results[1].status === 'fulfilled') setTemplates(results[1].value);
    if (results[2].status === 'fulfilled') setStatus(results[2].value);
    if (results[3].status === 'fulfilled') setRuns(results[3].value);
    if (results[4].status === 'fulfilled') setJobs(results[4].value);
    if (results[5].status === 'fulfilled') {
      setTimeSnapshot(results[5].value);
      setTimeError(null);
    } else {
      setTimeError(message(results[5].reason));
    }
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
    if (area === 'home') url.searchParams.delete('area');
    else url.searchParams.set('area', area);
    if (selection) url.searchParams.set('selected', selectionKey(selection));
    else url.searchParams.delete('selected');
    history.replaceState(null, '', url);
  }, [selection, area]);
  useEffect(() => {
    if (!state) return;
    const valid =
      selection &&
      (selection.kind === 'company'
        ? state.companies.some((row) => row.id === selection.id && row.status === 'active') ||
          (area === 'time' &&
            (timeSnapshot === null ||
              Boolean(timeCompanyContext(state, timeSnapshot, selection.id))))
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
  }, [state, area, timeSnapshot]);
  const companyId = state ? companyForSelection(state, selection) : null;
  const company = state?.companies.find((row) => row.id === companyId);
  const breadcrumbCompany =
    area === 'time' && state && companyId
      ? (timeCompanyContext(state, timeSnapshot, companyId) ?? {
          id: companyId,
          name: 'Historical company',
          historical: true,
        })
      : company;
  const companyWork = state ? createWorkViewModel(state, runs, companyId) : null;
  const companyJobs = jobs.filter((job) => job.companyId === companyId);
  const companyReviewCount =
    (companyWork?.stats.reviewable ?? 0) +
    companyJobs.filter((job) => job.status === 'waiting_owner').length;
  const runCompany = state && runAgent ? getRunTargetCompany(state, runAgent.id) : null;
  const tree = useMemo(() => (state ? organizationTree(state, query) : []), [state, query]);
  const snapshot = useMemo(() => (state ? toSnapshot(state) : null), [state]);
  const select = (value: Selection) => {
    setInitialRunId(null);
    setWorkScope('company');
    setSelection(
      value.kind === 'agent' && !value.companyId && companyId ? { ...value, companyId } : value,
    );
    setShowInspector(value.kind !== 'company');
    setNavOpen(false);
  };
  const openAdvanced = (target: AdvancedTarget) => {
    setModalError(null);
    setAdvanced(target);
  };
  const createCorporation = () => {
    setModalError(null);
    setSetupAction(null);
    setCorporationSetupOpen(true);
    setNavOpen(false);
  };
  const openEditor = (target: EditorTarget) => {
    setModalError(null);
    setEditor(target);
  };
  const announce = (text: string) => setToast(text);
  const clearSaveReceipt = () => {
    try {
      sessionStorage.removeItem(PENDING_APPLY_KEY);
    } catch {
      /* In-memory recovery remains available. */
    }
  };
  const prepare = async (change: PendingChange, baseState = state) => {
    if (!baseState || saveRecovery === 'retry') return;
    setBusy(true);
    setModalError(null);
    setPending(change);
    try {
      const prepared = await prepareRecoverableChange(change, baseState, setState);
      previewCompanyIds.current = new Set(prepared.baseState.companies.map((row) => row.id));
      setPreview(prepared.preview);
      setSaveRecovery(null);
      setEditor(null);
      setTemplatesOpen(false);
      setAdvanced(null);
    } catch (cause) {
      setModalError(message(cause));
      if (!editor && !preview && !templatesOpen && !advanced && !corporationSetupOpen)
        setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const refreshPreview = async () => {
    if (!pending || saveRecovery === 'retry') return;
    setBusy(true);
    try {
      const fresh = await client.state();
      setState(fresh);
      await prepare(pending, fresh);
    } catch (cause) {
      setModalError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!preview || busy || saveRecovery === 'refresh') return;
    setBusy(true);
    setModalError(null);
    // A reload must keep the same idempotent preview receipt after an interrupted response.
    try {
      sessionStorage.setItem(
        PENDING_APPLY_KEY,
        JSON.stringify({
          preview,
          companyIds: [...previewCompanyIds.current],
          change: pending,
          corporationSetup: corporationSetupOpen,
        }),
      );
    } catch {
      /* The mounted dialog still retains the same receipt if storage is unavailable. */
    }
    try {
      const result = await client.apply(preview.id);
      clearSaveReceipt();
      setState(result.state);
      const created = result.state.companies.find(
        (row) => row.status === 'active' && result.createdCompanyIds.includes(row.id),
      );
      if (created) {
        setSelection({ kind: 'company', id: created.id });
        setShowInspector(false);
        setWorkScope('company');
        setArea('corporation');
      }
      setSaveRecovery(null);
      setStartRequested(false);
      setCorporationSetupOpen(false);
      setSetupAction(null);
      setPreview(null);
      setPending(null);
      announce(
        result.replayed
          ? 'Your previous save is confirmed. No duplicate change was created.'
          : 'Changes saved. Your company is up to date.',
      );
    } catch (cause) {
      const recovery = applyRecovery(cause);
      setSaveRecovery(recovery);
      if (recovery === 'refresh') clearSaveReceipt();
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
        [agent.name, agent.role, roleLabel(agent.role), ...agent.responsibilities].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        )),
  );
  const navigate = (value: Area) => {
    setBookingRequest(null);
    setStartRequested(false);
    setSetupAction(null);
    setInitialRunId(null);
    if (value === 'work') {
      setWorkScope('company');
      if (companyJobs.some((job) => job.status === 'waiting_owner')) setWorkMode('jobs');
      else if (companyWork?.stats.reviewable) setWorkMode('tasks');
    }
    setArea(value);
    setNavOpen(false);
  };
  const openCorporation = (id: string) => {
    select({ kind: 'company', id });
    navigate('corporation');
  };
  const logTime = () => {
    if (!companyId) {
      createCorporation();
      return;
    }
    navigate('time');
    setBookingRequest({
      id: ++bookingSequence.current,
      companyId,
      agentId: selectedAgent?.id ?? null,
    });
  };
  const reviewCorporation = (definition: CompanyDefinition) =>
    prepare({
      kind: 'commands',
      commands: [{ type: 'definition.import', definition }],
      summary: `Create corporation: ${definition.name}`,
    });
  const openAgentContext = (id: string, originCompanyId: string) => {
    if (!state) return;
    if (workAgentDestination(state, id, originCompanyId).kind === 'historical') {
      setHistoricalIdentity({ agentId: id, companyId: originCompanyId });
      return;
    }
    select({ kind: 'agent', id, companyId: originCompanyId });
    setArea('organization');
  };
  const openCompanyContext = (id: string) => {
    if (!state?.companies.some((row) => row.id === id && row.status === 'active')) {
      setHistoricalIdentity({ companyId: id });
      return;
    }
    select({ kind: 'company', id });
    setShowInspector(true);
    setArea('organization');
  };

  return (
    <div
      className="gitflash vcm-workspace corporation-app"
      style={{ '--brand-accent': brand.accent } as React.CSSProperties}
    >
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
          <span className="brand-copy">
            <img className="brand-lockup" src="/vcm-lockup.svg" width={123} height={34} alt="" />
            <small>{brand.descriptor}</small>
          </span>
          <span className="local-badge">local</span>
        </a>
        <nav className="primary-nav" aria-label="Primary">
          {AREAS.filter(({ id }) => companyId || !['corporation', 'organization'].includes(id)).map(
            ({ id, icon: Icon }) => (
              <button
                className={`${area === id ? 'active' : ''}${id === 'work' ? ' secondary-nav-start' : ''}`}
                aria-current={area === id ? 'page' : undefined}
                onClick={() => navigate(id)}
                key={id}
              >
                <Icon size={17} />
                {AREA_NAMES[id]}
                {id === 'work' && companyReviewCount > 0 && (
                  <span
                    className="activity-count"
                    aria-label={`${companyReviewCount} results need your review in ${company?.name ?? 'this company'}`}
                  >
                    {companyReviewCount}
                  </span>
                )}
              </button>
            ),
          )}
        </nav>
        <div className="sidebar-label">
          <span>YOUR COMPANIES</span>
          <button
            className="icon-button"
            aria-label="Set up a corporation"
            onClick={createCorporation}
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
                  navigate(next.kind === 'company' ? 'corporation' : 'organization');
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
          <span className="mobile-brand">
            <BrandMark size={22} decorative />
            {brand.name}
          </span>
          <div className="breadcrumb">
            <span>{AREA_NAMES[area]}</span>
            {breadcrumbCompany &&
              ['corporation', 'organization', 'time', 'work'].includes(area) && (
                <>
                  <ChevronRight size={14} />
                  <button onClick={() => select({ kind: 'company', id: breadcrumbCompany.id })}>
                    {breadcrumbCompany.name}
                  </button>
                  {area === 'organization' && selectedDepartment && (
                    <>
                      <ChevronRight size={14} />
                      <span>{selectedDepartment.name}</span>
                    </>
                  )}
                  {area === 'organization' && selectedAgent && (
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
              <h2>Opening your workspace…</h2>
              <p>Connecting to the local server.</p>
            </div>
          ) : !state ? (
            <div className="empty-state">
              <h2>The local server is unavailable</h2>
              <p>
                Run <code>gitflash start</code> in your terminal, then retry.
              </p>
              <button className="button primary" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {(area === 'home' || area === 'corporation') && (
                <CorporationWorkspace
                  mode={area === 'home' ? 'index' : 'company'}
                  state={state}
                  companyId={companyId}
                  time={timeSnapshot}
                  timeError={timeError}
                  onRefresh={() => void refresh()}
                  onCreate={createCorporation}
                  onBrowseTemplates={() => {
                    setModalError(null);
                    setSetupAction(null);
                    setTemplatesOpen(true);
                  }}
                  onImport={() => openAdvanced({ kind: 'import' })}
                  onOpenCompany={openCorporation}
                  onEditCompany={() => companyId && openEditor({ kind: 'company', id: companyId })}
                  onAddAgent={() => companyId && openEditor({ kind: 'agent', companyId })}
                  onAddDepartment={() => companyId && openEditor({ kind: 'department', companyId })}
                  onManageOrganization={() => {
                    setView('reporting');
                    navigate('organization');
                  }}
                  onOpenAgent={(id) => {
                    if (companyId) {
                      select({ kind: 'agent', id, companyId });
                      setView('reporting');
                      navigate('organization');
                      setShowInspector(true);
                    }
                  }}
                  onLogTime={logTime}
                  onViewTime={() => navigate('time')}
                />
              )}
              {area === 'organization' && (
                <>
                  {!activeCompanies.length ? (
                    <div className="empty-state company-setup-empty">
                      <Building2 size={30} />
                      <h1>Set up your company</h1>
                      <p>Create a company, then add its team or start from a template.</p>
                      <div className="welcome-actions">
                        <button className="button primary" onClick={createCorporation}>
                          Set up a company <ArrowRight size={16} />
                        </button>
                        <button className="button" onClick={() => setTemplatesOpen(true)}>
                          Browse templates
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <section className="organization-header compact-company-header">
                        <div
                          className="compact-company-context"
                          style={{ borderLeftColor: company?.color || brand.accent }}
                        >
                          <BrandMark size={32} decorative />
                          <div>
                            <span className="eyebrow">Your corporation</span>
                            <h1>{company?.name ?? 'Your organization'}</h1>
                            <p>
                              {textExcerpt(company?.description ?? '', 140) ||
                                'Define the team, reporting lines and responsibilities behind your corporation.'}
                            </p>
                          </div>
                        </div>
                        <div className="organization-actions">
                          <button
                            className="button"
                            onClick={() =>
                              openEditor({ kind: 'department', companyId: companyId ?? undefined })
                            }
                            disabled={!companyId}
                          >
                            <Plus size={14} /> Department
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
                            <Plus size={14} /> Agent
                          </button>
                        </div>
                      </section>
                      <div
                        className="company-summary-strip"
                        aria-label={`Activity for ${company?.name ?? 'this company'}`}
                      >
                        <span>
                          {agents.filter((row) => row.kind === 'agent').length} configured roles ·{' '}
                          {state.departments.filter((row) => row.companyId === companyId).length}{' '}
                          departments
                        </span>
                        <span>
                          {(companyWork?.stats.running ?? 0) +
                            companyJobs.filter((job) => job.status === 'running').length}{' '}
                          running ·{' '}
                          {(companyWork?.stats.queued ?? 0) +
                            companyJobs.filter((job) => job.status === 'queued').length}{' '}
                          queued
                        </span>
                        <button
                          className={`company-instrument instrument-review${companyReviewCount ? ' instrument-review-active' : ''}`}
                          onClick={() => navigate('work')}
                        >
                          <span>Review work</span>
                          <strong>{companyReviewCount}</strong>
                        </button>
                        <button className="button" onClick={() => navigate('time')}>
                          <Clock3 size={14} /> Time Tracker
                        </button>
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
                              onSelect={(value) => {
                                select(value);
                                setShowInspector(true);
                              }}
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
                          <aside
                            className="inspector"
                            aria-label="Inspector"
                            ref={inspector}
                            tabIndex={-1}
                          >
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
                                {(selectedAgent ? roleLabel(selectedAgent.role) : null) ??
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
                              <button className="button small-button" onClick={logTime}>
                                <Plus size={13} /> Log time
                              </button>
                              <button
                                className="button small-button"
                                onClick={() => navigate('time')}
                              >
                                <Clock3 size={13} /> View delivery hours
                              </button>
                            </div>
                            {selectedAgent ? (
                              <>
                                <AgentPlacement
                                  state={state}
                                  agent={selectedAgent}
                                  companyId={companyId}
                                  onAssignments={() =>
                                    openAdvanced({ kind: 'assignments', agentId: selectedAgent.id })
                                  }
                                />
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
                                              <small>{roleLabel(agent.role)}</small>
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
                <>
                  <nav className="work-mode-nav" aria-label="Work views">
                    <button aria-pressed={workMode === 'jobs'} onClick={() => setWorkMode('jobs')}>
                      Company jobs
                    </button>
                    <button
                      aria-pressed={workMode === 'tasks'}
                      onClick={() => setWorkMode('tasks')}
                    >
                      Individual tasks
                    </button>
                  </nav>
                  {workMode === 'jobs' ? (
                    <JobsView
                      state={state}
                      companyId={workScope === 'all' ? null : companyId}
                      selectedCompanyId={companyId}
                      selectedCompanyName={company?.name ?? null}
                      status={status}
                      onScopeChange={setWorkScope}
                      onTemplate={(id) => {
                        setSetupAction('task');
                        void prepare({ kind: 'template', id });
                      }}
                      onIntegrations={() => navigate('integrations')}
                      onTime={() => navigate('time')}
                      onRefresh={() => void refresh()}
                      onJobsChanged={setJobs}
                      startRequested={startRequested}
                      onStartRequestHandled={() => setStartRequested(false)}
                    />
                  ) : (
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
                      onSelectAgent={openAgentContext}
                      onRefresh={() => void refresh()}
                    />
                  )}
                </>
              )}
              {area === 'time' && (
                <>
                  {!activeCompanies.length && (
                    <div className="page-content">
                      <div className="connection-note">
                        <p>
                          Set up a company and its team before booking delivery hours. The reference
                          catalog is already available.
                        </p>
                        <button
                          className="button"
                          onClick={() => {
                            createCorporation();
                          }}
                        >
                          Set up a company
                        </button>
                      </div>
                    </div>
                  )}
                  <TimeTracker
                    state={state}
                    selectedCompanyId={companyId}
                    selectedAgentId={selectedAgent?.id ?? null}
                    onChanged={refresh}
                    onOpenAgent={openAgentContext}
                    onOpenCompany={openCompanyContext}
                    onSelectCompany={(id) => select({ kind: 'company', id })}
                    bookingRequest={bookingRequest}
                    onBookingRequestConsumed={() => setBookingRequest(null)}
                    onAddAgent={(id) => {
                      select({ kind: 'company', id });
                      openEditor({ kind: 'agent', companyId: id });
                    }}
                  />
                </>
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
                    <TimezoneSettings revision={state.revision} onChanged={refresh} />
                    <section className="settings-card">
                      <ShieldCheck size={24} />
                      <h3>Local storage</h3>
                      <p>
                        Your company configuration and work records are saved in SQLite on this
                        computer. No account is required.
                      </p>
                      <dl className="details-list">
                        <dt>Companies</dt>
                        <dd>{activeCompanies.length}</dd>
                        <dt>Configured agents</dt>
                        <dd>{activeAgents.filter((row) => row.kind === 'agent').length}</dd>
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
          <span>
            {brand.name} · {brand.descriptor}
          </span>
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
      {corporationSetupOpen && (
        <CorporationSetup
          busy={busy}
          error={modalError}
          reviewing={Boolean(preview)}
          onReview={reviewCorporation}
          onClose={() => {
            if (!busy) {
              setCorporationSetupOpen(false);
              setModalError(null);
              setPending(null);
            }
          }}
        />
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
            if (!busy) {
              setEditor(null);
              setSetupAction(null);
            }
          }}
          onSubmit={command}
        />
      )}
      {preview && (
        <PreviewDialog
          preview={preview}
          busy={busy}
          error={modalError}
          recovery={saveRecovery}
          onClose={() => {
            if (!busy && saveRecovery !== 'retry') {
              setPreview(null);
              setSaveRecovery(null);
              clearSaveReceipt();
              setCorporationSetupOpen(false);
              setPending(null);
              setModalError(null);
              setSetupAction(null);
            }
          }}
          onApply={() => void apply()}
          onRefresh={() => void refreshPreview()}
        />
      )}
      {historicalIdentity && state && (
        <Dialog title="Historical company context" onClose={() => setHistoricalIdentity(null)}>
          <div className="dialog-body">
            <p>
              This record belongs to its original company. An archived, removed, or ended assignment
              is not redirected to another company.
            </p>
            <dl className="time-facts">
              <dt>Company</dt>
              <dd>
                {state.companies.find((row) => row.id === historicalIdentity.companyId)?.name ??
                  'Historical company'}{' '}
                · {historicalIdentity.companyId}
              </dd>
              {historicalIdentity.agentId && (
                <>
                  <dt>Member</dt>
                  <dd>
                    {state.agents.find((row) => row.id === historicalIdentity.agentId)?.name ??
                      runs.find(
                        (row) =>
                          row.agentId === historicalIdentity.agentId &&
                          row.companyId === historicalIdentity.companyId,
                      )?.agentName ??
                      'Historical member'}{' '}
                    · {historicalIdentity.agentId}
                  </dd>
                </>
              )}
            </dl>
            <p>
              The recorded output, delivery hours, and history remain attached to these identities.
            </p>
            <div className="dialog-actions">
              <button className="button" onClick={() => setHistoricalIdentity(null)}>
                Close
              </button>
            </div>
          </div>
        </Dialog>
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
          title={
            setupAction === 'task'
              ? 'Set up a company for your task'
              : setupAction === 'time'
                ? 'Set up a company to track hours'
                : 'Choose a company template'
          }
          wide
          onClose={() => {
            if (!busy) {
              setTemplatesOpen(false);
              setSetupAction(null);
            }
          }}
        >
          <div className="dialog-body">
            <p className="muted">
              {setupAction === 'task'
                ? 'Your first task needs a company with the right roles. Choose a team, review its setup, then continue to the task brief. No agents run during setup.'
                : setupAction === 'time'
                  ? 'Choose a company and assigned team to book delivery hours. Review the structure before saving, then continue to Time Tracker.'
                  : 'A template gives your agents roles and responsibilities. Review the structure before adding it. No agents run during setup.'}
            </p>
            <div className="template-grid">
              {templates
                .filter(
                  (template) =>
                    setupAction !== 'task' ||
                    ['product-studio', 'studio-100'].includes(template.id),
                )
                .map((template) => (
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
            setWorkMode('tasks');
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
              <td>{roleLabel(agent.role)}</td>
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
