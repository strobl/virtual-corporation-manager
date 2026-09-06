import type { CompanyDefinition } from '../domain/contracts';

export interface SetupDepartment {
  id: string;
  name: string;
  purpose: string;
  leadId: string | null;
}
export interface SetupAgent {
  id: string;
  name: string;
  role: string;
  instructions: string;
  responsibilities: string;
  departmentId: string | null;
  reportsToId: string | null;
}
export interface CorporationDraft {
  name: string;
  shortCode: string;
  purpose: string;
  color: string;
  departments: SetupDepartment[];
  agents: SetupAgent[];
}

export function createCorporationDraft(): CorporationDraft {
  return { name: '', shortCode: '', purpose: '', color: '#256c5b', departments: [], agents: [] };
}

export function suggestCorporationCode(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function nextId(prefix: string, rows: { id: string }[]): string {
  const ids = new Set(rows.map((row) => row.id));
  let index = 1;
  while (ids.has(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}

export function addSetupDepartment(draft: CorporationDraft): CorporationDraft {
  return {
    ...draft,
    departments: [
      ...draft.departments,
      { id: nextId('draft-department', draft.departments), name: '', purpose: '', leadId: null },
    ],
  };
}

export function addSetupAgent(draft: CorporationDraft): CorporationDraft {
  return {
    ...draft,
    agents: [
      ...draft.agents,
      {
        id: nextId('draft-agent', draft.agents),
        name: '',
        role: '',
        instructions: '',
        responsibilities: '',
        departmentId: null,
        reportsToId: null,
      },
    ],
  };
}

export function removeSetupDepartment(draft: CorporationDraft, id: string): CorporationDraft {
  return {
    ...draft,
    departments: draft.departments.filter((row) => row.id !== id),
    agents: draft.agents.map((row) =>
      row.departmentId === id ? { ...row, departmentId: null } : row,
    ),
  };
}

export function removeSetupAgent(draft: CorporationDraft, id: string): CorporationDraft {
  return {
    ...draft,
    departments: draft.departments.map((row) =>
      row.leadId === id ? { ...row, leadId: null } : row,
    ),
    agents: draft.agents
      .filter((row) => row.id !== id)
      .map((row) => (row.reportsToId === id ? { ...row, reportsToId: null } : row)),
  };
}

/** A local editable starting structure, with no execution or provider configuration. */
export function addStarterStructure(draft: CorporationDraft): CorporationDraft {
  if (draft.agents.length || draft.departments.length)
    throw new Error('The small-team starter is available before adding your own structure.');
  return {
    ...draft,
    departments: [
      {
        id: 'draft-operations',
        name: 'Operations',
        purpose: 'Coordinate priorities and responsibilities.',
        leadId: 'draft-coordinator',
      },
      {
        id: 'draft-delivery',
        name: 'Delivery',
        purpose: 'Prepare and review the corporation’s work.',
        leadId: 'draft-specialist',
      },
    ],
    agents: [
      {
        id: 'draft-coordinator',
        name: 'Coordinator',
        role: 'Operations lead',
        instructions: '',
        responsibilities: 'Clarify priorities\nCoordinate responsibilities',
        departmentId: 'draft-operations',
        reportsToId: null,
      },
      {
        id: 'draft-researcher',
        name: 'Researcher',
        role: 'Research analyst',
        instructions: '',
        responsibilities: 'Gather relevant information\nDocument sources and findings',
        departmentId: 'draft-delivery',
        reportsToId: 'draft-coordinator',
      },
      {
        id: 'draft-specialist',
        name: 'Specialist',
        role: 'Delivery lead',
        instructions: '',
        responsibilities: 'Prepare agreed deliverables\nReview work against requirements',
        departmentId: 'draft-delivery',
        reportsToId: 'draft-coordinator',
      },
    ],
  };
}

export function canReportTo(draft: CorporationDraft, agentId: string, managerId: string): boolean {
  const agents = new Map(draft.agents.map((agent) => [agent.id, agent]));
  const visited = new Set([agentId]);
  let current: string | null = managerId;
  while (current) {
    if (visited.has(current) || !agents.has(current)) return false;
    visited.add(current);
    current = agents.get(current)!.reportsToId;
  }
  return true;
}

/** Client draft feedback only. The existing server preview remains authoritative. */
export function corporationDraftErrors(draft: CorporationDraft, identityOnly = false): string[] {
  const errors: string[] = [];
  const text = (value: string, label: string, maximum: number, optional = false) => {
    if (!optional && !value.trim()) errors.push(`${label} is required.`);
    else if (value.trim().length > maximum)
      errors.push(`${label} must be ${maximum} characters or fewer.`);
  };
  text(draft.name, 'Corporation name', 120);
  text(draft.purpose, 'Purpose', 5000, true);
  const code = draft.shortCode.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,23}$/.test(code))
    errors.push(
      'Short code must be 1–24 letters, numbers, underscores or hyphens, starting with a letter or number.',
    );
  if (!/^#[0-9a-fA-F]{6}$/.test(draft.color)) errors.push('Choose a valid corporation color.');
  if (identityOnly) return errors;
  const departmentIds = new Set(draft.departments.map((row) => row.id));
  const agentIds = new Set(draft.agents.map((row) => row.id));
  if (departmentIds.size !== draft.departments.length || agentIds.size !== draft.agents.length)
    errors.push('Each draft department and agent needs a distinct identity.');
  for (const [index, department] of draft.departments.entries()) {
    text(department.id, 'Department identity', 120);
    text(department.name, `Department ${index + 1} name`, 120);
    text(department.purpose, `Department ${index + 1} purpose`, 5000, true);
    if (department.leadId && !agentIds.has(department.leadId))
      errors.push(
        `Choose an existing agent as the lead of ${department.name || 'the department'}.`,
      );
  }
  for (const [index, agent] of draft.agents.entries()) {
    const label = agent.name.trim() || `Agent ${index + 1}`;
    text(agent.id, 'Agent identity', 120);
    text(agent.name, `Agent ${index + 1} name`, 120);
    text(agent.role, `${label} role`, 120);
    text(agent.instructions, `${label} instructions`, 20000, true);
    const responsibilities = agent.responsibilities
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (responsibilities.length > 50) errors.push(`${label} may have up to 50 responsibilities.`);
    if (responsibilities.some((line) => line.length > 1000))
      errors.push(`Each responsibility for ${label} must be 1,000 characters or fewer.`);
    if (agent.departmentId && !departmentIds.has(agent.departmentId))
      errors.push(`Choose an existing department for ${label}.`);
    if (agent.reportsToId && !canReportTo(draft, agent.id, agent.reportsToId))
      errors.push(`${label} needs a valid reporting line without a cycle.`);
  }
  return errors;
}

/** Temporary graph IDs are deliberately remapped by definition.import at preview/apply. */
export function buildCorporationDefinition(
  draft: CorporationDraft,
  now: string,
): CompanyDefinition {
  const errors = corporationDraftErrors(draft);
  if (errors.length) throw new Error(errors[0]);
  if (!Number.isFinite(Date.parse(now))) throw new Error('A valid creation date is required.');
  const companyId = 'draft-corporation';
  const timestamp = new Date(now).toISOString();
  const name = draft.name.trim();
  const description = draft.purpose.trim();
  return {
    schemaVersion: 1,
    name,
    description,
    companies: [
      {
        id: companyId,
        name,
        shortCode: draft.shortCode.trim().toUpperCase(),
        description,
        color: draft.color,
        status: 'active',
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    departments: draft.departments.map((department) => ({
      id: department.id,
      companyId,
      name: department.name.trim(),
      description: department.purpose.trim(),
      managerId: department.leadId,
    })),
    agents: draft.agents.map((agent) => ({
      id: agent.id,
      name: agent.name.trim(),
      role: agent.role.trim(),
      kind: 'agent',
      instructions: agent.instructions.trim(),
      responsibilities: agent.responsibilities
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      departmentId: agent.departmentId,
      managerId: agent.reportsToId,
      status: 'active',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    assignments: draft.agents.map((agent, index) => ({
      id: `draft-assignment-${index + 1}`,
      agentId: agent.id,
      companyId,
      isPrimary: true,
      startedAt: timestamp,
      endedAt: null,
    })),
    relationships: [],
  };
}
