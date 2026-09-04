import { useRef, useState, type FormEvent } from 'react';
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

export function RunDialog({
  agent,
  status,
  onClose,
  onStarted,
}: {
  agent: Agent;
  status: IntegrationStatus | null;
  onClose: () => void;
  onStarted: () => Promise<void>;
}) {
  const [task, setTask] = useState('');
  const [transport, setTransport] = useState<'codex' | 'buzz'>('codex');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ task: string; transport: string; requestId: string } | null>(null);
  const ready =
    transport === 'codex'
      ? status?.codex.state === 'ready'
      : status?.buzz.available && status?.buzz.state === 'configured';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
      await request<RunInfo>('/api/runs', {
        agentId: agent.id,
        task,
        requestId: attempt.current.requestId,
        transport,
      });
      await onStarted();
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
            'GitFlash is free. External runtimes may require an account and incur provider charges.'}
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
          <button className="button primary" disabled={busy || !ready}>
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
  onSelectAgent,
  onRefresh,
  onAccept,
}: {
  state: WorkspaceState;
  runs: RunInfo[];
  onSelectAgent: (id: string) => void;
  onRefresh: () => void;
  onAccept: (recordId: string, title: string) => void;
}) {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const run = runs.find((item) => item.id === selectedRun);
  const workRecord = run ? state.work.find((record) => record.runId === run.id) : null;
  const completed = runs.filter((item) => item.status === 'completed').length;
  const accepted = state.work.filter((item) => item.status === 'accepted');
  const download = (value: RunInfo) => {
    const url = URL.createObjectURL(new Blob([value.output], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gitflash-${value.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="page-content">
      <div className="section-intro">
        <div>
          <span className="eyebrow">Work, with evidence</span>
          <h2>What your company has delivered</h2>
          <p>Every result stays connected to the agent and task that produced it.</p>
        </div>
        <button className="button" onClick={onRefresh}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>
      <div className="work-metrics">
        <div>
          <strong>{runs.length}</strong>
          <span>Tasks started</span>
        </div>
        <div>
          <strong>{completed}</strong>
          <span>Runtime results</span>
        </div>
        <div>
          <strong>{accepted.length}</strong>
          <span>Accepted work records</span>
        </div>
      </div>
      {!runs.length && (
        <div className="empty-state">
          <span className="empty-icon">
            <Terminal size={25} />
          </span>
          <h3>Your first useful result starts here</h3>
          <p>
            Choose an agent in your organization, connect a supported runtime, and give it a
            specific task. Its result and execution evidence will appear here.
          </p>
          <p className="muted small">Creating agents does not automatically run them.</p>
        </div>
      )}
      <div className="run-list">
        {runs.map((item) => (
          <button key={item.id} className="run-row" onClick={() => setSelectedRun(item.id)}>
            <span className={`run-icon ${item.status}`}>
              {item.status === 'completed' ? (
                <CheckCircle2 size={19} />
              ) : item.status === 'failed' ? (
                <AlertCircle size={19} />
              ) : (
                <CircleDashed size={19} className={item.status === 'running' ? 'spin' : ''} />
              )}
            </span>
            <span className="run-details">
              <strong>{textExcerpt(item.task)}</strong>
              <span>
                {item.agentName} · {item.transport} · {date(item.createdAt)}
              </span>
            </span>
            <span className={`status-pill ${item.status}`}>{item.status}</span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      {accepted.length > 0 && (
        <section className="record-section">
          <h3>Accepted work</h3>
          {accepted.map((record) => (
            <article className="work-record" key={record.id}>
              <h4>{record.title}</h4>
              <p className="muted small">
                {state.agents.find((agent) => agent.id === record.agentId)?.name ?? 'Agent'} ·{' '}
                {record.provenance} · {date(record.createdAt)}
              </p>
              <pre>{record.output}</pre>
            </article>
          ))}
        </section>
      )}
      {run && (
        <Dialog title="Task result" wide onClose={() => setSelectedRun(null)}>
          <div className="dialog-body">
            <span className={`status-pill ${run.status}`}>{run.status}</span>
            <h3 className="preview-title task-result-title">{textExcerpt(run.task)}</h3>
            <button
              className="text-button"
              onClick={() => {
                onSelectAgent(run.agentId);
                setSelectedRun(null);
              }}
            >
              {run.agentName}
              <ArrowUpRight size={13} />
            </button>
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
                {run.status === 'failed'
                  ? 'No output was returned.'
                  : 'Waiting for the runtime to return its result…'}
              </p>
            )}
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
              {workRecord?.status === 'submitted' && run.status === 'completed' && (
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
            existing provider access is separate from GitFlash.
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
