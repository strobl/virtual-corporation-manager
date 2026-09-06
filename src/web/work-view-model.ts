import type { Company, WorkRecord, WorkspaceState } from '../domain/contracts';
import type { RunInfo } from './Work';

/** Historical work keeps its company; never fall back to another live assignment. */
export function workAgentDestination(state: WorkspaceState, agentId: string, companyId: string) {
  const current =
    state.agents.some((row) => row.id === agentId && row.status === 'active') &&
    state.companies.some((row) => row.id === companyId && row.status === 'active') &&
    state.assignments.some(
      (row) => row.agentId === agentId && row.companyId === companyId && !row.endedAt,
    );
  return {
    kind: current ? ('organization' as const) : ('historical' as const),
    agentId,
    companyId,
  };
}

/** Mirror the runtime's current primary/first assignment choice, without changing provenance. */
export function getRunTargetCompany(state: WorkspaceState, agentId: string): Company | null {
  const agent = state.agents.find(
    (item) => item.id === agentId && item.status === 'active' && item.kind === 'agent',
  );
  if (!agent) return null;
  const assignments = state.assignments.filter(
    (item) => item.agentId === agent.id && !item.endedAt,
  );
  const assignment = assignments.find((item) => item.isPrimary) ?? assignments[0];
  return (
    state.companies.find(
      (company) => company.id === assignment?.companyId && company.status === 'active',
    ) ?? null
  );
}

/** A requested detail must be present and belong to the view's scope. */
export function initialRunForScope(
  runs: readonly RunInfo[],
  companyId: string | null,
  initialRunId: string | null,
): RunInfo | null {
  return (
    runs.find(
      (run) => run.id === initialRunId && (companyId === null || run.companyId === companyId),
    ) ?? null
  );
}

export type WorkDisplayState = {
  label: 'Queued' | 'Running' | 'Failed' | 'Run completed' | 'Needs your review' | 'Accepted';
  tone: 'queued' | 'running' | 'failed' | 'completed' | 'review' | 'accepted';
  reviewable: boolean;
  workRecord: WorkRecord | null;
};

/** A work record must belong to this run and its original company and agent. */
export function runDisplayState(run: RunInfo, work: readonly WorkRecord[]): WorkDisplayState {
  const workRecord =
    work.find(
      (record) =>
        record.runId === run.id &&
        record.companyId === run.companyId &&
        record.agentId === run.agentId,
    ) ?? null;
  const reviewable =
    run.status === 'completed' &&
    run.output.trim().length > 0 &&
    workRecord?.status === 'submitted';
  if (run.status === 'completed') {
    if (workRecord?.status === 'accepted') {
      return { label: 'Accepted', tone: 'accepted', reviewable: false, workRecord };
    }
    if (reviewable) {
      return { label: 'Needs your review', tone: 'review', reviewable: true, workRecord };
    }
    return { label: 'Run completed', tone: 'completed', reviewable: false, workRecord };
  }
  const labels = { queued: 'Queued', running: 'Running', failed: 'Failed' } as const;
  return { label: labels[run.status], tone: run.status, reviewable: false, workRecord };
}

/** Scope work by its persisted provenance, never by an agent's current assignments. */
export function createWorkViewModel(
  state: WorkspaceState,
  runs: readonly RunInfo[],
  companyId: string | null = null,
) {
  const scopedRuns = runs.filter((run) => companyId === null || run.companyId === companyId);
  const work = state.work.filter((record) => companyId === null || record.companyId === companyId);
  const reviewableRuns = scopedRuns.filter((run) => runDisplayState(run, work).reviewable);
  const reviewableIds = new Set(reviewableRuns.map((run) => run.id));
  const acceptedRecords = work.filter((record) => record.status === 'accepted');
  const manualRecords = work.filter(
    (record) =>
      record.provenance === 'manual' && record.runId === null && record.status !== 'accepted',
  );
  const reviewableManualRecords = manualRecords.filter(
    (record) => record.status === 'submitted' && record.output.trim().length > 0,
  );
  return {
    scopeName:
      companyId === null
        ? 'All companies'
        : (state.companies.find((company) => company.id === companyId)?.name ?? 'Selected company'),
    runs: [...reviewableRuns, ...scopedRuns.filter((run) => !reviewableIds.has(run.id))],
    work,
    acceptedRecords,
    manualRecords,
    reviewableManualRecords,
    reviewableRuns,
    stats: {
      tasks: scopedRuns.length,
      running: scopedRuns.filter((run) => run.status === 'running').length,
      queued: scopedRuns.filter((run) => run.status === 'queued').length,
      completed: scopedRuns.filter((run) => run.status === 'completed').length,
      accepted: acceptedRecords.length,
      reviewable: reviewableRuns.length + reviewableManualRecords.length,
    },
  };
}
