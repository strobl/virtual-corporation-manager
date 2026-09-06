import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Agent, Relationship, WorkspaceState } from '../src/domain/contracts';
import type { TimeEntry, TimeSnapshot } from '../src/time/contracts';
import type { IntegrationStatus, RunInfo } from '../src/web/Work';
import { CompanyConsole } from '../src/web/CompanyConsole';
import {
  companyRelationships,
  consoleDepartmentLabel,
  consoleRuntime,
  createCompanyConsoleModel,
  filterConsoleMembers,
} from '../src/web/company-console-model';

const at = '2026-09-06T08:00:00Z';
function agent(id: string, patch: Partial<Agent> = {}): Agent {
  return {
    id,
    name: id,
    kind: 'agent',
    role: 'Analyst',
    instructions: '',
    responsibilities: [],
    managerId: null,
    departmentId: null,
    status: 'active',
    version: 1,
    createdAt: at,
    updatedAt: at,
    ...patch,
  };
}
function workspace(): WorkspaceState {
  return {
    schemaVersion: 3,
    revision: 1,
    companies: ['a', 'b', 'c'].map((id) => ({
      id,
      name: `${id.toUpperCase()} Studio`,
      shortCode: id.toUpperCase(),
      description: `${id} purpose`,
      color: '#cbb85e',
      status: 'active',
      version: 1,
      createdAt: at,
      updatedAt: at,
    })),
    agents: [
      agent('shared', { name: 'Alex', departmentId: 'department-b', managerId: 'owner' }),
      agent('owner', { name: 'Alex', kind: 'human', responsibilities: ['Company strategy'] }),
      agent('local', { managerId: 'owner', responsibilities: ['Customer research'] }),
      agent('archived', { status: 'archived' }),
    ],
    assignments: [
      {
        id: 'shared-a',
        agentId: 'shared',
        companyId: 'a',
        isPrimary: false,
        startedAt: at,
        endedAt: null,
      },
      {
        id: 'shared-b',
        agentId: 'shared',
        companyId: 'b',
        isPrimary: true,
        startedAt: at,
        endedAt: null,
      },
      {
        id: 'owner-a',
        agentId: 'owner',
        companyId: 'a',
        isPrimary: true,
        startedAt: at,
        endedAt: null,
      },
      {
        id: 'local-a',
        agentId: 'local',
        companyId: 'a',
        isPrimary: true,
        startedAt: at,
        endedAt: null,
      },
      {
        id: 'archived-a',
        agentId: 'archived',
        companyId: 'a',
        isPrimary: true,
        startedAt: at,
        endedAt: null,
      },
    ],
    departments: [
      { id: 'department-a', companyId: 'a', name: 'Strategy', description: '', managerId: 'owner' },
      { id: 'department-b', companyId: 'b', name: 'Research', description: '', managerId: null },
    ],
    relationships: [],
    work: [],
    history: [],
  };
}
function entry(id: string, patch: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id,
    companyId: 'a',
    agentId: 'local',
    companyName: 'A Studio',
    agentName: 'local',
    date: '2026-09-05',
    tenths: 80,
    description: 'Research',
    clientProject: '',
    basis: {
      kind: 'fallback',
      requestedDeliverable: 'Research',
      catalogCode: null,
      catalogName: null,
      catalogVersion: null,
      referenceTenths: 80,
      quantity: 1,
    },
    source: 'agent',
    status: 'booked',
    voidReason: null,
    workId: null,
    runId: null,
    version: 1,
    createdAt: at,
    updatedAt: at,
    ...patch,
  };
}
function time(entries: TimeEntry[]): TimeSnapshot {
  return {
    revision: 1,
    timezone: 'Europe/Berlin',
    today: '2026-09-06',
    entries,
    catalog: [],
    history: [],
  };
}
const model = (state = workspace(), selected: string | null = null) =>
  createCompanyConsoleModel(state, 'a', selected, null, null, []);

