import { randomUUID } from 'node:crypto';
import type {
  Agent,
  Assignment,
  Company,
  CompanyDefinition,
  Department,
  DomainCommand,
  Relationship,
  WorkRecord,
  WorkspaceState,
} from './contracts.js';
import { DomainError, requireDomain as check } from './errors.js';
import { findActivePath, isValidPercentage } from './graph.js';

type ObjectValue = Record<string, unknown>;
export const SCHEMA_VERSION = 5;
export function emptyState(): WorkspaceState {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    companies: [],
    departments: [],
    agents: [],
    assignments: [],
    relationships: [],
    work: [],
    history: [],
  };
}
export function object(value: unknown): ObjectValue {
  check(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_INPUT',
    'Expected an object.',
  );
  return value as ObjectValue;
}
function knownKeys(value: ObjectValue, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  check(
    unknown.length === 0,
    'INVALID_DEFINITION',
    `${label} contains unsupported fields: ${unknown.join(', ')}. Company definitions contain configuration only; use a workspace backup for work and execution history.`,
  );
}
function valueLabel(value: unknown): string {
  if (value === null || value === '') return '(none)';
  if (Array.isArray(value)) return value.length ? value.join('; ') : '(none)';
  return String(value);
}
function fieldChanges(
  label: string,
  after: ObjectValue,
  before?: ObjectValue,
  state?: WorkspaceState,
): string[] {
  const labels: Record<string, string> = {
    name: 'Name',
    shortCode: 'Short code',
    description: 'Purpose',
    color: 'Color',
    companyId: 'Company',
    departmentId: 'Department',
    managerId: 'Reports to',
    role: 'Role',
    kind: 'Type',
    instructions: 'Instructions',
    responsibilities: 'Responsibilities',
  };
  const rendered = (key: string, value: unknown) => {
    if (value && state) {
      const names =
        key === 'companyId'
          ? state.companies
          : key === 'departmentId'
            ? state.departments
            : key === 'managerId'
              ? state.agents
              : [];
      return names.find((item) => item.id === value)?.name ?? valueLabel(value);
    }
    return valueLabel(value);
  };
  return Object.entries(after)
    .filter(([key, value]) => !before || JSON.stringify(before[key]) !== JSON.stringify(value))
    .map(
      ([key, value]) =>
        `${label} — ${labels[key] ?? key}: ${before ? `${rendered(key, before[key])} → ` : ''}${rendered(key, value)}`,
    );
}
function text(value: unknown, label: string, max = 200, optional = false): string {
  check(typeof value === 'string', 'INVALID_INPUT', `${label} must be text.`);
  const result = value.trim();
  check(
    (optional || result.length > 0) && result.length <= max,
    'INVALID_INPUT',
    `${label} must contain ${optional ? '0' : '1'}–${max} characters.`,
  );
  check(
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result),
    'INVALID_INPUT',
    `${label} contains unsupported control characters.`,
  );
  return result;
}
function nullableId(value: unknown): string | null {
  return value == null ? null : text(value, 'Reference', 200);
}
function requiredDate(value: unknown): string {
  check(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value)),
    'INVALID_INPUT',
    'A valid ISO timestamp is required.',
  );
  return value;
}
function status(value: unknown): 'active' | 'archived' {
  check(
    value === 'active' || value === 'archived',
    'INVALID_INPUT',
    'Status must be active or archived.',
  );
  return value;
}
function version(value: unknown): number {
  check(
    Number.isSafeInteger(value) && Number(value) >= 1,
    'INVALID_INPUT',
    'Entity version must be a positive integer.',
  );
  return Number(value);
}
function companyInput(
  value: unknown,
): Pick<Company, 'name' | 'shortCode' | 'description' | 'color'> {
  const v = object(value);
  const shortCode = text(v.shortCode, 'Short code', 24).toUpperCase();
  check(
    /^[A-Z0-9][A-Z0-9_-]*$/.test(shortCode),
    'INVALID_INPUT',
    'Short code must use letters, numbers, underscores or hyphens.',
  );
  const color = text(v.color, 'Color', 7);
  check(/^#[0-9a-fA-F]{6}$/.test(color), 'INVALID_INPUT', 'Color must be a six-digit hex value.');
  return {
    name: text(v.name, 'Company name'),
    shortCode,
    description: text(v.description, 'Description', 5000, true),
    color,
  };
}
function agentInput(
  value: unknown,
): Pick<
  Agent,
  'name' | 'role' | 'kind' | 'instructions' | 'responsibilities' | 'departmentId' | 'managerId'
> {
  const v = object(value);
  check(
    v.kind === 'agent' || v.kind === 'human',
    'INVALID_INPUT',
    'Member kind must be agent or human.',
  );
  check(
    Array.isArray(v.responsibilities) && v.responsibilities.length <= 50,
    'INVALID_INPUT',
    'Responsibilities must be a list of at most 50 items.',
  );
  return {
    name: text(v.name, 'Agent name'),
    role: text(v.role, 'Role'),
    kind: v.kind,
    instructions: text(v.instructions, 'Instructions', 20000, true),
    responsibilities: v.responsibilities.map((r: unknown) => text(r, 'Responsibility', 1000)),
    departmentId: nullableId(v.departmentId),
    managerId: nullableId(v.managerId),
  };
}
function departmentInput(value: unknown): Omit<Department, 'id'> {
  const v = object(value);
  return {
    companyId: text(v.companyId, 'Company reference'),
    name: text(v.name, 'Department name'),
    description: text(v.description, 'Description', 5000, true),
    managerId: nullableId(v.managerId),
  };
}
function activeCompany(state: WorkspaceState, id: string): Company {
  const result = state.companies.find((c) => c.id === id);
  check(result, 'NOT_FOUND', 'Company not found.');
  check(
    result.status === 'active',
    'ARCHIVED_ENTITY',
    'Restore the company before changing its organization.',
  );
  return result;
}
function activeAgent(state: WorkspaceState, id: string): Agent {
  const result = state.agents.find((a) => a.id === id);
  check(result, 'NOT_FOUND', 'Agent not found.');
  check(result.status === 'active', 'ARCHIVED_ENTITY', 'Restore the agent before changing it.');
  return result;
}
function touch(entity: Agent | Company, now: string) {
  entity.updatedAt = now;
  entity.version += 1;
}
function assignment(agentId: string, companyId: string, primary: boolean, now: string): Assignment {
  return {
    id: randomUUID(),
    agentId,
    companyId,
    isPrimary: primary,
    startedAt: now,
    endedAt: null,
  };
}
function clearManager(state: WorkspaceState, id: string, now: string) {
  for (const a of state.agents)
    if (a.managerId === id) {
      a.managerId = null;
      touch(a, now);
    }
  for (const d of state.departments) if (d.managerId === id) d.managerId = null;
}
function archiveAgent(state: WorkspaceState, a: Agent, now: string) {
  a.status = 'archived';
  a.managerId = null;
  touch(a, now);
  for (const x of state.assignments) if (x.agentId === a.id && x.endedAt === null) x.endedAt = now;
  clearManager(state, a.id, now);
}
function find<T extends { id: string }>(rows: T[], id: string, label: string): T {
  const result = rows.find((r) => r.id === id);
  check(result, 'NOT_FOUND', `${label} not found.`);
  return result;
}

/** Validate relational invariants against the whole candidate, before any write. */
export function validateState(state: WorkspaceState): void {
  const companies = new Map(state.companies.map((c) => [c.id, c]));
  const agents = new Map(state.agents.map((a) => [a.id, a]));
  const departments = new Map(state.departments.map((d) => [d.id, d]));
  for (const rows of [
    state.companies,
    state.agents,
    state.departments,
    state.assignments,
    state.relationships,
    state.work,
  ]) {
    check(
      new Set(rows.map((r) => r.id)).size === rows.length,
      'DUPLICATE_ID',
      'Entity IDs must be unique within their collection.',
    );
  }
  check(
    new Set(state.companies.map((c) => c.shortCode.toUpperCase())).size === state.companies.length,
    'DUPLICATE_SHORT_CODE',
    'Company short codes must be unique, including archived companies.',
  );
  for (const d of state.departments) {
    check(companies.has(d.companyId), 'INVALID_REFERENCE', 'Department company does not exist.');
    if (d.managerId)
      check(
        agents.get(d.managerId)?.status === 'active' &&
          state.assignments.some(
            (a) => a.agentId === d.managerId && a.companyId === d.companyId && a.endedAt === null,
          ),
        'INVALID_REFERENCE',
        'Department manager must have an active assignment to its company.',
      );
  }
  const activeAssignments = state.assignments.filter((a) => a.endedAt === null);
  const pairs = new Set<string>();
  for (const a of state.assignments) {
    check(
      agents.has(a.agentId) && companies.has(a.companyId),
      'INVALID_REFERENCE',
      'Assignment participants must exist.',
    );
    check(
      a.endedAt === null || Date.parse(a.endedAt) >= Date.parse(a.startedAt),
      'INVALID_INPUT',
      'Assignment end cannot precede its start.',
    );
    if (a.endedAt !== null) continue;
    check(
      agents.get(a.agentId)?.status === 'active' && companies.get(a.companyId)?.status === 'active',
      'ARCHIVED_ENTITY',
      'Active assignments require active participants.',
    );
    const pair = `${a.agentId}\0${a.companyId}`;
    check(
      !pairs.has(pair),
      'DUPLICATE_ASSIGNMENT',
      'An agent can have only one active assignment to each company.',
    );
    pairs.add(pair);
  }
  for (const a of state.agents) {
    const assigned = activeAssignments.filter((x) => x.agentId === a.id);
    check(
      assigned.filter((x) => x.isPrimary).length === (a.status === 'active' ? 1 : 0),
      'PRIMARY_REQUIRED',
      'Every active agent needs exactly one primary company assignment.',
    );
    if (a.departmentId) {
      const d = departments.get(a.departmentId);
      check(d, 'INVALID_REFERENCE', 'Agent department does not exist.');
      if (a.status === 'active')
        check(
          assigned.some((x) => x.companyId === d.companyId),
          'INVALID_REFERENCE',
          'Agent must be assigned to its department company.',
        );
    }
    if (a.managerId) {
      check(
        a.managerId !== a.id && agents.get(a.managerId)?.status === 'active',
        'INVALID_REFERENCE',
        'Manager must be a different active agent.',
      );
      const visited = new Set<string>([a.id]);
      let manager: string | null = a.managerId;
      while (manager) {
        check(!visited.has(manager), 'MANAGER_CYCLE', 'Reporting lines cannot contain cycles.');
        visited.add(manager);
        manager = agents.get(manager)?.managerId ?? null;
      }
    }
  }
  const activeRelations = state.relationships.filter((r) => r.endedAt === null);
  const relationPairs = new Set<string>();
  for (const r of state.relationships) {
    check(
      companies.has(r.fromCompanyId) && companies.has(r.toCompanyId),
      'INVALID_REFERENCE',
      'Relationship companies must exist.',
    );
    check(
      r.fromCompanyId !== r.toCompanyId,
      'SELF_RELATIONSHIP',
      'A company cannot have a relationship with itself.',
    );
    check(
      r.endedAt === null || Date.parse(r.endedAt) >= Date.parse(r.startedAt),
      'INVALID_INPUT',
      'Relationship end cannot precede its start.',
    );
    check(
      r.kind === 'ownership' ? isValidPercentage(r.percentage) : r.percentage === null,
      'INVALID_PERCENTAGE',
      'Ownership is unspecified or greater than 0 and at most 100%; collaboration has no percentage.',
    );
    if (r.endedAt !== null) continue;
    check(
      companies.get(r.fromCompanyId)?.status === 'active' &&
        companies.get(r.toCompanyId)?.status === 'active',
      'ARCHIVED_ENTITY',
      'Active relationships require active companies.',
    );
    const pair = `${r.kind}\0${r.fromCompanyId}\0${r.toCompanyId}`;
    check(
      !relationPairs.has(pair),
      'DUPLICATE_RELATIONSHIP',
      'This active relationship already exists.',
    );
    relationPairs.add(pair);
    if (r.kind === 'ownership') {
      const ownership = activeRelations.filter((x) => x.kind === 'ownership');
      check(
        !findActivePath(ownership, r.toCompanyId, r.fromCompanyId),
        'OWNERSHIP_CYCLE',
        'Ownership cannot contain a cycle.',
      );
      const total = ownership
        .filter((x) => x.toCompanyId === r.toCompanyId)
        .reduce((sum, x) => sum + (x.percentage ?? 0), 0);
      check(
        total <= 100 + 1e-9,
        'OWNERSHIP_EXCEEDED',
        'Specified incoming ownership cannot exceed 100%.',
      );
    }
  }
  const runs = new Set<string>();
  for (const w of state.work) {
    check(
      companies.has(w.companyId) && agents.has(w.agentId),
      'INVALID_REFERENCE',
      'Work participants must exist.',
    );
    if (w.runId) {
      check(
        !runs.has(w.runId),
        'DUPLICATE_RUN',
        'This runtime execution has already been recorded.',
      );
      runs.add(w.runId);
    }
  }
}

export function validateDefinition(value: unknown): CompanyDefinition {
  const v = object(value);
  check(
    v.schemaVersion === 1,
    'UNSUPPORTED_SCHEMA',
    'Only company definition schema version 1 is supported.',
  );
  knownKeys(
    v,
    [
      'schemaVersion',
      'name',
      'description',
      'companies',
      'departments',
      'agents',
      'assignments',
      'relationships',
    ],
    'Definition',
  );
  const name = text(v.name, 'Definition name');
  const description = text(v.description, 'Description', 5000, true);
  for (const key of ['companies', 'departments', 'agents', 'assignments', 'relationships'])
    check(
      Array.isArray(v[key]) && (v[key] as unknown[]).length <= 5000,
      'INVALID_INPUT',
      `Definition ${key} must be a list of at most 5,000 entries.`,
    );
  const allowedFields: Record<string, string[]> = {
    companies: [
      'id',
      'name',
      'shortCode',
      'description',
      'color',
      'status',
      'version',
      'createdAt',
      'updatedAt',
    ],
    departments: ['id', 'companyId', 'name', 'description', 'managerId'],
    agents: [
      'id',
      'name',
      'role',
      'kind',
      'instructions',
      'responsibilities',
      'departmentId',
      'managerId',
      'status',
      'version',
      'createdAt',
      'updatedAt',
    ],
    assignments: ['id', 'agentId', 'companyId', 'isPrimary', 'startedAt', 'endedAt'],
    relationships: [
      'id',
      'fromCompanyId',
      'toCompanyId',
      'kind',
      'percentage',
      'description',
      'startedAt',
      'endedAt',
    ],
  };
  for (const [key, fields] of Object.entries(allowedFields))
    for (const item of v[key] as unknown[]) knownKeys(object(item), fields, `Definition ${key}`);
  const state = emptyState();
  state.companies = (v.companies as unknown[]).map((raw) => {
    const c = object(raw);
    return {
      id: text(c.id, 'Company ID'),
      ...companyInput(c),
      status: status(c.status),
      version: version(c.version),
      createdAt: requiredDate(c.createdAt),
      updatedAt: requiredDate(c.updatedAt),
    };
  });
  state.agents = (v.agents as unknown[]).map((raw) => {
    const a = object(raw);
    return {
      id: text(a.id, 'Agent ID'),
      ...agentInput(a),
      status: status(a.status),
      version: version(a.version),
      createdAt: requiredDate(a.createdAt),
      updatedAt: requiredDate(a.updatedAt),
    };
  });
  state.departments = (v.departments as unknown[]).map((raw) => {
    const d = object(raw);
    return { id: text(d.id, 'Department ID'), ...departmentInput(d) };
  });
  state.assignments = (v.assignments as unknown[]).map((raw) => {
    const a = object(raw);
    check(
      typeof a.isPrimary === 'boolean',
      'INVALID_INPUT',
      'Assignment primary flag must be boolean.',
    );
    return {
      id: text(a.id, 'Assignment ID'),
      agentId: text(a.agentId, 'Agent reference'),
      companyId: text(a.companyId, 'Company reference'),
      isPrimary: a.isPrimary,
      startedAt: requiredDate(a.startedAt),
      endedAt: a.endedAt === null ? null : requiredDate(a.endedAt),
    };
  });
  state.relationships = (v.relationships as unknown[]).map((raw) => {
    const r = object(raw);
    check(
      r.kind === 'ownership' || r.kind === 'collaboration',
      'INVALID_INPUT',
      'Unsupported relationship kind.',
    );
    check(
      isValidPercentage(r.percentage),
      'INVALID_PERCENTAGE',
      'Invalid relationship percentage.',
    );
    return {
      id: text(r.id, 'Relationship ID'),
      fromCompanyId: text(r.fromCompanyId, 'Company reference'),
      toCompanyId: text(r.toCompanyId, 'Company reference'),
      kind: r.kind,
      percentage: r.percentage,
      description: text(r.description, 'Description', 5000, true),
      startedAt: requiredDate(r.startedAt),
      endedAt: r.endedAt === null ? null : requiredDate(r.endedAt),
    };
  });
  check(
    state.companies.length > 0,
    'INVALID_INPUT',
    'A company definition needs at least one company.',
  );
  validateState(state);
  return {
    schemaVersion: 1,
    name,
    description,
    companies: state.companies,
    departments: state.departments,
    agents: state.agents,
    assignments: state.assignments,
    relationships: state.relationships,
  };
}

function importDefinition(state: WorkspaceState, raw: unknown, now: string): string[] {
  const definition = validateDefinition(raw);
  const companyIds = new Map(definition.companies.map((x) => [x.id, randomUUID()]));
  const departmentIds = new Map(definition.departments.map((x) => [x.id, randomUUID()]));
  const agentIds = new Map(definition.agents.map((x) => [x.id, randomUUID()]));
  const codes = new Set(state.companies.map((c) => c.shortCode));
  for (const c of definition.companies) {
    let code = c.shortCode;
    let suffix = 2;
    while (codes.has(code)) {
      code = `${c.shortCode.slice(0, 18)}-${suffix++}`;
    }
    codes.add(code);
    state.companies.push({
      ...c,
      id: companyIds.get(c.id)!,
      shortCode: code,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
  state.departments.push(
    ...definition.departments.map((d) => ({
      ...d,
      id: departmentIds.get(d.id)!,
      companyId: companyIds.get(d.companyId)!,
      managerId: d.managerId ? agentIds.get(d.managerId)! : null,
    })),
  );
  state.agents.push(
    ...definition.agents.map((a) => ({
      ...a,
      id: agentIds.get(a.id)!,
      departmentId: a.departmentId ? departmentIds.get(a.departmentId)! : null,
      managerId: a.managerId ? agentIds.get(a.managerId)! : null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })),
  );
  state.assignments.push(
    ...definition.assignments.map((a) => ({
      ...a,
      id: randomUUID(),
      agentId: agentIds.get(a.agentId)!,
      companyId: companyIds.get(a.companyId)!,
    })),
  );
  state.relationships.push(
    ...definition.relationships.map((r) => ({
      ...r,
      id: randomUUID(),
      fromCompanyId: companyIds.get(r.fromCompanyId)!,
      toCompanyId: companyIds.get(r.toCompanyId)!,
    })),
  );
  return [
    `Import ${definition.name}: ${definition.companies.length} companies, ${definition.departments.length} departments, ${definition.agents.length} agents. New IDs are created; existing companies stay intact.`,
    ...definition.companies.map(
      (c) =>
        `Company ${c.name} — Short code: ${state.companies.find((x) => x.id === companyIds.get(c.id))!.shortCode}; Purpose: ${c.description || '(none)'}; Color: ${c.color}; Status: ${c.status}`,
    ),
    ...definition.departments.map(
      (d) =>
        `Department ${d.name} — Company: ${definition.companies.find((c) => c.id === d.companyId)!.name}; Purpose: ${d.description || '(none)'}; Lead: ${definition.agents.find((a) => a.id === d.managerId)?.name ?? '(none)'}`,
    ),
    ...definition.agents.map(
      (a) =>
        `Agent ${a.name} — Role: ${a.role}; Type: ${a.kind}; Status: ${a.status}; Companies: ${
          definition.assignments
            .filter((x) => x.agentId === a.id && x.endedAt === null)
            .map(
              (x) =>
                `${definition.companies.find((c) => c.id === x.companyId)!.name} (${x.isPrimary ? 'primary' : 'additional'})`,
            )
            .join(', ') || '(none)'
        }; Department: ${definition.departments.find((d) => d.id === a.departmentId)?.name ?? '(company level)'}; Manager: ${definition.agents.find((m) => m.id === a.managerId)?.name ?? '(none)'}; Responsibilities: ${valueLabel(a.responsibilities)}; Instructions: ${a.instructions || '(none)'}`,
    ),
    ...definition.assignments
      .filter((a) => a.endedAt !== null)
      .map(
        (a) =>
          `Historical assignment: ${definition.agents.find((x) => x.id === a.agentId)!.name} → ${definition.companies.find((c) => c.id === a.companyId)!.name}; ${a.startedAt} to ${a.endedAt}; ${a.isPrimary ? 'primary' : 'additional'}`,
      ),
    ...definition.relationships.map(
      (r) =>
        `${r.kind} — ${definition.companies.find((c) => c.id === r.fromCompanyId)!.name} → ${definition.companies.find((c) => c.id === r.toCompanyId)!.name}; Percentage: ${valueLabel(r.percentage)}; Description: ${r.description || '(none)'}; ${r.endedAt ? `Ended: ${r.endedAt}` : 'Active'}`,
    ),
  ];
}

export function executeCommands(
  current: WorkspaceState,
  commands: DomainCommand[],
  now = new Date().toISOString(),
): { state: WorkspaceState; changes: string[] } {
  check(
    Array.isArray(commands) && commands.length > 0 && commands.length <= 1000,
    'INVALID_INPUT',
    'Submit between 1 and 1,000 changes.',
  );
  check(
    JSON.stringify(commands).length <= 5_000_000,
    'INVALID_INPUT',
    'Changes exceed the 5 MB limit.',
  );
  const state = structuredClone(current);
  const changes: string[] = [];
  for (const raw of commands) {
    const v = object(raw);
    const command = raw as DomainCommand;
    switch (command.type) {
      case 'company.create': {
        const input = companyInput(command.input);
        state.companies.push({
          id: randomUUID(),
          ...input,
          status: 'active',
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
        changes.push(`Create company ${input.name}`, ...fieldChanges('Company', input));
        break;
      }
      case 'company.update': {
        const c = activeCompany(state, command.id);
        const input = companyInput({ ...c, ...object(command.input) });
        changes.push(`Update company ${c.name}`, ...fieldChanges('Company', input, { ...c }));
        Object.assign(c, input);
        touch(c, now);
        break;
      }
      case 'company.archive': {
        const c = activeCompany(state, command.id);
        c.status = 'archived';
        touch(c, now);
        for (const a of state.assignments)
          if (a.companyId === c.id && a.endedAt === null) a.endedAt = now;
        for (const a of state.agents.filter((a) => a.status === 'active')) {
          const remaining = state.assignments.filter(
            (x) => x.agentId === a.id && x.endedAt === null,
          );
          if (remaining.length === 0) archiveAgent(state, a, now);
          else if (!remaining.some((x) => x.isPrimary)) {
            const promoted = remaining[0]!;
            promoted.endedAt = now;
            state.assignments.push(assignment(a.id, promoted.companyId, true, now));
            touch(a, now);
          }
          if (
            a.departmentId &&
            state.departments.some((d) => d.id === a.departmentId && d.companyId === c.id)
          )
            a.departmentId = null;
        }
        for (const d of state.departments) if (d.companyId === c.id) d.managerId = null;
        for (const r of state.relationships)
          if ((r.fromCompanyId === c.id || r.toCompanyId === c.id) && r.endedAt === null)
            r.endedAt = now;
        changes.push(
          `Archive ${c.name}; close assignments and relationships, archive agents with no remaining company`,
        );
        break;
      }
      case 'company.restore': {
        const c = find(state.companies, command.id, 'Company');
        check(c.status === 'archived', 'INVALID_STATE', 'Company is already active.');
        c.status = 'active';
        touch(c, now);
        changes.push(`Restore company ${c.name}; historical assignments stay closed`);
        break;
      }
      case 'department.create': {
        const input = departmentInput(command.input);
        activeCompany(state, input.companyId);
        state.departments.push({ id: randomUUID(), ...input });
        changes.push(
          `Create department ${input.name}`,
          ...fieldChanges('Department', input, undefined, state),
        );
        break;
      }
      case 'department.update': {
        const d = find(state.departments, command.id, 'Department');
        activeCompany(state, d.companyId);
        const input = departmentInput({ ...d, ...object(command.input), companyId: d.companyId });
        changes.push(
          `Update department ${d.name}`,
          ...fieldChanges('Department', input, { ...d }, state),
        );
        Object.assign(d, input);
        break;
      }
      case 'agent.create': {
        const company = activeCompany(state, command.companyId);
        const input = agentInput(command.input);
        const id = randomUUID();
        state.agents.push({
          id,
          ...input,
          status: 'active',
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
        state.assignments.push(assignment(id, command.companyId, true, now));
        changes.push(
          `Create ${input.kind} ${input.name} in ${company.name}`,
          ...fieldChanges('Agent', input, undefined, state),
        );
        break;
      }
      case 'agent.update': {
        const a = activeAgent(state, command.id);
        const input = agentInput({ ...a, ...object(command.input), kind: a.kind });
        changes.push(`Update agent ${a.name}`, ...fieldChanges('Agent', input, { ...a }, state));
        Object.assign(a, input);
        touch(a, now);
        break;
      }
      case 'agent.archive': {
        const a = activeAgent(state, command.id);
        archiveAgent(state, a, now);
        changes.push(`Archive ${a.name}; close assignments and clear reporting references`);
        break;
      }
      case 'agent.restore': {
        const a = find(state.agents, command.id, 'Agent');
        check(a.status === 'archived', 'INVALID_STATE', 'Agent is already active.');
        activeCompany(state, command.companyId);
        a.status = 'active';
        a.departmentId = null;
        a.managerId = null;
        touch(a, now);
        state.assignments.push(assignment(a.id, command.companyId, true, now));
        changes.push(`Restore ${a.name} with a new primary assignment`);
        break;
      }
      case 'assignment.add': {
        const a = activeAgent(state, command.agentId);
        const c = activeCompany(state, command.companyId);
        state.assignments.push(assignment(command.agentId, command.companyId, false, now));
        changes.push(`Add additional company assignment: ${a.name} → ${c.name}`);
        break;
      }
      case 'assignment.primary': {
        const a = activeAgent(state, command.agentId);
        activeCompany(state, command.companyId);
        const previous = state.assignments.filter((x) => x.agentId === a.id && x.endedAt === null);
        check(
          !previous.some((x) => x.companyId === command.companyId && x.isPrimary),
          'INVALID_STATE',
          'This company is already the primary assignment.',
        );
        for (const x of previous)
          if (x.isPrimary || x.companyId === command.companyId) {
            x.endedAt = now;
            if (x.companyId !== command.companyId)
              state.assignments.push(assignment(a.id, x.companyId, false, now));
          }
        state.assignments.push(assignment(a.id, command.companyId, true, now));
        touch(a, now);
        changes.push(
          `Change primary company for ${a.name} → ${state.companies.find((c) => c.id === command.companyId)!.name}; previous primary company is retained as an additional assignment`,
        );
        break;
      }
      case 'assignment.end': {
        const a = find(state.assignments, command.id, 'Assignment');
        check(a.endedAt === null, 'INVALID_STATE', 'Assignment is already ended.');
        check(
          !a.isPrimary,
          'PRIMARY_REQUIRED',
          'Choose a different primary company before ending this assignment.',
        );
        a.endedAt = now;
        changes.push(
          `End additional assignment: ${state.agents.find((x) => x.id === a.agentId)!.name} → ${state.companies.find((c) => c.id === a.companyId)!.name}`,
        );
        break;
      }
      case 'relationship.create': {
        const input = object(command.input);
        const fromCompanyId = text(input.fromCompanyId, 'Company reference');
        const toCompanyId = text(input.toCompanyId, 'Company reference');
        activeCompany(state, fromCompanyId);
        activeCompany(state, toCompanyId);
        check(
          input.kind === 'ownership' || input.kind === 'collaboration',
          'INVALID_INPUT',
          'Unsupported relationship kind.',
        );
        check(
          isValidPercentage(input.percentage),
          'INVALID_PERCENTAGE',
          'Ownership percentage must be unspecified or in (0, 100].',
        );
        const description = text(input.description, 'Description', 5000, true);
        state.relationships.push({
          id: randomUUID(),
          fromCompanyId,
          toCompanyId,
          kind: input.kind,
          percentage: input.percentage,
          description,
          startedAt: now,
          endedAt: null,
        });
        changes.push(
          `Create ${input.kind}: ${state.companies.find((c) => c.id === fromCompanyId)!.name} → ${state.companies.find((c) => c.id === toCompanyId)!.name}; Percentage: ${valueLabel(input.percentage)}; Description: ${description || '(none)'}`,
        );
        break;
      }
      case 'relationship.end': {
        const r = find(state.relationships, command.id, 'Relationship');
        check(r.endedAt === null, 'INVALID_STATE', 'Relationship already ended.');
        r.endedAt = now;
        changes.push(`End ${r.kind} relationship`);
        break;
      }
      case 'definition.import':
        changes.push(...importDefinition(state, command.definition, now));
        break;
      case 'work.record': {
        const w = object(command.input);
        const companyId = text(w.companyId, 'Company reference');
        const agentId = text(w.agentId, 'Agent reference');
        find(state.companies, companyId, 'Company');
        find(state.agents, agentId, 'Agent');
        check(
          state.assignments.some((a) => a.agentId === agentId && a.companyId === companyId),
          'INVALID_REFERENCE',
          'Work must belong to a company where this agent has held an assignment.',
        );
        check(
          ['manual', 'codex', 'buzz', 'slack'].includes(String(w.provenance)),
          'INVALID_INPUT',
          'Work provenance is not supported.',
        );
        check(
          ['submitted', 'accepted', 'failed'].includes(String(w.status)),
          'INVALID_INPUT',
          'Work status is not supported.',
        );
        check(
          w.durationMs === null ||
            (Number.isSafeInteger(w.durationMs) && Number(w.durationMs) >= 0),
          'INVALID_INPUT',
          'Duration must be null or a nonnegative integer.',
        );
        const row: WorkRecord = {
          id: randomUUID(),
          companyId,
          agentId,
          title: text(w.title, 'Work title'),
          output: text(w.output, 'Work output', 1_000_000),
          provenance: w.provenance as WorkRecord['provenance'],
          status: w.status as WorkRecord['status'],
          createdAt: now,
          durationMs: w.durationMs as number | null,
          runId: nullableId(w.runId),
        };
        state.work.push(row);
        changes.push(`Record ${row.provenance} work: ${row.title}`);
        break;
      }
      case 'work.accept': {
        const w = find(state.work, command.id, 'Work record');
        check(w.status === 'submitted', 'INVALID_STATE', 'Only submitted work can be accepted.');
        w.status = 'accepted';
        changes.push(`Accept work: ${w.title}`);
        break;
      }
      default:
        throw new DomainError(
          'UNKNOWN_COMMAND',
          `Unsupported command type: ${String(v.type).slice(0, 80)}`,
        );
    }
  }
  validateState(state);
  return { state, changes };
}
