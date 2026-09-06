import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Download,
  FileText,
  Layers3,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
} from 'lucide-react';
import type { WorkspaceState } from '../domain/contracts';
import type { JobInfo, JobStage, JobStatus, StageId, WorkflowInfo } from '../jobs/contracts';
import { request } from './client';
import { Dialog } from './Dialogs';
import { companyAgents } from './model';
import type { IntegrationStatus } from './Work';
import './jobs.css';

const labels: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Working',
  waiting_owner: 'Needs your review',
  accepted: 'Accepted by owner',
  rejected: 'Rejected by owner',
  blocked: 'Stopped for a decision',
  failed: 'Execution failed',
  cancelled: 'Cancelled',
};
const stageNames: Record<StageId, string> = {
  intake: 'Set the brief',
  requirements: 'Define the finish line',
  build: 'Build the result',
  qa: 'Check the evidence',
  handoff: 'Prepare your handoff',
};
const active = (job: JobInfo) => job.status === 'queued' || job.status === 'running';
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'The request could not be completed.';
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const jobPath = (id: string) => `/api/jobs/${encodeURIComponent(id)}`;
const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

function JobBadge({ job }: { job: JobInfo }) {
  return (
    <span className={`job-badge job-status-${job.status}`}>
      {job.status === 'accepted' ? (
        <CheckCircle2 size={14} />
      ) : active(job) ? (
        <CircleDashed size={14} />
      ) : job.status === 'waiting_owner' ? (
        <ShieldCheck size={14} />
      ) : (
        <Square size={12} />
      )}
      {labels[job.status]}
    </span>
  );
}

