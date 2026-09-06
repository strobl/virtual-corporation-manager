import type { Agent, Company, Relationship, WorkspaceState } from '../domain/contracts';
import type { TimeSnapshot } from '../time/contracts';
import { buildOrgPyramid, pyramidTreeRows } from '../lib/organization/org-pyramid';
import type { IntegrationStatus, RunInfo } from './Work';
import { companyAgents, roleLabel, toSnapshot } from './model';
import { aggregateTime, timeMonday } from './time-view-model';
import { getRunTargetCompany } from './work-view-model';

export interface ConsoleRelationship {
  relationship: Relationship;
  company: Company;
  percentage: string;
}

export function companyRelationships(state: WorkspaceState, companyId: string) {
  const result: Record<'ownedBy' | 'owns' | 'collaborates', ConsoleRelationship[]> = {
    ownedBy: [],
    owns: [],
    collaborates: [],
  };
  for (const relationship of state.relationships) {
    if (
      relationship.endedAt ||
      (relationship.fromCompanyId !== companyId && relationship.toCompanyId !== companyId)
    )
      continue;
    const outgoing = relationship.fromCompanyId === companyId;
    const company = state.companies.find(
      (row) =>
        row.id === (outgoing ? relationship.toCompanyId : relationship.fromCompanyId) &&
        row.status === 'active',
    );
    if (!company) continue;
    const group =
      relationship.kind === 'collaboration' ? 'collaborates' : outgoing ? 'owns' : 'ownedBy';
    result[group].push({
      relationship,
      company,
      percentage:
        relationship.percentage === null ? 'Not specified' : `${relationship.percentage}%`,
    });
  }
  for (const rows of Object.values(result))
    rows.sort(
      (a, b) =>
        a.company.name.localeCompare(b.company.name) ||
        a.relationship.id.localeCompare(b.relationship.id),
    );
  return result;
}

export function consoleDepartmentLabel(state: WorkspaceState, member: Agent, companyId: string) {
  const department = state.departments.find((row) => row.id === member.departmentId);
  if (!department) return 'Company level';
  if (department.companyId === companyId) return department.name;
  const company = state.companies.find((row) => row.id === department.companyId);
  return `${department.name} · ${company?.name ?? 'Other company'}`;
}

export function filterConsoleMembers(
  members: readonly Agent[],
  query: string,
  kind: 'all' | Agent['kind'] = 'all',
) {
  const normalize = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLocaleLowerCase();
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  return members.filter(
    (member) =>
      (kind === 'all' || member.kind === kind) &&
      terms.every((term) =>
        normalize(
          [member.name, member.role, roleLabel(member.role), ...member.responsibilities].join(' '),
        ).includes(term),
      ),
  );
}

export type ConsoleDataState = 'loading' | 'ready' | 'unavailable';

export function consoleRuntime(
  status: IntegrationStatus | null,
  dataState: ConsoleDataState = status ? 'ready' : 'loading',
) {
  if (dataState === 'unavailable')
    return { ready: false, label: 'Connection status unavailable. Refresh to check again' };
  if (dataState === 'loading' || !status) return { ready: false, label: 'Checking connection' };
  if (status.codex.state === 'ready') return { ready: true, label: 'Codex connected' };
  if (status.buzz.available && status.buzz.state === 'configured')
    return { ready: true, label: 'Buzz connected' };
  return { ready: false, label: 'No runtime connected' };
}

export function createCompanyConsoleModel(
  state: WorkspaceState,
  companyId: string,
  selectedMemberId: string | null,
  time: TimeSnapshot | null,
  timeError: string | null,
  runs: readonly RunInfo[],
  runsState: ConsoleDataState = 'ready',
) {
  const company =
    state.companies.find((row) => row.id === companyId && row.status === 'active') ?? null;
  const members = company
    ? companyAgents(state, companyId).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const memberIds = new Set(members.map((member) => member.id));
  const selected = members.find((member) => member.id === selectedMemberId) ?? null;
  const departments = company ? state.departments.filter((row) => row.companyId === companyId) : [];
  const manager = selected
    ? (state.agents.find((member) => member.id === selected.managerId) ?? null)
    : null;
  const assignments = selected
    ? state.assignments
        .filter((row) => row.agentId === selected.id && !row.endedAt)
        .map((assignment) => ({
          assignment,
          company: state.companies.find((row) => row.id === assignment.companyId),
        }))
        .filter((row): row is typeof row & { company: Company } => row.company?.status === 'active')
    : [];
  const ledger = timeError ? null : time;
  const from = ledger ? timeMonday(ledger.today) : null;
  const hours =
    ledger && from
      ? aggregateTime(
          ledger.entries.filter((entry) => entry.companyId === companyId),
          from,
          ledger.today,
        )
      : null;
  const selectedRuns = selected
    ? runs.filter((run) => run.agentId === selected.id && run.companyId === companyId)
    : [];
  const running = selectedRuns.filter((run) => run.status === 'running').length;
  const queued = selectedRuns.filter((run) => run.status === 'queued').length;
  return {
    company,
    members,
    selected,
    departments,
    manager,
    localManager: manager && memberIds.has(manager.id) ? manager : null,
    assignments,
    taskCompany: selected ? getRunTargetCompany(state, selected.id) : null,
    relationships: companyRelationships(state, companyId),
    counts: {
      agents: members.filter((member) => member.kind === 'agent').length,
      humans: members.filter((member) => member.kind === 'human').length,
      departments: departments.length,
    },
    reportingRows: company
      ? pyramidTreeRows(buildOrgPyramid(toSnapshot(state), companyId), new Set())
      : [],
    hours,
    from,
    through: ledger?.today ?? null,
    activity:
      runsState === 'unavailable'
        ? 'Direct-run activity unavailable. Refresh to check again.'
        : runsState === 'loading'
          ? 'Checking direct-run activity…'
          : running || queued
            ? `Direct runs in this company: ${running} running · ${queued} queued`
            : 'No active direct runs in this company.',
  };
}
