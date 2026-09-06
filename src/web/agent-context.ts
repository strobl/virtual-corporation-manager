import type { Agent, WorkspaceState } from '../domain/contracts';
import { roleLabel } from './model';

export function companyContextLabel(state: WorkspaceState, companyId: string): string {
  const company = state.companies.find((row) => row.id === companyId);
  return company ? `${company.name} (${company.shortCode})` : 'Unknown company';
}

export function agentCompanyIds(state: WorkspaceState, agentId: string): string[] {
  return state.assignments
    .filter((row) => row.agentId === agentId && row.endedAt === null)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((row) => row.companyId);
}

export function agentDepartmentLabel(state: WorkspaceState, agent: Agent): string {
  const department = state.departments.find((row) => row.id === agent.departmentId);
  return department
    ? `${department.name} · ${companyContextLabel(state, department.companyId)}`
    : 'Company level';
}

export interface AgentContextOption {
  id: string;
  label: string;
  context: string;
  searchText: string;
}

function searchable(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/** Display only: callers retain their existing eligibility rules and actual IDs. */
export function agentContextOptions(
  state: WorkspaceState,
  agents: readonly Agent[],
): AgentContextOption[] {
  const options = agents.map((agent) => {
    const companyIds = agentCompanyIds(state, agent.id);
    const companies = companyIds.map((id) => companyContextLabel(state, id)).join(' / ');
    const department = state.departments.find((row) => row.id === agent.departmentId);
    const context = `${companies || 'No current company assignment'} · ${department?.name || 'Company level'}`;
    return {
      id: agent.id,
      label: `${agent.name} · ${roleLabel(agent.role)} — ${context}`,
      context,
      searchText: searchable(
        `${agent.name} ${agent.role} ${roleLabel(agent.role)} ${context} ${agent.id}`,
      ),
    };
  });
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
  return options.map((option) =>
    counts.get(option.label)! > 1
      ? { ...option, label: `${option.label} · ID ${option.id}` }
      : option,
  );
}

/** Searching must not silently remove or replace the currently selected manager. */
export function filterAgentOptions(
  options: readonly AgentContextOption[],
  query: string,
  selectedId = '',
): AgentContextOption[] {
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return options.filter(
    (option) => option.id === selectedId || terms.every((term) => option.searchText.includes(term)),
  );
}
