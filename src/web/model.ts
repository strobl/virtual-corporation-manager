import type { Agent, WorkspaceState } from '../domain/contracts';
import type { WorkspaceSnapshot } from '../lib/organization/tree';
import type { TreeNode } from '../components/ds/DenseTree';

const operationalRoleLabels: Record<string, string> = {
  'ao.role.delivery-manager': 'Delivery Manager',
  'ao.role.requirements-analyst': 'Requirements Analyst',
  'ao.role.software-builder': 'Software Builder',
  'ao.role.quality-reviewer': 'Quality Reviewer',
  'ao.role.handoff-editor': 'Handoff Editor',
};

/** Presentation only. Canonical workflow role keys stay in the stored company model. */
export function roleLabel(role: string): string {
  if (operationalRoleLabels[role]) return operationalRoleLabels[role];
  if (!role.startsWith('ao.role.')) return role;
  return role
    .slice('ao.role.'.length)
    .split(/[-_]+/u)
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : ''))
    .filter(Boolean)
    .join(' ');
}

export function agentInitials(name: string): string {
  const displayName = name.replace(/^PS-[A-Z0-9]+\s*[·:–—-]\s*/iu, '').trim();
  return displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase();
}

export type Selection = {
  kind: 'company' | 'department' | 'agent';
  id: string;
  companyId?: string;
};
export const selectionKey = (selection: Selection) =>
  `${selection.kind === 'agent' && selection.companyId ? `company:${selection.companyId}/` : ''}${selection.kind}:${selection.id}`;
export function parseSelection(key: string): Selection | null {
  const [kind, ...id] = key.split('/').at(-1)!.split(':');
  const context =
    key.includes('/') && key.startsWith('company:') ? key.split('/')[0]!.slice(8) : undefined;
  return (kind === 'company' || kind === 'department' || kind === 'agent') && id.join(':')
    ? { kind, id: id.join(':'), ...(kind === 'agent' && context ? { companyId: context } : {}) }
    : null;
}
export const activeAssignments = (state: WorkspaceState) =>
  state.assignments.filter((row) => !row.endedAt);
export function companyAgents(state: WorkspaceState, companyId: string): Agent[] {
  const ids = new Set(
    activeAssignments(state)
      .filter((row) => row.companyId === companyId)
      .map((row) => row.agentId),
  );
  return state.agents.filter((row) => row.status === 'active' && ids.has(row.id));
}
export function companyForSelection(
  state: WorkspaceState,
  selection: Selection | null,
): string | null {
  if (selection?.kind === 'company') return selection.id;
  if (selection?.kind === 'department')
    return state.departments.find((row) => row.id === selection.id)?.companyId ?? null;
  if (selection?.kind === 'agent') {
    const rows = activeAssignments(state).filter((row) => row.agentId === selection.id);
    if (selection.companyId && rows.some((row) => row.companyId === selection.companyId))
      return selection.companyId;
    return (rows.find((row) => row.isPrimary) ?? rows[0])?.companyId ?? null;
  }
  return state.companies.find((row) => row.status === 'active')?.id ?? null;
}
export function toSnapshot(state: WorkspaceState): WorkspaceSnapshot {
  const departments = new Map(state.departments.map((row) => [row.id, row.name]));
  return {
    workspaceName: 'My companies',
    corporations: state.companies.filter((row) => row.status === 'active'),
    ownership: state.relationships
      .filter((row) => row.kind === 'ownership' && !row.endedAt)
      .map((row) => ({
        ownerCorporationId: row.fromCompanyId,
        ownedCorporationId: row.toCompanyId,
        percentage: row.percentage,
      })),
    members: state.agents
      .filter((row) => row.status === 'active')
      .map((row) => ({
        id: row.id,
        name: row.name,
        role: roleLabel(row.role),
        kind: row.kind,
        managerId: row.managerId,
        department: row.departmentId ? (departments.get(row.departmentId) ?? null) : null,
      })),
    assignments: activeAssignments(state).map((row) => ({
      teamMemberId: row.agentId,
      corporationId: row.companyId,
      isPrimary: row.isPrimary,
    })),
    factories: [],
  };
}
export function organizationTree(state: WorkspaceState, query = ''): TreeNode[] {
  const needle = query.trim().toLowerCase();
  const matches = (...values: string[]) =>
    !needle || values.some((value) => value.toLowerCase().includes(needle));
  return state.companies
    .filter((company) => company.status === 'active')
    .flatMap((company) => {
      const all = companyAgents(state, company.id);
      const wholeCompany = matches(company.name, company.shortCode);
      const agentNodes = (agents: Agent[], parentMatches: boolean): TreeNode[] =>
        agents
          .filter(
            (agent) =>
              parentMatches ||
              matches(agent.name, agent.role, roleLabel(agent.role), ...agent.responsibilities),
          )
          .map((agent) => ({
            id: `company:${company.id}/agent:${agent.id}`,
            label: agent.name,
            searchTerms: [agent.role, roleLabel(agent.role), ...agent.responsibilities],
          }));
      const departments = state.departments
        .filter((row) => row.companyId === company.id)
        .flatMap((department) => {
          const departmentMatches =
            wholeCompany || matches(department.name, department.description);
          const children = agentNodes(
            all.filter((agent) => agent.departmentId === department.id),
            departmentMatches,
          );
          return departmentMatches || children.length
            ? [
                {
                  id: `department:${department.id}`,
                  label: department.name,
                  children,
                },
              ]
            : [];
        });
      const localDepartmentIds = new Set(
        state.departments.filter((row) => row.companyId === company.id).map((row) => row.id),
      );
      const unassigned = agentNodes(
        all.filter((agent) => !agent.departmentId || !localDepartmentIds.has(agent.departmentId)),
        wholeCompany,
      );
      return wholeCompany || departments.length || unassigned.length
        ? [
            {
              id: `company:${company.id}`,
              label: company.name,
              searchTerms: [company.shortCode],
              children: [...departments, ...unassigned],
            },
          ]
        : [];
    });
}

/** Rows have path IDs; the inspector keeps one shared entity identity. */
export function selectedTreeRows(nodes: TreeNode[], selection: Selection | null): string[] {
  if (!selection) return [];
  return nodes.flatMap((node) => {
    const entity = parseSelection(node.id);
    return [
      ...(entity?.kind === selection.kind &&
      entity.id === selection.id &&
      (!selection.companyId || entity.companyId === selection.companyId)
        ? [node.id]
        : []),
      ...selectedTreeRows(node.children ?? [], selection),
    ];
  });
}
