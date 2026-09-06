import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Download,
  Play,
  RefreshCw,
  Terminal,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
} from 'lucide-react';
import type { Agent, WorkspaceState } from '../domain/contracts';
import { Dialog } from './Dialogs';
import { request } from './client';
import { textExcerpt } from './TextDisclosure';
import { createWorkViewModel, initialRunForScope, runDisplayState } from './work-view-model';

export interface IntegrationStatus {
  codex: {
    available: boolean;
    authenticated: boolean;
    state: string;
    message: string;
  };
  buzz: { state: string; available: boolean; message: string };
  slack: { state: string; message: string };
  activeRuns: number;
  queuedRuns: number;
  costNotice: string;
}
export interface RunInfo {
  id: string;
  requestId: string;
  agentId: string;
  agentName: string;
  companyId: string;
  task: string;
  transport: 'codex' | 'buzz';
  status: 'queued' | 'running' | 'completed' | 'failed';
  output: string;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  outputSha256: string | null;
  deliveryStatus: string;
  runtimeVersion: string | null;
  sessionId: string | null;
}
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Forward the authoritative run receipt before navigating away from task submission. */
export async function submitRunTask(
  payload: { agentId: string; task: string; requestId: string; transport: 'codex' | 'buzz' },
  onStarted: (run: RunInfo) => Promise<void>,
): Promise<RunInfo> {
  const run = await request<RunInfo>('/api/runs', payload);
  await onStarted(run);
  return run;
}

