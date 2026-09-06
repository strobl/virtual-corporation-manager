import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Agent, WorkspaceState } from '../src/domain/contracts';
import { emptyState } from '../src/domain/model';
import { EntityEditor, type EditorTarget } from '../src/web/Dialogs';

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
