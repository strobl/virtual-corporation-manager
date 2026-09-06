import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Agent, WorkspaceState } from '../src/domain/contracts';
import { emptyState, executeCommands } from '../src/domain/model';
import { EntityEditor, PreviewDialog, type EditorTarget } from '../src/web/Dialogs';

function teamState(kind: Agent['kind'] = 'human'): WorkspaceState {
  const now = '2026-09-06T12:00:00.000Z';
  const member: Agent = {
    id: 'member',
    name: 'Alex Morgan',
    role: 'Operations lead',
    kind,
    instructions: 'Coordinate company operations.',
    responsibilities: ['Review budgets', 'Maintain supplier relationships'],
    departmentId: 'operations',
    managerId: 'manager',
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...emptyState(),
    companies: [
      {
        id: 'company',
        name: 'Northstar Studio',
        shortCode: 'NORTHSTAR',
        description: 'A test company',
        color: '#256c5b',
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    agents: [
      member,
      {
        ...member,
        id: 'manager',
        name: 'Sam Taylor',
        role: 'Founder',
        managerId: null,
      },
    ],
    departments: [
      {
        id: 'operations',
        companyId: 'company',
        name: 'Operations',
        description: '',
        managerId: 'manager',
      },
    ],
    assignments: ['member', 'manager'].map((agentId) => ({
      id: `${agentId}-assignment`,
      agentId,
      companyId: 'company',
      isPrimary: true,
      startedAt: now,
      endedAt: null,
    })),
  };
}

function renderMember(target: EditorTarget, state = teamState()) {
  return renderToStaticMarkup(
    createElement(EntityEditor, {
      target,
      state,
      busy: false,
      error: null,
      onClose: () => {},
      onSubmit: async () => {},
    }),
  );
}

describe('team member editor', () => {
  it('keeps required identity and member choice visible while optional organization details are closed', () => {
    const html = renderMember({ kind: 'agent', companyId: 'company' });
    const visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
    expect(visible).toMatch(/<label>Name<input\b[^>]*required=""/);
    expect(visible).toMatch(/<label>Role<input\b[^>]*required=""/);
    expect(visible).toMatch(/<label>Member type<select\b/);
    expect(visible).toMatch(/<option value="agent" selected="">/);
    expect(visible).toMatch(/<option value="human">/);
    expect(visible).not.toMatch(/<textarea\b|type="search"/);
    const optionalGroups = html.match(/<details\b[\s\S]*?<\/details>/g) ?? [];
    expect(optionalGroups).toHaveLength(2);
    for (const group of optionalGroups) {
      expect(group.match(/<details\b[^>]*>/)?.[0]).not.toContain('open');
      expect(group).not.toContain('required=');
    }
  });

  it.each(['human', 'agent'] as const)(
    'keeps an existing %s member type fixed while allowing identity changes',
    (kind) => {
      const html = renderMember(
        { kind: 'agent', id: 'member', companyId: 'company' },
        teamState(kind),
      );
      expect(html).toContain(kind === 'human' ? 'Human teammate' : 'AI agent');
      expect(html).not.toContain('<option value="agent"');
      expect(html).not.toContain('<option value="human"');
      const identityFields = html.match(/<input\b[^>]*required=""[^>]*>/g) ?? [];
      expect(identityFields).toHaveLength(2);
      expect(identityFields[0]).toContain('value="Alex Morgan"');
      expect(identityFields[1]).toContain('value="Operations lead"');
      expect(identityFields.every((field) => !/disabled|readonly/i.test(field))).toBe(true);
    },
  );

  it('retains a human’s saved context, responsibilities, department and manager inside optional controls', () => {
    const html = renderMember({ kind: 'agent', id: 'member', companyId: 'company' });
    const optional = (html.match(/<details\b[\s\S]*?<\/details>/g) ?? []).join('');
    expect(optional).toMatch(/<label>Working context<textarea\b/);
    expect(optional).toContain('Coordinate company operations.</textarea>');
    expect(optional).toContain('Review budgets\nMaintain supplier relationships</textarea>');
    expect(optional).toMatch(/<option value="operations" selected="">Operations<\/option>/);
    expect(optional).toMatch(/<option value="manager" selected="">Sam Taylor/);
    expect(optional).not.toMatch(/<option value="member"/);
  });
});

describe('readable management review', () => {
  it.each(['human', 'agent'] as const)(
    'shows the exact changed management fields for a shared %s',
    (kind) => {
      const state = teamState(kind);
      const input = {
        role: 'Chief of operations',
        responsibilities: ['Approve budgets', 'Plan recruiting'],
        departmentId: null,
        managerId: null,
        instructions: 'New working context',
      };
      const { changes } = executeCommands(state, [{ type: 'agent.update', id: 'member', input }]);
      const html = renderToStaticMarkup(
        createElement(PreviewDialog, {
          member: {
            name: 'Alex Morgan',
            kind,
            role: input.role,
            companyNames: ['Northstar Studio', 'Northstar Services'],
            editing: true,
          },
          preview: {
            id: 'preview-receipt',
            baseRevision: 1,
            summary: 'Update Alex Morgan',
            changes,
            createdAt: '2026-09-06T20:00:00Z',
          },
          busy: false,
          error: null,
          onClose: () => {},
          onApply: () => {},
          onRefresh: () => {},
        }),
      );
      const visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
      expect(visible).toContain('Role: Operations lead → Chief of operations');
      expect(visible).toContain(
        'Responsibilities: Review budgets; Maintain supplier relationships → Approve budgets; Plan recruiting',
      );
      expect(visible).toContain('Department: Operations → (none)');
      expect(visible).toContain('Reports to: Sam Taylor → (none)');
      expect(visible).not.toContain('Name:');
      expect(visible).not.toContain('New working context');
      expect(visible).toContain('Northstar Studio');
      expect(visible).toContain('Northstar Services');
      expect(visible).toContain('These changes apply across all listed companies.');
      expect(visible).toContain('>Back</button>');
      expect(state.agents[0].responsibilities).toEqual([
        'Review budgets',
        'Maintain supplier relationships',
      ]);
    },
  );

  it('shows a responsibilities-only change without expanding unchanged reporting fields', () => {
    const state = teamState();
    const { changes } = executeCommands(state, [
      { type: 'agent.update', id: 'member', input: { responsibilities: ['Plan staffing'] } },
    ]);
    const html = renderToStaticMarkup(
      createElement(PreviewDialog, {
        member: {
          name: 'Alex Morgan',
          kind: 'human',
          role: 'Operations lead',
          companyNames: ['Northstar Studio'],
          editing: true,
        },
        preview: {
          id: 'preview-receipt',
          baseRevision: 1,
          summary: 'Update Alex Morgan',
          changes,
          createdAt: '2026-09-06T20:00:00Z',
        },
        busy: false,
        error: null,
        onClose: () => {},
        onApply: () => {},
        onRefresh: () => {},
      }),
    );
    const visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
    expect(visible).toContain(
      'Responsibilities: Review budgets; Maintain supplier relationships → Plan staffing',
    );
    expect(visible).not.toMatch(/Reports to:|Department:|Role:/);
  });
});

describe('company edit priorities', () => {
  it('keeps name and purpose primary while retaining the saved code and color in closed details', () => {
    const html = renderMember({ kind: 'company', id: 'company' });
    const visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
    expect(visible).toContain('value="Northstar Studio"');
    expect(visible).toContain('Purpose<textarea');
    expect(visible).toContain('A test company</textarea>');
    expect(visible).not.toMatch(/Short code|type="color"/);
    expect(html).toContain(
      '<details class="text-disclosure"><summary>Company code &amp; appearance</summary>',
    );
    expect(html).toContain('value="NORTHSTAR"');
    expect(html).toContain('type="color" value="#256c5b"');
    expect(html.indexOf('Purpose<textarea')).toBeLessThan(html.indexOf('Short code'));
  });
});