export function JobsView({
  state,
  companyId,
  selectedCompanyId,
  selectedCompanyName,
  status,
  onScopeChange,
  onTemplate,
  onIntegrations,
  onTime,
  onRefresh,
  onJobsChanged,
  startRequested = false,
  onStartRequestHandled,
}: {
  state: WorkspaceState;
  companyId: string | null;
  selectedCompanyId: string | null;
  selectedCompanyName: string | null;
  status: IntegrationStatus | null;
  onScopeChange: (scope: 'company' | 'all') => void;
  onTemplate: (id: string) => void;
  onIntegrations: () => void;
  onTime: () => void;
  onRefresh: () => void;
  onJobsChanged: (jobs: JobInfo[]) => void;
  startRequested?: boolean;
  onStartRequestHandled?: () => void;
}) {
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const results = await Promise.allSettled([
      request<WorkflowInfo[]>('/api/workflows'),
      request<JobInfo[]>('/api/jobs'),
    ]);
    if (!mounted.current || version !== requestVersion.current) return;
    if (results[0].status === 'fulfilled') setWorkflows(results[0].value);
    if (results[1].status === 'fulfilled') {
      setJobs(results[1].value);
      onJobsChanged(results[1].value);
    }
    const failure = results.find((result) => result.status === 'rejected');
    setLoadError(failure?.status === 'rejected' ? message(failure.reason) : null);
    setLoading(false);
  }, [onJobsChanged]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
  }, [refresh]);
  useEffect(() => {
    setSelectedId(null);
    setStartOpen(false);
  }, [companyId, selectedCompanyId]);
  const scoped = jobs
    .filter((job) => companyId === null || job.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const running = scoped.some(active);
  useEffect(() => {
    if (!running) return;
    let disposed = false;
    let timer: number;
    const poll = async () => {
      await refresh();
      if (!disposed) timer = window.setTimeout(() => void poll(), 2000);
    };
    timer = window.setTimeout(() => void poll(), 2000);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [running, companyId, refresh]);
  const workflow = workflows[0];
  useEffect(() => {
    if (!startRequested || !workflow) return;
    setSelectedId(null);
    setStartOpen(true);
    onStartRequestHandled?.();
  }, [startRequested, workflow, onStartRequestHandled]);
  const selected = scoped.find((job) => job.id === selectedId) ?? null;
  const target = state.companies.find(
    (company) => company.id === selectedCompanyId && company.status === 'active',
  );
  const assigned = target
    ? companyAgents(state, target.id).filter((agent) => agent.kind === 'agent')
    : [];
  const roles =
    workflow?.stages.map((stage) => ({
      ...stage,
      agents: assigned.filter((agent) => agent.role === stage.role),
    })) ?? [];
  const readyRoles =
    roles.length === 5 &&
    roles.every((role) => role.agents.length === 1) &&
    new Set(roles.map((role) => role.agents[0]?.id)).size === 5;
  const updateJob = (job: JobInfo) => {
    requestVersion.current += 1;
    const next = [job, ...jobs.filter((item) => item.id !== job.id)];
    setJobs(next);
    onJobsChanged(next);
    setSelectedId(job.id);
  };
  return (
    <div className="page-content jobs-page">
      <div className="section-intro">
        <div>
          <span className="eyebrow">Company tasks</span>
          <h2>Tasks & results</h2>
          <p>
            Review the brief, open the delivered files, and decide whether to accept the result.
          </p>
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
        </div>
        <div className="jobs-actions">
          <button
            className="button"
            onClick={() => {
              void refresh();
              onRefresh();
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {!!scoped.length && workflow && (
            <button className="button primary" onClick={() => setStartOpen(true)}>
              <Play size={14} />
              New job
            </button>
          )}
        </div>
      </div>
      {loadError && (
        <div className="error-box" role="alert">
          {loadError}{' '}
          <button className="text-button" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}
      {loading && (
        <p className="connection-note" role="status">
          Loading your company’s jobs…
        </p>
      )}
      {!loading && !loadError && !workflow && (
        <p className="connection-note">
          No installed workflows are available. Check that your VCM installation includes its
          workflow files.
        </p>
      )}
      {!loading && workflow && !scoped.length && (
        <section className="studio-intro" aria-label="Product Studio first job">
          <div className="studio-intro-copy">
            <span className="studio-kicker">
              <Layers3 size={16} />
              Product Studio · {workflow.id}
            </span>
            <h3>Start your first company task</h3>
            <p>{workflow.description}</p>
            <span className="studio-sample-label">
              Synthetic stock-alert exercise · Python standard library
            </span>
            <div className="jobs-actions">
              {readyRoles ? (
                <button className="button primary" onClick={() => setStartOpen(true)}>
                  <Play size={15} />
                  Set up first job
                </button>
              ) : (
                <button className="button primary" onClick={() => onTemplate(workflow.templateId)}>
                  <Layers3 size={15} />
                  Preview Product Studio
                </button>
              )}
            </div>
            <p className="small muted">
              {readyRoles
                ? `${target?.name} has all five roles ready.`
                : 'Create a company with five defined roles. You can inspect the structure before saving it.'}
            </p>
          </div>
          <div className="studio-deliverables">
            <span className="eyebrow">What you will inspect</span>
            <ul>
              {workflow.deliverables.map((file) => (
                <li key={file}>
                  <FileText size={16} />
                  <span>{file}</span>
                </li>
              ))}
            </ul>
            <div className="studio-owner">
              <ShieldCheck size={19} />
              <span>
                Files and execution evidence arrive for your review. You decide whether to accept
                them.
              </span>
            </div>
          </div>
        </section>
      )}
      {selected ? (
        <JobDetail
          key={selected.id}
          job={selected}
          workflow={workflows.find((item) => item.id === selected.workflowId)}
          onBack={() => setSelectedId(null)}
          onUpdated={updateJob}
          onTime={onTime}
        />
      ) : (
        !!scoped.length && (
          <section className="jobs-list" aria-label="Company jobs">
            <div className="jobs-list-heading">
              <h3>{companyId ? selectedCompanyName : 'All companies'}</h3>
              <span>
                {scoped.filter((job) => job.status === 'waiting_owner').length} awaiting review
              </span>
            </div>
            {scoped.map((job) => (
              <button key={job.id} className="job-row" onClick={() => setSelectedId(job.id)}>
                <span className="job-row-symbol">
                  <Layers3 size={20} />
                </span>
                <span className="job-row-copy">
                  <strong>{job.title}</strong>
                  <span>
                    {job.companyName} · {date(job.createdAt)}
                  </span>
                  <span>
                    {job.stages.filter((stage) => stage.status === 'completed').length} completed
                    stage runs · Candidate {job.candidate + 1}
                  </span>
                </span>
                <JobBadge job={job} />
                <ArrowRight size={16} />
              </button>
            ))}
          </section>
        )
      )}
      {workflow && !selected && (
        <details className="text-disclosure studio-help">
          <summary>How this company job works</summary>
          <ol>
            {workflow.stages.map((stage) => (
              <li key={stage.id}>
                <strong>{stage.title}</strong>
                <span>{stageNames[stage.id]}</span>
              </li>
            ))}
          </ol>
          <p>{workflow.help}</p>
          <p className="muted small">
            Workflow content {workflow.contentVersion}. Creating a company does not run agents.
            Delivery hours are booked separately in Time Tracker.
          </p>
        </details>
      )}
      {startOpen && workflow && (
        <StartJobDialog
          key={target?.id ?? 'no-company'}
          workflow={workflow}
          target={target ? { id: target.id, name: target.name } : null}
          roles={roles}
          readyRoles={readyRoles}
          status={status}
          onClose={() => setStartOpen(false)}
          onTemplate={() => {
            setStartOpen(false);
            onTemplate(workflow.templateId);
          }}
          onIntegrations={onIntegrations}
          onStarted={(job) => {
            updateJob(job);
            setStartOpen(false);
          }}
        />
      )}
    </div>
  );
}

function StartJobDialog({
  workflow,
  target,
  roles,
  readyRoles,
  status,
  onClose,
  onTemplate,
  onIntegrations,
  onStarted,
}: {
  workflow: WorkflowInfo;
  target: { id: string; name: string } | null;
  roles: (WorkflowInfo['stages'][number] & { agents: { id: string; name: string }[] })[];
  readyRoles: boolean;
  status: IntegrationStatus | null;
  onClose: () => void;
  onTemplate: () => void;
  onIntegrations: () => void;
  onStarted: (job: JobInfo) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptanceOwner, setAcceptanceOwner] = useState('');
  const attempt = useRef<{ acceptanceOwner: string; requestId: string } | null>(null);
  const readyRuntime = status?.codex.state === 'ready';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target || busy || !readyRoles || !readyRuntime) return;
    const owner = acceptanceOwner.trim();
    if (owner.length < 2 || owner.length > 120) {
      setError('Enter an acceptance owner of 2–120 characters.');
      return;
    }
    if (attempt.current?.acceptanceOwner !== owner) {
      attempt.current = { acceptanceOwner: owner, requestId: crypto.randomUUID() };
    }
    setBusy(true);
    setError(null);
    try {
      onStarted(
        await request<JobInfo>('/api/jobs', {
          companyId: target.id,
          workflowId: workflow.id,
          requestId: attempt.current.requestId,
          acceptanceOwner: owner,
        }),
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Start a Product Studio job"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="dialog-body editor-form studio-start" onSubmit={submit}>
        <div>
          <span className="eyebrow">{workflow.id} · Synthetic exercise</span>
          <h3>{workflow.title}</h3>
          <p>{workflow.description}</p>
        </div>
        <div className="connection-note">
          <strong>Job company: {target?.name ?? 'No active company selected'}</strong>
          <p>This company’s roles and instructions will be captured with the job.</p>
        </div>
        <label>
          Acceptance owner
          <input
            required
            minLength={2}
            maxLength={120}
            value={acceptanceOwner}
            onChange={(event) => setAcceptanceOwner(event.target.value)}
            disabled={busy}
            aria-describedby="acceptance-owner-help"
            placeholder="A human name or responsible role"
          />
          <span id="acceptance-owner-help" className="muted small">
            The final review will be addressed to this person or role. No account is needed.
          </span>
        </label>
        <ol className="studio-role-list">
          {roles.map((role) => (
            <li key={role.id}>
              <span className={`studio-role-dot ${role.agents.length === 1 ? 'ready' : ''}`}>
                {role.agents.length === 1 ? <Check size={13} /> : <CircleDashed size={13} />}
              </span>
              <span>
                <strong>{role.title}</strong>
                <small>
                  {role.agents.length === 1
                    ? role.agents[0]!.name
                    : role.agents.length
                      ? 'More than one matching role. Assign one agent for this stage.'
                      : 'Required role is missing.'}
                </small>
              </span>
            </li>
          ))}
        </ol>
        {!readyRoles && (
          <div className="connection-note warning-note">
            <p>
              This job needs five distinct active AI roles in one company. The Product Studio
              template includes them.
            </p>
            <button type="button" className="button" onClick={onTemplate}>
              <Layers3 size={14} />
              Preview Product Studio
            </button>
          </div>
        )}
        <div className={`connection-note ${readyRuntime ? '' : 'warning-note'}`}>
          <strong>Runtime: Codex CLI</strong>
          <p>{status?.codex.message ?? 'Check the runtime connection before starting.'}</p>
          {!readyRuntime && (
            <button type="button" className="text-button" onClick={onIntegrations}>
              Open Integrations <ArrowRight size={14} />
            </button>
          )}
        </div>
        <details className="text-disclosure">
          <summary>Prerequisites and included files</summary>
          <ul>
            {workflow.prerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>Deliverables: {workflow.deliverables.join(', ')}.</p>
        </details>
        <details className="text-disclosure studio-brief-review">
          <summary>Review the brief, criteria and sample data</summary>
          <p>These are the installed source materials this job will use.</p>
          {[
            ['Brief', workflow.brief],
            ['Acceptance criteria', workflow.criteria],
            ['Sample input — input.json', workflow.inputPreview],
            ['Expected sample output — expected.json', workflow.expectedPreview],
          ].map(([label, content]) => (
            <section key={label}>
              <h4>{label}</h4>
              <pre className="full-text" tabIndex={0} role="region" aria-label={label}>
                {content}
              </pre>
            </section>
          ))}
        </details>
        <div className="studio-permission">
          <ShieldCheck size={20} />
          <div>
            <strong>What Start job authorizes</strong>
            <p>{workflow.permissionNotice}</p>
            <p>
              One initial candidate and up to {workflow.maxRepairCandidates} repair candidates. Each
              role uses a separate session. Final acceptance stays with you.
            </p>
            <p className="small">
              {status?.costNotice ||
                'VCM is free. Codex uses your own account and provider allowance; usage may incur charges.'}
            </p>
          </div>
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error} You can retry this request; it keeps the same job request ID.
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" className="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || !target || !readyRoles || !readyRuntime}
          >
            <Play size={15} />
            {busy ? 'Starting…' : 'Start job'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function JobDetail({
  job,
  workflow,
  onBack,
  onUpdated,
  onTime,
}: {
  job: JobInfo;
  workflow?: WorkflowInfo;
  onBack: () => void;
  onUpdated: (job: JobInfo) => void;
  onTime: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const retryAttempt = useRef<{ version: string; id: string } | null>(null);
  const update = async (
    action: 'cancel' | 'retry' | 'review',
    decision?: 'accepted' | 'rejected',
  ) => {
    if (busy) return;
    if (action === 'review' && note.trim().length < 3) {
      setError('Add a review note of at least three characters before making your decision.');
      return;
    }
    setBusy(action === 'review' ? decision! : action);
    setError(null);
    if (action === 'retry' && retryAttempt.current?.version !== job.updatedAt)
      retryAttempt.current = { version: job.updatedAt, id: crypto.randomUUID() };
    try {
      onUpdated(
        await request<JobInfo>(
          `${jobPath(job.id)}/${action}`,
          action === 'review'
            ? { decision, note: note.trim() }
            : action === 'retry'
              ? { requestId: retryAttempt.current!.id }
              : {},
        ),
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(null);
    }
  };
  const stages =
    workflow?.stages ??
    (Object.keys(stageNames) as StageId[]).map((id) => ({ id, title: stageNames[id], role: '' }));
  const files = job.stages.flatMap((stage) =>
    stage.artifacts
      .filter((artifact) => artifact.source === 'runtime')
      .map((artifact) => ({ ...artifact, stage })),
  );
  const stopped = !active(job) && job.status !== 'waiting_owner' && !job.ownerReview;
  return (
    <section className="job-detail" aria-label="Job details">
      <button className="text-button job-back" onClick={onBack}>
        <ArrowLeft size={14} />
        All jobs
      </button>
      <header className="job-detail-heading">
        <div>
          <span className="eyebrow">
            {job.companyName} · {job.workflowId}
          </span>
          <h3>{job.title}</h3>
          <p>
            Started {date(job.createdAt)} · Candidate {job.candidate + 1} · Up to{' '}
            {job.maxRepairCandidates} repairs
          </p>
          <p>
            Acceptance owner:{' '}
            <strong>{job.acceptanceOwner ?? 'Not recorded in this historical job'}</strong>
          </p>
        </div>
        <JobBadge job={job} />
      </header>
      <ol className="job-pipeline" aria-label="Workflow progress">
        {stages.map((definition, index) => {
          const stage = job.stages
            .filter(
              (item) =>
                item.kind === definition.id &&
                (definition.id === 'intake' ||
                  definition.id === 'requirements' ||
                  item.attempt === job.candidate),
            )
            .at(-1);
          return (
            <li
              key={definition.id}
              className={stage ? `stage-${stage.status}` : 'stage-pending'}
              aria-current={stage?.status === 'running' ? 'step' : undefined}
            >
              <span className="job-stage-number">
                {stage?.status === 'completed' ? <Check size={16} /> : index + 1}
              </span>
              <div>
                <strong>{definition.title}</strong>
                <span>{stage?.agentName ?? 'Waiting for handoff'}</span>
                <small>
                  {stage
                    ? stage.status === 'running'
                      ? 'Working now'
                      : stage.status === 'completed'
                        ? 'Stage completed'
                        : stage.status === 'cancelled'
                          ? 'Cancelled'
                          : 'Execution failed'
                    : 'Not started'}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      {job.error && (
        <div className="error-box" role="alert">
          {job.error}
        </div>
      )}
      {active(job) && (
        <div className="job-running-note" role="status">
          <CircleDashed size={18} />
          <div>
            <strong>
              {job.status === 'queued'
                ? 'Waiting for the runtime'
                : 'Your company is working through the brief'}
            </strong>
            <p>
              Progress refreshes while this job is active. You can leave this view; the local server
              continues the job.
            </p>
          </div>
          <button className="button" disabled={!!busy} onClick={() => void update('cancel')}>
            <Square size={13} />
            {busy === 'cancel' ? 'Stopping…' : 'Stop job'}
          </button>
        </div>
      )}
      {stopped && (
        <div className="connection-note warning-note">
          <strong>{labels[job.status]}</strong>
          <p>
            {job.retryReason ||
              'Review the stage evidence and resolve the reported issue before starting another job.'}
          </p>
          {job.retryable && (
            <button className="button" disabled={!!busy} onClick={() => void update('retry')}>
              <RefreshCw size={14} />
              {busy === 'retry' ? 'Retrying…' : 'Retry failed execution'}
            </button>
          )}
        </div>
      )}
      <section className="job-files" aria-label="Produced files">
        <div className="jobs-list-heading">
          <div>
            <h4>Files you can inspect</h4>
            <p>
              Saved from the runtime’s actual workspace. Versions stay attached to their producing
              stage.
            </p>
          </div>
          <div className="jobs-actions">
            {['waiting_owner', 'accepted', 'rejected'].includes(job.status) && (
              <a className="button primary" href={`${jobPath(job.id)}/deliverables`} download>
                <Download size={15} />
                Download reviewed files (.zip)
              </a>
            )}
            <a className="button" href={`${jobPath(job.id)}/export`} download>
              <Download size={14} />
              Export evidence (JSON)
            </a>
          </div>
        </div>
        {files.length ? (
          <ul>
            {files.map((file) => (
              <li key={`${file.stage.id}:${file.id}`}>
                <FileText size={19} />
                <div>
                  <strong>{file.path}</strong>
                  <span>
                    {stageNames[file.stage.kind]} · Candidate {file.stage.attempt + 1} ·{' '}
                    {size(file.bytes)}
                  </span>
                  <details>
                    <summary>File SHA-256</summary>
                    <code>{file.sha256}</code>
                  </details>
                </div>
                <a
                  className="button"
                  href={`${jobPath(job.id)}/artifacts/${encodeURIComponent(file.id)}`}
                  download
                  aria-label={`Download ${file.path}, ${stageNames[file.stage.kind]}, candidate ${file.stage.attempt + 1}`}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="connection-note">
            {active(job)
              ? 'Produced files will appear after each stage is saved.'
              : 'No runtime-produced files were saved for this job.'}
          </p>
        )}
      </section>
      {job.status === 'waiting_owner' && (
        <form
          className="job-owner-review"
          onSubmit={(event) => {
            event.preventDefault();
            void update('review', 'accepted');
          }}
        >
          <span className="eyebrow">Chairperson: you.</span>
          <h4>Make the call.</h4>
          <p>
            <strong>
              Acceptance owner: {job.acceptanceOwner ?? 'Not recorded in this historical job'}
            </strong>
          </p>
          <p>
            Inspect the files and independent QA evidence below. A completed workflow is ready for
            your decision; it does not accept its own result.
          </p>
          <label>
            Review note
            <textarea
              required
              minLength={3}
              rows={3}
              maxLength={4000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What did you inspect, and does the result meet the brief?"
            />
          </label>
          <div className="jobs-actions">
            <button
              type="button"
              className="button"
              disabled={!!busy}
              onClick={() => void update('review', 'rejected')}
            >
              {busy === 'rejected' ? 'Saving…' : 'Reject result'}
            </button>
            <button className="button primary" disabled={!!busy}>
              <CheckCircle2 size={15} />
              {busy === 'accepted' ? 'Saving…' : 'Accept result'}
            </button>
          </div>
        </form>
      )}
      {job.ownerReview && (
        <section className={`job-owner-receipt job-status-${job.ownerReview.decision}`}>
          <ShieldCheck size={20} />
          <div>
            <h4>{labels[job.ownerReview.decision]}</h4>
            <p>Acceptance owner: {job.acceptanceOwner ?? 'Not recorded in this historical job'}</p>
            <p>{job.ownerReview.note}</p>
            <small>{date(job.ownerReview.reviewedAt)}</small>
          </div>
        </section>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <section className="job-stage-evidence" aria-label="Stage evidence">
        <div className="jobs-list-heading">
          <h4>Who did what</h4>
          <span>{job.stages.length} stage runs</span>
        </div>
        <p className="muted small">
          Inspect role output, separate session identities, input hashes and observed command
          results. A zero exit code describes that command; it does not grant owner acceptance.
        </p>
        {job.stages.map((stage) => (
          <StageEvidence key={stage.id} stage={stage} jobId={job.id} />
        ))}
      </section>
      <details className="text-disclosure job-technical">
        <summary>Job record & event history</summary>
        <dl>
          <dt>Job ID</dt>
          <dd>{job.id}</dd>
          <dt>Content version</dt>
          <dd>{job.contentVersion}</dd>
          <dt>Content SHA-256</dt>
          <dd>
            <code>{job.contentSha256}</code>
          </dd>
          <dt>Explicit execution retries</dt>
          <dd>{job.retryCount}</dd>
        </dl>
        <ol>
          {job.events.map((event, index) => (
            <li key={`${event.at}:${index}`}>
              <time>{date(event.at)}</time>
              <span>{event.message}</span>
            </li>
          ))}
        </ol>
      </details>
      <div className="studio-time-note">
        <p>
          Delivery hours are booked human-equivalent effort. Jobs do not automatically add hours.
        </p>
        <button className="text-button" onClick={onTime}>
          Open Time Tracker <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}

function StageEvidence({ stage, jobId }: { stage: JobStage; jobId: string }) {
  return (
    <details className="job-evidence-card">
      <summary>
        <span>
          <strong>{stageNames[stage.kind]}</strong>
          <small>
            {stage.agentName} · Candidate {stage.attempt + 1}
          </small>
        </span>
        <span className={`job-stage-state stage-${stage.status}`}>{stage.status}</span>
      </summary>
      <div className="job-evidence-body">
        {stage.error && <p className="error-box">{stage.error}</p>}
        <dl>
          <dt>Role</dt>
          <dd>{stage.role}</dd>
          <dt>Agent ID</dt>
          <dd>
            <code>{stage.agentId}</code>
          </dd>
          <dt>Runtime</dt>
          <dd>{stage.runtimeVersion ?? 'Not yet recorded'}</dd>
          <dt>Session ID</dt>
          <dd>
            <code>{stage.sessionId ?? 'Not yet recorded'}</code>
          </dd>
          <dt>Started</dt>
          <dd>{date(stage.startedAt)}</dd>
          <dt>Finished</dt>
          <dd>{stage.finishedAt ? date(stage.finishedAt) : 'Not finished'}</dd>
        </dl>
        <h5>Role output</h5>
        {stage.output ? (
          <pre
            className="result-output"
            tabIndex={0}
            role="region"
            aria-label={`${stageNames[stage.kind]} output`}
          >
            {stage.output}
          </pre>
        ) : (
          <p className="muted small">No final role output recorded.</p>
        )}
        <h5>Observed commands</h5>
        {stage.commands.length ? (
          <div className="job-commands">
            {stage.commands.map((command) => (
              <details key={command.id}>
                <summary>
                  <code>{command.command}</code>
                  <span className={command.exitCode === 0 ? 'command-ok' : 'command-other'}>
                    {command.exitCode === null ? command.status : `Exit ${command.exitCode}`}
                  </span>
                </summary>
                <pre tabIndex={0} role="region" aria-label="Command output">
                  {command.output || 'No command output captured.'}
                </pre>
              </details>
            ))}
          </div>
        ) : (
          <p className="muted small">No command execution receipts were captured for this stage.</p>
        )}
        <details className="text-disclosure">
          <summary>Captured input and prompt hashes</summary>
          <dl>
            <dt>Prompt SHA-256</dt>
            <dd>
              <code>{stage.promptSha256}</code>
            </dd>
            {Object.entries(stage.inputHashes).map(([path, hash]) => (
              <div className="job-hash-entry" key={path}>
                <dt>{path}</dt>
                <dd>
                  <code>{hash}</code>
                </dd>
              </div>
            ))}
          </dl>
          <ul className="job-input-downloads">
            {stage.artifacts
              .filter((artifact) => artifact.source !== 'runtime')
              .map((artifact) => (
                <li key={artifact.id}>
                  <a
                    href={`${jobPath(jobId)}/artifacts/${encodeURIComponent(artifact.id)}`}
                    download
                  >
                    <Download size={12} />
                    {artifact.path}
                  </a>
                  <span>
                    {artifact.source === 'verifier' ? 'Independent verifier' : 'Captured input'} ·{' '}
                    {size(artifact.bytes)}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      </div>
    </details>
  );
}
