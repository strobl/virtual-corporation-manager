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
} from '../src/web/model';
import { buildOrgPyramid } from '../src/lib/organization/org-pyramid';
import { CorporationOrgChart } from '../src/components/organization/CorporationOrgChart';

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
  });
});
