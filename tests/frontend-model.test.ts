import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WorkspaceState } from '../src/domain/contracts';
import {
  organizationTree,
  toSnapshot,
  companyForSelection,
  companyAgents,
  parseSelection,
  selectionKey,
  selectedTreeRows,
  roleLabel,
  agentInitials,
} from '../src/web/model';
import { buildOrgPyramid } from '../src/lib/organization/org-pyramid';
import { CorporationOrgChart } from '../src/components/organization/CorporationOrgChart';
import { AgentPlacement } from '../src/web/AgentPlacement';
import { EntityEditor } from '../src/web/Dialogs';
import { agentContextOptions, filterAgentOptions } from '../src/web/agent-context';

function companyOf100(): WorkspaceState {
  const createdAt = '2026-09-04T12:00:00Z';
  return {
    schemaVersion: 1,
    revision: 8,
    companies: [
      {
        id: 'company',
        name: 'Example Studio',
        shortCode: 'EX',
        description: 'Test organization',
        color: '#d4b62e',
        status: 'active',
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    departments: Array.from({ length: 10 }, (_, i) => ({
      id: `dept-${i}`,
      companyId: 'company',
      name: `Department ${i}`,
      description: `Responsibility ${i}`,
      managerId: `agent-${i * 10}`,
    })),
    agents: Array.from({ length: 100 }, (_, i) => ({
      id: `agent-${i}`,
      name: `Agent ${i}`,
      role: i === 99 ? 'Release verification' : `Role ${i}`,
      kind: 'agent' as const,
      instructions: '',
      responsibilities: [i === 99 ? 'Verify the packed artifact' : 'Complete assigned work'],
      departmentId: `dept-${Math.floor(i / 10)}`,
      managerId: i % 10 === 0 ? null : `agent-${Math.floor(i / 10) * 10}`,
      status: 'active' as const,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    })),
    assignments: Array.from({ length: 100 }, (_, i) => ({
      id: `assignment-${i}`,
      agentId: `agent-${i}`,
      companyId: 'company',
      isPrimary: true,
      startedAt: createdAt,
      endedAt: null,
    })),
    relationships: [],
    work: [],
    history: [],
  };
}

describe('local frontend organization adapter', () => {
  it('presents operational roles without changing stored workflow keys', () => {
    const state = companyOf100();
    state.agents[0]!.role = 'ao.role.delivery-manager';
    expect(toSnapshot(state).members[0]!.role).toBe('Delivery Manager');
    expect(state.agents[0]!.role).toBe('ao.role.delivery-manager');
    expect(roleLabel('ao.role.customer-success')).toBe('Customer Success');
    expect(roleLabel('Principal UX Designer')).toBe('Principal UX Designer');
    expect(organizationTree(state, 'Delivery Manager')[0]?.children?.[0]?.children?.[0]?.id).toBe(
      'company:company/agent:agent-0',
    );
  });

  it('gives the five Product Studio seats distinct initials without altering ordinary names', () => {
    expect(
      [
        'PS-DM · Delivery Manager',
        'PS-REQ · Requirements Analyst',
        'PS-BUILD · Software Builder',
        'PS-QA · Quality Reviewer',
        'PS-DOC · Handoff Editor',
      ].map(agentInitials),
    ).toEqual(['DM', 'RA', 'SB', 'QR', 'HE']);
    expect(agentInitials(' Zoë Müller ')).toBe('ZM');
    expect(agentInitials('A')).toBe('A');
    expect(agentInitials('')).toBe('');
  });
  it('preserves all 100 agents and their department and reporting identities', () => {
    const state = companyOf100();
    const snapshot = toSnapshot(state);
    expect(snapshot.members).toHaveLength(100);
    expect(snapshot.members.find((row) => row.id === 'agent-99')).toMatchObject({
      department: 'Department 9',
      managerId: 'agent-90',
      kind: 'agent',
    });
    const pyramid = buildOrgPyramid(snapshot, 'company');
    expect(pyramid.counts).toMatchObject({
      agents: 100,
      departments: 10,
      depth: 2,
    });
    expect(pyramid.byId.get('agent-99')?.chain).toEqual(['agent-90']);
  });

  it('keeps the company and explicit department context when searching an agent responsibility', () => {
    const tree = organizationTree(companyOf100(), 'packed artifact');
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('company:company');
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children?.[0]).toMatchObject({
      id: 'department:dept-9',
      children: [{ id: 'company:company/agent:agent-99' }],
    });
  });

  it('never substitutes an archived or ended assignment into configured company counts', () => {
    const state = companyOf100();
    state.agents[0]!.status = 'archived';
    state.assignments[1]!.endedAt = '2026-09-04T13:00:00Z';
    expect(companyAgents(state, 'company')).toHaveLength(98);
    expect(toSnapshot(state).members.some((row) => row.id === 'agent-0')).toBe(false);
    expect(toSnapshot(state).assignments.some((row) => row.teamMemberId === 'agent-1')).toBe(false);
  });

  it('resolves company context from stable department and agent IDs', () => {
    const state = companyOf100();
    expect(companyForSelection(state, { kind: 'department', id: 'dept-9' })).toBe('company');
    expect(companyForSelection(state, { kind: 'agent', id: 'agent-99' })).toBe('company');
  });

  it('shows a shared agent at company level when its department belongs elsewhere', () => {
    const state = companyOf100();
    state.companies.push({
      ...state.companies[0]!,
      id: 'second',
      name: 'Second Company',
      shortCode: 'SECOND',
    });
    state.assignments.push({
      id: 'shared',
      agentId: 'agent-99',
      companyId: 'second',
      isPrimary: false,
      startedAt: '2026-09-04T12:00:00Z',
      endedAt: null,
    });
    const second = organizationTree(state).find((row) => row.id === 'company:second');
    expect(second?.children).toMatchObject([
      { id: 'company:second/agent:agent-99', label: 'Agent 99' },
    ]);
    const selection = parseSelection(second!.children![0]!.id)!;
    expect(companyForSelection(state, selection)).toBe('second');
    expect(parseSelection(selectionKey(selection))).toEqual(selection);
    expect(selectedTreeRows(organizationTree(state), selection)).toEqual([
      'company:second/agent:agent-99',
    ]);
  });

  it('renders reused reporting levels with shared selection and no historical write surface', () => {
    const html = renderToStaticMarkup(
      createElement(CorporationOrgChart, {
        snapshot: toSnapshot(companyOf100()),
        corporationId: 'company',
        corporationName: 'Example Studio',
        selection: 'agent-99',
        onSelectAgent: () => {},
      }),
    );
    expect(html).toContain('data-testid="org-person-agent-99"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-testid="org-level-1"');
    expect(html).not.toContain('org-person-editor');
    expect(html).not.toContain('Credits');
    expect(html).toContain('Reporting level 0');
    expect(html).toContain('Reporting level 1');
    expect(html).not.toContain('Department heads');
    expect(html).not.toContain('Team leads');
    expect(html).not.toContain('Company lead');
  });

  it('distinguishes globally available same-name managers by company code without changing IDs', () => {
    const state = companyOf100();
    state.companies[0].name = 'Product Studio';
    state.companies[0].shortCode = 'STUDIO';
    state.companies.push({ ...state.companies[0], id: 'second', shortCode: 'STUDIO-2' });
    state.departments.push({
      ...state.departments[0],
      id: 'second-department',
      companyId: 'second',
      managerId: 'second-manager',
    });
    const manager = { ...state.agents[0], id: 'second-manager', departmentId: 'second-department' };
    state.agents.push(manager);
    state.assignments.push({
      ...state.assignments[0],
      id: 'second-assignment',
      agentId: manager.id,
      companyId: 'second',
    });
    const before = structuredClone(state);
    const options = agentContextOptions(state, [state.agents[0], manager]);
    expect(options.map((row) => row.id)).toEqual(['agent-0', 'second-manager']);
    expect(options[0].label).toContain('Product Studio (STUDIO)');
    expect(options[1].label).toContain('Product Studio (STUDIO-2)');
    expect(options[1].label).toContain('Department 0');
    expect(new Set(options.map((row) => row.label)).size).toBe(2);
    expect(state).toEqual(before);
  });

  it('keeps exact identities distinguishable even when name, role, company and department all match', () => {
    const state = companyOf100();
    const duplicate = { ...state.agents[0], id: 'agent-0-duplicate' };
    state.agents.push(duplicate);
    state.assignments.push({
      ...state.assignments[0],
      id: 'duplicate-assignment',
      agentId: duplicate.id,
    });
    const options = agentContextOptions(state, [state.agents[0], duplicate]);
    expect(new Set(options.map((row) => row.label)).size).toBe(2);
    expect(options[0].label).toContain('ID agent-0');
    expect(options[1].label).toContain('ID agent-0-duplicate');
    expect(options.map((row) => row.id)).toEqual(['agent-0', 'agent-0-duplicate']);
  });

  it('finds a manager among 100 agents by role, company and department while retaining an unmatched current selection', () => {
    const state = companyOf100();
    state.agents[99].name = 'Zoë Müller';
    const options = agentContextOptions(state, state.agents);
    expect(options).toHaveLength(100);
    expect(filterAgentOptions(options, 'release department 9 EX').map((row) => row.id)).toEqual([
      'agent-99',
    ]);
    expect(filterAgentOptions(options, 'zoe muller').map((row) => row.id)).toEqual(['agent-99']);
    expect(filterAgentOptions(options, 'missing query')).toEqual([]);
    expect(filterAgentOptions(options, 'missing query', 'agent-2').map((row) => row.id)).toEqual([
      'agent-2',
    ]);
    expect(filterAgentOptions(options, '')).toEqual(options);
  });

  it('shows selected company placement and truthful external reporting context without duplicating instructions', () => {
    const state = companyOf100();
    state.companies.push({
      ...state.companies[0],
      id: 'second',
      name: 'Second Company',
      shortCode: 'SECOND',
    });
    state.assignments.push({
      ...state.assignments[99],
      id: 'shared-assignment',
      companyId: 'second',
      isPrimary: false,
    });
    state.agents[99].instructions = 'A long operational document that belongs below placement.';
    const html = renderToStaticMarkup(
      createElement(AgentPlacement, {
        state,
        agent: state.agents[99],
        companyId: 'second',
        onAssignments: () => {},
      }),
    );
    expect(html).toContain('Second Company (SECOND)');
    expect(html).toContain('Department 9');
    expect(html).toContain('Example Studio (EX)');
    expect(html).toContain('Agent 90');
    expect(html).toContain('Reports outside this corporation.');
    expect(html).toContain('Also assigned to');
    expect(html).not.toContain(state.agents[99].instructions);
  });

  it('keeps 100 real manager options and a search input in Create agent without making company-local restrictions', () => {
    const html = renderToStaticMarkup(
      createElement(EntityEditor, {
        state: companyOf100(),
        target: { kind: 'agent', companyId: 'company' },
        busy: false,
        error: null,
        onClose: () => {},
        onSubmit: async () => {},
      }),
    );
    expect(html).toContain('Find a manager');
    expect(html).toContain('Name, role, company or department');
    expect(html).toContain('Example Studio (EX)');
    expect(html.match(/<option value="agent-/g) ?? []).toHaveLength(100);
    expect(html).toContain('The reporting line applies across this agent’s company assignments.');
  });

  it('edits valid 1- and 24-character company codes using a browser-valid pattern', () => {
    for (const shortCode of ['X', 'X'.repeat(24)]) {
      const state = companyOf100();
      state.companies[0].shortCode = shortCode;
      const html = renderToStaticMarkup(
        createElement(EntityEditor, {
          state,
          target: { kind: 'company', id: 'company' },
          busy: false,
          error: null,
          onClose: () => {},
          onSubmit: async () => {},
        }),
      );
      expect(html).toContain('minLength="1"');
      expect(html).toContain('maxLength="24"');
      const pattern = html.match(/pattern="([^"]+)"/)![1];
      expect(new RegExp(`^(?:${pattern})$`, 'v').test(shortCode)).toBe(true);
      expect(new RegExp(`^(?:${pattern})$`, 'v').test('X'.repeat(25))).toBe(false);
      expect(new RegExp(`^(?:${pattern})$`, 'v').test('A-B_2')).toBe(true);
    }
  });
});