export function RunDialog({
  agent,
  status,
  actualCompanyName,
  selectedCompanyName = null,
  targetDiffersFromSelection = false,
  onClose,
  onStarted,
}: {
  agent: Agent;
  status: IntegrationStatus | null;
  actualCompanyName: string | null;
  selectedCompanyName?: string | null;
  targetDiffersFromSelection?: boolean;
  onClose: () => void;
  onStarted: (run: RunInfo) => Promise<void>;
}) {
  const [task, setTask] = useState('');
  const [transport, setTransport] = useState<'codex' | 'buzz'>(() =>
    status?.codex.state === 'ready'
      ? 'codex'
      : status?.buzz.available && status.buzz.state === 'configured'
        ? 'buzz'
        : 'codex',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ task: string; transport: string; requestId: string } | null>(null);
  const ready =
    transport === 'codex'
      ? status?.codex.state === 'ready'
      : status?.buzz.available && status?.buzz.state === 'configured';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !ready || !actualCompanyName || !task.trim()) return;
    setBusy(true);
    setError(null);
    if (
      !attempt.current ||
      attempt.current.task !== task ||
      attempt.current.transport !== transport
    ) {
      attempt.current = { task, transport, requestId: crypto.randomUUID() };
    }
    try {
      await submitRunTask(
        {
          agentId: agent.id,
          task,
          requestId: attempt.current.requestId,
          transport,
        },
        onStarted,
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the task.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={`Give ${agent.name} a task`} onClose={onClose}>
      <form className="dialog-body editor-form" onSubmit={submit}>
        <p className="muted">
          The runtime receives this task together with the agent’s role, instructions, and
          responsibilities.
        </p>
        <div className={`connection-note ${actualCompanyName ? '' : 'warning-note'}`}>
          {actualCompanyName ? (
            <>
              <strong>Task company: {actualCompanyName}</strong>
              <p>
                {targetDiffersFromSelection
                  ? `You are viewing ${selectedCompanyName || 'another company'}. This task belongs to ${actualCompanyName}, where its result will open.`
                  : 'The task and its result will be recorded in this company.'}
              </p>
            </>
          ) : (
            'Assign this agent to an active company before starting a task.'
          )}
        </div>
        <label>
          Task
          <textarea
            autoFocus
            required
            rows={5}
            maxLength={20000}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe the outcome you need, the context, and how you will judge success…"
          />
        </label>
        <label>
          Runtime
          <select
            value={transport}
            onChange={(e) => setTransport(e.target.value as 'codex' | 'buzz')}
          >
            <option value="codex">Codex CLI</option>
            <option value="buzz">Buzz</option>
          </select>
        </label>
        <p className={`connection-note ${ready ? '' : 'warning-note'}`}>
          {transport === 'codex'
            ? (status?.codex.message ?? 'Checking Codex…')
            : (status?.buzz.message ?? 'Checking Buzz…')}
        </p>
        <p className="muted small">
          {status?.costNotice ||
            'VCM is free. External runtimes may require an account and incur provider charges.'}
        </p>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !ready || !actualCompanyName}>
            <Play size={15} />
            {busy ? 'Starting…' : 'Run task'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export function WorkView({
  state,
  runs,
  companyId = null,
  initialRunId = null,
  selectedCompanyName = null,
  onScopeChange,
  onSelectAgent,
  onRefresh,
  onAccept,
}: {
  state: WorkspaceState;
  runs: RunInfo[];
  companyId?: string | null;
  initialRunId?: string | null;
  selectedCompanyName?: string | null;
  onScopeChange?: (scope: 'company' | 'all') => void;
  onSelectAgent: (id: string, companyId: string) => void;
  onRefresh: () => void;
  onAccept: (recordId: string, title: string) => void;
}) {
  const requestedRun = initialRunForScope(runs, companyId, initialRunId);
  const [selectedRun, setSelectedRun] = useState<string | null>(() => requestedRun?.id ?? null);
  const openedRequest = useRef<string | null>(null);
  const firstManualReview = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!initialRunId) {
      openedRequest.current = null;
      return;
    }
    const requestKey = JSON.stringify([companyId, initialRunId]);
    if (requestedRun && openedRequest.current !== requestKey) {
      openedRequest.current = requestKey;
      setSelectedRun(requestedRun.id);
    }
  }, [companyId, initialRunId, requestedRun]);
  const view = createWorkViewModel(state, runs, companyId);
  const run = view.runs.find((item) => item.id === selectedRun);
  const runState = run ? runDisplayState(run, view.work) : null;
  const workRecord = runState?.workRecord;
  const download = (value: RunInfo) => {
    const url = URL.createObjectURL(new Blob([value.output], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vcm-${value.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="page-content work-page">
      <div className="section-intro">
        <div>
          <span className="eyebrow">Work, with evidence</span>
          <h2>{view.scopeName}</h2>
          <p>See what is running, review the output, and decide what to accept.</p>
          {onScopeChange && (
            <label className="work-scope-control">
              Work scope
              <select
                value={companyId === null ? 'all' : 'company'}
                onChange={(event) => onScopeChange(event.target.value as 'company' | 'all')}
              >
                <option value="company" disabled={!selectedCompanyName}>
                  {selectedCompanyName || 'Selected company'}
                </option>
                <option value="all">All companies</option>
              </select>
            </label>
          )}
        </div>
        <button className="button" onClick={onRefresh}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>
      {view.stats.reviewable > 0 && (
        <section className="work-review-banner" aria-label="Work ready for review">
          <span className="work-review-count">{view.stats.reviewable}</span>
          <div className="work-review-copy">
            <h3>Needs your review</h3>
            <p>
              {view.stats.reviewable === 1
                ? 'One result is ready for your decision.'
                : `${view.stats.reviewable} results are ready for your decision.`}{' '}
              Read the output before accepting it.
            </p>
          </div>
          <button
            className="button primary work-review-action"
            onClick={() => {
              const firstRun = view.reviewableRuns[0];
              if (firstRun) setSelectedRun(firstRun.id);
              else if (firstManualReview.current) {
                firstManualReview.current.open = true;
                firstManualReview.current.querySelector('pre')?.focus();
              }
            }}
          >
            Review work <ArrowUpRight size={16} />
          </button>
        </section>
      )}
      <div className="work-metrics">
        <div>
          <strong>{view.stats.running}</strong>
          <span>Running</span>
        </div>
        <div>
          <strong>{view.stats.queued}</strong>
          <span>Queued</span>
        </div>
        <div>
          <strong>{view.stats.reviewable}</strong>
          <span>Needs your review</span>
        </div>
        <div>
          <strong>{view.stats.accepted}</strong>
          <span>Accepted records</span>
        </div>
      </div>
      {!view.runs.length && !view.acceptedRecords.length && !view.manualRecords.length && (
        <div className="empty-state">
          <span className="empty-icon">
            <Terminal size={25} />
          </span>
          <h3>No recorded agent work yet</h3>
          <p>
            Optional agent runs and manually recorded contributions appear here. Open a member in
            your corporation to give an agent a task or record a person’s completed work.
          </p>
          <p className="muted small">Creating agents does not automatically run them.</p>
        </div>
      )}
      {view.runs.length > 0 && (
        <div className="work-list-heading">
          <h3>Tasks & results</h3>
          <p>
            {view.stats.tasks} {view.stats.tasks === 1 ? 'task' : 'tasks'} · {view.stats.completed}{' '}
            {view.stats.completed === 1 ? 'run completed' : 'runs completed'}
          </p>
        </div>
      )}
      <div className="run-list work-results">
        {view.runs.map((item) => {
          const display = runDisplayState(item, view.work);
          return (
            <button
              key={item.id}
              className={`run-row work-result-row work-status-${display.tone}`}
              onClick={() => setSelectedRun(item.id)}
            >
              <span className={`run-icon ${item.status}`}>
                {item.status === 'completed' ? (
                  <CheckCircle2 size={19} />
                ) : item.status === 'failed' ? (
                  <AlertCircle size={19} />
                ) : (
                  <CircleDashed size={19} className={item.status === 'running' ? 'spin' : ''} />
                )}
              </span>
              <span className="run-details work-result-copy">
                <strong>{textExcerpt(item.task)}</strong>
                <span>
                  {item.agentName} · {item.transport} · {date(item.createdAt)}
                </span>
                {item.output.trim() && (
                  <span className="work-result-preview">{textExcerpt(item.output, 140)}</span>
                )}
              </span>
              <span className={`status-pill ${item.status} work-status-${display.tone}`}>
                {display.label}
              </span>
              <ArrowUpRight size={16} />
            </button>
          );
        })}
      </div>
      {view.manualRecords.length > 0 && (
        <section className="record-section" aria-label="Manual work records">
          <h3>Manual work</h3>
          <p className="muted small">
            These records were supplied manually; they are not runtime executions.
          </p>
          {view.manualRecords.map((record) => {
            const reviewable = view.reviewableManualRecords.includes(record);
            return (
              <article className="work-record" key={record.id}>
                <h4>{record.title}</h4>
                <span
                  className={`status-pill ${record.status} work-status-${reviewable ? 'review' : record.status}`}
                >
                  {record.status === 'failed'
                    ? 'Failed'
                    : reviewable
                      ? 'Needs your review'
                      : 'Submitted'}
                </span>
                <p className="muted small">
                  {state.agents.find((agent) => agent.id === record.agentId)?.name ?? 'Agent'} ·{' '}
                  {state.companies.find((company) => company.id === record.companyId)?.name ??
                    'Company'}{' '}
                  · {record.provenance} · {date(record.createdAt)}
                </p>
                <details
                  className="text-disclosure"
                  ref={
                    record.id === view.reviewableManualRecords[0]?.id
                      ? firstManualReview
                      : undefined
                  }
                >
                  <summary>Read manual output</summary>
                  <pre
                    className="full-text work-record-output"
                    tabIndex={0}
                    role="region"
                    aria-label="Manual output"
                  >
                    {record.output}
                  </pre>
                  {reviewable && (
                    <button
                      className="button primary"
                      onClick={() => onAccept(record.id, record.title)}
                    >
                      <CheckCircle2 size={15} />
                      Review acceptance
                    </button>
                  )}
                </details>
              </article>
            );
          })}
        </section>
      )}
      {view.acceptedRecords.length > 0 && (
        <section className="record-section">
          <h3>Accepted work</h3>
          {view.acceptedRecords.map((record) => (
            <article className="work-record" key={record.id}>
              <h4>{record.title}</h4>
              <p className="muted small">
                {state.agents.find((agent) => agent.id === record.agentId)?.name ?? 'Agent'} ·{' '}
                {record.provenance} · {date(record.createdAt)}
              </p>
              <details className="text-disclosure">
                <summary>Read accepted output</summary>
                <pre
                  className="full-text work-record-output"
                  tabIndex={0}
                  role="region"
                  aria-label="Accepted output"
                >
                  {record.output}
                </pre>
              </details>
            </article>
          ))}
        </section>
      )}
      {run && (
        <Dialog title="Task result" wide onClose={() => setSelectedRun(null)}>
          <div className="dialog-body">
            <span className={`status-pill ${run.status} work-status-${runState!.tone}`}>
              {runState!.label}
            </span>
            <h3 className="preview-title task-result-title">{textExcerpt(run.task)}</h3>
            <button
              className="text-button work-result-agent"
              onClick={() => {
                onSelectAgent(run.agentId, run.companyId);
                setSelectedRun(null);
              }}
            >
              <span className="work-result-agent-name">{run.agentName}</span>
              <ArrowUpRight size={13} />
            </button>
            {run.error && (
              <p className="error-box" role="alert">
                {run.error}
              </p>
            )}
            {run.output ? (
              <pre className="result-output" tabIndex={0} role="region" aria-label="Task output">
                {run.output}
              </pre>
            ) : (
              <p className="connection-note">
                {run.status === 'failed' || run.status === 'completed'
                  ? 'No output was returned.'
                  : 'Waiting for the runtime to return its result…'}
              </p>
            )}
            <details className="text-disclosure work-technical-details">
              <summary>Technical details</summary>
              <dl className="result-meta">
                <dt>Runtime</dt>
                <dd>
                  {run.transport} {run.runtimeVersion ?? ''}
                </dd>
                <dt>Started</dt>
                <dd>{run.startedAt ? date(run.startedAt) : 'Queued'}</dd>
                <dt>Duration</dt>
                <dd>
                  {run.durationMs !== null
                    ? `${(run.durationMs / 1000).toFixed(1)} seconds`
                    : 'In progress'}
                </dd>
                <dt>Run ID</dt>
                <dd className="mono">{run.id}</dd>
                {run.outputSha256 && (
                  <>
                    <dt>Output SHA-256</dt>
                    <dd className="mono">{run.outputSha256}</dd>
                  </>
                )}
              </dl>
            </details>
            <details className="text-disclosure">
              <summary>Read original task</summary>
              <pre className="full-text" tabIndex={0} role="region" aria-label="Original task">
                {run.task}
              </pre>
            </details>
            <footer className="dialog-actions">
              <button className="button" onClick={() => setSelectedRun(null)}>
                Close
              </button>
              {runState?.reviewable && workRecord && (
                <button
                  className="button primary"
                  onClick={() => {
                    onAccept(workRecord.id, workRecord.title);
                    setSelectedRun(null);
                  }}
                >
                  <CheckCircle2 size={15} />
                  Accept result
                </button>
              )}
              {workRecord?.status === 'accepted' && (
                <span className="status-pill completed">Accepted</span>
              )}
              {run.output && (
                <button className="button primary" onClick={() => download(run)}>
                  <Download size={15} />
                  Download result
                </button>
              )}
            </footer>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function IntegrationsView({
  status,
  companyId,
  onRefresh,
}: {
  status: IntegrationStatus | null;
  companyId: string | null;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggleSlack = async () => {
    setBusy(true);
    setError(null);
    try {
      await request(
        `/api/slack/${status?.slack.state === 'connected' ? 'disconnect' : 'connect'}`,
        {},
      );
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Slack could not connect.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-content">
      <div className="section-intro">
        <div>
          <span className="eyebrow">Bring your own runtime</span>
          <h2>Connect your company to work</h2>
          <p>Your organization is local. Activate execution when you are ready.</p>
        </div>
        <button className="button" onClick={onRefresh}>
          <RefreshCw size={14} />
          Check connections
        </button>
      </div>
      <div className="integration-grid">
        <article className="integration-card">
          <div className="integration-icon">
            <Terminal size={24} />
          </div>
          <div className="integration-title">
            <h3>Codex CLI</h3>
            <span className={`status-pill ${status?.codex.state === 'ready' ? 'completed' : ''}`}>
              {status?.codex.state === 'ready'
                ? 'Ready'
                : status?.codex.state === 'authentication-required'
                  ? 'Sign-in needed'
                  : 'Not connected'}
            </span>
          </div>
          <p>
            Run a focused task with an agent’s own instructions. Save the result and execution
            receipt locally.
          </p>
          <p className="connection-note">
            {status?.codex.message ?? 'Checking the local runtime…'}
          </p>
          <p className="muted small">
            Install and authenticate Codex CLI in your terminal, then check connections. Your
            existing provider access is separate from VCM.
          </p>
        </article>
        <article className="integration-card">
          <div className="integration-icon buzz-mark">B</div>
          <div className="integration-title">
            <h3>Buzz</h3>
            <span className="status-pill">
              {status?.buzz.state === 'configured' ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <p>
            Export your company as a native team definition or execute a task through a configured
            Buzz runtime.
          </p>
          <p className="connection-note">
            {status?.buzz.message ?? 'Checking Buzz configuration…'}
          </p>
          {companyId && (
            <a
              className="button"
              href={`/api/buzz/team?companyId=${encodeURIComponent(companyId)}`}
              download
            >
              <Download size={15} />
              Export Buzz team
            </a>
          )}
          <p className="muted small">Exporting a team does not activate agents or run work.</p>
        </article>
        <article className="integration-card">
          <div className="integration-icon slack-mark">#</div>
          <div className="integration-title">
            <h3>Slack</h3>
            <span className="status-pill">
              {status?.slack.state === 'connected'
                ? 'Connected'
                : status?.slack.state === 'configured'
                  ? 'Configured'
                  : 'Not configured'}
            </span>
          </div>
          <p>Deliver work to a configured Slack destination through the optional integration.</p>
          <p className="connection-note">
            {status?.slack.message ?? 'Checking Slack configuration…'}
          </p>
          <button className="button" disabled={busy} onClick={() => void toggleSlack()}>
            {busy
              ? 'Connecting…'
              : status?.slack.state === 'connected'
                ? 'Disconnect Slack'
                : 'Connect Slack'}
          </button>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <p className="muted small">
            Slack is an external delivery destination. Local results remain available without it.
          </p>
        </article>
      </div>
      <aside className="local-promise">
        <CheckCircle2 size={20} />
        <div>
          <strong>Your local company is always free.</strong>
          <p>
            {status?.costNotice ||
              'External runtimes and services may require their own accounts, credentials, or paid usage. No connection is required to create and organize your agents.'}
          </p>
        </div>
      </aside>
    </div>
  );
}