describe('company console identity and organization', () => {
  it('keeps humans and agents by exact active company assignment even when names match', () => {
    const state = workspace();
    const before = JSON.stringify(state);
    const view = model(state, 'shared');
    expect(view.members.map((row) => row.id).sort()).toEqual(['local', 'owner', 'shared']);
    expect(view.counts).toEqual({ agents: 2, humans: 1, departments: 1 });
    expect(view.selected?.id).toBe('shared');
    expect(view.localManager?.id).toBe('owner');
    expect(view.assignments.map((row) => row.company.id)).toEqual(['a', 'b']);
    expect(view.taskCompany?.id).toBe('b');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('never resolves an inspector through another company or an ended assignment', () => {
    const state = workspace();
    state.assignments[0].endedAt = at;
    expect(model(state, 'shared').selected).toBeNull();
    expect(model(state, 'archived').selected).toBeNull();
    expect(createCompanyConsoleModel(state, 'missing', 'local', null, null, []).members).toEqual(
      [],
    );
    state.companies[0].status = 'archived';
    expect(model(state, 'local').selected).toBeNull();
  });

  it('preserves a shared member department context and an external manager identity', () => {
    const state = workspace();
    expect(consoleDepartmentLabel(state, state.agents[0], 'a')).toBe('Research · B Studio');
    expect(consoleDepartmentLabel(state, state.agents[0], 'b')).toBe('Research');
    state.assignments[2].endedAt = at;
    expect(model(state, 'shared').manager?.id).toBe('owner');
    expect(model(state, 'shared').localManager).toBeNull();
  });

  it('searches responsibilities and readable roles while preserving distinct member IDs', () => {
    const state = workspace();
    expect(filterConsoleMembers(state.agents, 'customer research').map((row) => row.id)).toEqual([
      'local',
    ]);
    expect(filterConsoleMembers(state.agents, 'Alex').map((row) => row.id)).toEqual([
      'shared',
      'owner',
    ]);
    expect(filterConsoleMembers(state.agents, 'Alex', 'human').map((row) => row.id)).toEqual([
      'owner',
    ]);
    expect(
      filterConsoleMembers(
        [agent('reviewer', { role: 'ao.role.quality-reviewer' })],
        'Quality Reviewer',
      ),
    ).toHaveLength(1);
  });

  it('keeps reporting lines within the company and renders each member once even with a cycle', () => {
    const state = workspace();
    state.agents[1].managerId = 'local';
    const rows = model(state).reportingRows;
    expect(rows.map(({ person }) => person.id).sort()).toEqual(['local', 'owner', 'shared']);
    expect(new Set(rows.map(({ person }) => person.id)).size).toBe(3);
  });
});

describe('company relationships', () => {
  it('separates ownership direction and collaboration, preserving null and zero percentages', () => {
    const state = workspace();
    const relationship = (id: string, patch: Partial<Relationship> = {}): Relationship => ({
      id,
      fromCompanyId: 'a',
      toCompanyId: 'b',
      kind: 'ownership',
      percentage: 42.125,
      description: '',
      startedAt: at,
      endedAt: null,
      ...patch,
    });
    state.relationships = [
      relationship('out'),
      relationship('in', { fromCompanyId: 'c', toCompanyId: 'a', percentage: null }),
      relationship('zero', { toCompanyId: 'c', percentage: 0 }),
      relationship('collab', { kind: 'collaboration', percentage: null }),
      relationship('ended', { endedAt: at }),
      relationship('unrelated', { fromCompanyId: 'b', toCompanyId: 'c' }),
    ];
    const links = companyRelationships(state, 'a');
    expect(links.ownedBy.map((row) => [row.company.id, row.percentage])).toEqual([
      ['c', 'Not specified'],
    ]);
    expect(links.owns.map((row) => [row.company.id, row.percentage])).toEqual([
      ['b', '42.125%'],
      ['c', '0%'],
    ]);
    expect(links.collaborates.map((row) => row.relationship.id)).toEqual(['collab']);
    state.companies[1].status = 'archived';
    expect(companyRelationships(state, 'a').owns.map((row) => row.company.id)).toEqual(['c']);
  });
});

describe('truthful activity and time', () => {
  it('uses booked company delivery hours for the current week and suppresses stale totals on error', () => {
    const ledger = time([
      entry('booked'),
      entry('void', { status: 'void', tenths: 200 }),
      entry('elsewhere', { companyId: 'b', tenths: 300 }),
      entry('old', { date: '2026-08-30' }),
      entry('future', { date: '2026-09-07' }),
    ]);
    const view = createCompanyConsoleModel(workspace(), 'a', null, ledger, null, []);
    expect(view.hours).toMatchObject({ tenths: 80, count: 1 });
    expect(view.from).toBe('2026-08-31');
    expect(view.through).toBe('2026-09-06');
    expect(
      createCompanyConsoleModel(workspace(), 'a', null, ledger, 'Offline', []).hours,
    ).toBeNull();
    expect(model().hours).toBeNull();
  });

  it('does not infer active work from configured members, finished runs or another company', () => {
    const runs = [
      { agentId: 'shared', companyId: 'b', status: 'running' },
      { agentId: 'shared', companyId: 'a', status: 'completed' },
    ] as RunInfo[];
    expect(createCompanyConsoleModel(workspace(), 'a', 'shared', null, null, runs).activity).toBe(
      'No active task in this company',
    );
    runs.push({ agentId: 'shared', companyId: 'a', status: 'running' } as RunInfo);
    expect(createCompanyConsoleModel(workspace(), 'a', 'shared', null, null, runs).activity).toBe(
      '1 task running',
    );
  });

  it('requires actual runtime readiness', () => {
    expect(consoleRuntime(null).ready).toBe(false);
    const status = {
      codex: { state: 'unauthenticated' },
      buzz: { available: true, state: 'unconfigured' },
    } as IntegrationStatus;
    expect(consoleRuntime(status).ready).toBe(false);
    status.buzz.state = 'configured';
    expect(consoleRuntime(status)).toEqual({ ready: true, label: 'Buzz connected' });
  });
});

describe('company console presentation', () => {
  it('keeps the company visible while inspecting a shared member and leaves time logging accessible', () => {
    const noop = vi.fn();
    const state = workspace();
    state.agents.find((row) => row.id === 'local')!.departmentId = 'department-a';
    state.relationships = [
      {
        id: 'parent',
        fromCompanyId: 'b',
        toCompanyId: 'a',
        kind: 'ownership',
        percentage: null,
        description: '',
        startedAt: at,
        endedAt: null,
      },
      {
        id: 'child',
        fromCompanyId: 'a',
        toCompanyId: 'c',
        kind: 'ownership',
        percentage: 42.125,
        description: '',
        startedAt: at,
        endedAt: null,
      },
    ];
    const html = renderToStaticMarkup(
      createElement(CompanyConsole, {
        state,
        companyId: 'a',
        selectedMemberId: 'shared',
        time: time([entry('one')]),
        timeError: null,
        runs: [],
        status: null,
        onSelectMember: noop,
        onEditCompany: noop,
        onAddMember: noop,
        onEditMember: noop,
        onManageAssignments: noop,
        onAddDepartment: noop,
        onEditDepartment: noop,
        onRelationships: noop,
        onOpenCompany: noop,
        onRunAgent: noop,
        onLogTime: noop,
        onViewTime: noop,
        onRecordWork: noop,
        onOpenWork: noop,
        onIntegrations: noop,
      }),
    );
    expect(html).toContain('id="console-company-name">A Studio</h1>');
    expect(html).toContain('aria-label="Alex member details"');
    expect(html).toContain('Tasks for this member run in');
    expect(html).not.toContain('>Give a task');
    expect(html).not.toContain('<textarea');
    expect(html).toContain('Time Tracker');
    expect(html).toContain('Log time');
    expect(html).toContain('8.0h');
    const ownership = html.match(
      /aria-label="Company ownership at a glance">([\s\S]*?)<\/div>/,
    )?.[1];
    expect(ownership).toContain('Owned by');
    expect(ownership).toContain('B Studio');
    expect(ownership).toContain('Not specified');
    expect(ownership).toContain('Owns 1 company');
    expect(html.indexOf('Company ownership at a glance')).toBeLessThan(html.indexOf('<table'));
    expect(html).toContain('42.125%');
    expect(html).toContain('1 member · Led by Alex');
    expect(html).not.toContain('1 members');
    expect(noop).not.toHaveBeenCalled();
  });
});
