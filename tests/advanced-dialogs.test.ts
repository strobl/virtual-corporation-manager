import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceState } from '../src/domain/contracts';
import { emptyState } from '../src/domain/model';
import { AdvancedDialog, type AdvancedTarget } from '../src/web/AdvancedDialogs';
import { PreviewDialog } from '../src/web/Dialogs';

const now = '2026-09-06T12:00:00.000Z';
const state: WorkspaceState = {
  ...emptyState(),
  companies: ['Northstar', 'Harbor', 'Summit'].map((name) => ({
    id: name,
    name,
    shortCode: name.toUpperCase(),
    description: '',
    color: '#256c5b',
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  })),
  agents: [
    {
      id: 'member',
      name: 'Alex',
      role: 'Operations',
      kind: 'human',
      instructions: '',
      responsibilities: [],
      departmentId: null,
      managerId: null,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ],
  assignments: ['Northstar', 'Harbor'].map((companyId, index) => ({
    id: `assignment-${companyId}`,
    agentId: 'member',
    companyId,
    isPrimary: index === 0,
    startedAt: now,
    endedAt: null,
  })),
  relationships: [
    {
      id: 'relationship',
      fromCompanyId: 'Northstar',
      toCompanyId: 'Harbor',
      kind: 'collaboration',
      percentage: null,
      description: 'Shared services',
      startedAt: now,
      endedAt: null,
    },
  ],
};
const targets: AdvancedTarget[] = [
  { kind: 'relationships', companyId: 'Northstar' },
  { kind: 'assignments', agentId: 'member' },
  { kind: 'import' },
];

function renderDialog(target: AdvancedTarget, overrides = {}) {
  return renderToStaticMarkup(
    createElement(AdvancedDialog, {
      target,
      state,
      busy: false,
      error: null,
      onClose: () => {},
      onSubmit: async () => {},
      ...overrides,
    }),
  );
}

describe('advanced management dialog review boundary', () => {
  it.each(targets)(
    'hides the $kind form without submitting or dismissing during review',
    (target) => {
      const onSubmit = vi.fn();
      const onClose = vi.fn();
      expect(renderDialog(target, { reviewing: true, onSubmit, onClose })).toBe('');
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it.each(targets)(
    'locks all $kind actions and editable fields while preparing a preview',
    (target) => {
      const html = renderDialog(target, { busy: true });
      const buttons = html.match(/<button\b[^>]*>/g) ?? [];
      expect(buttons.length).toBeGreaterThanOrEqual(3);
      expect(buttons.every((button) => button.includes('disabled=""'))).toBe(true);
      const fields = (html.match(/<(?:input|textarea|select)\b[^>]*>/g) ?? []).filter(
        (field) => !field.includes('readOnly=""'),
      );
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every((field) => field.includes('disabled=""'))).toBe(true);
    },
  );

  it.each(targets.slice(0, 2))(
    'makes a failed $kind preview correctable with its original context',
    (target) => {
      const html = renderDialog(target, { error: 'The selected change is not valid.' });
      expect(html).toContain('role="alert"');
      expect(html).toContain('The selected change is not valid.');
      expect(html).toContain(
        target.kind === 'relationships'
          ? 'Northstar · Company relationships'
          : 'Alex · Company assignments',
      );
      const buttons = html.match(/<button\b[^>]*>/g) ?? [];
      expect(buttons.every((button) => !button.includes('disabled=""'))).toBe(true);
      expect(html).toMatch(/<select\b/);
    },
  );
});

const unavailableTargets = ['removed', 'archived'].flatMap((status) =>
  targets.slice(0, 2).map((target) => ({ status, target })),
);

function withoutTarget(target: AdvancedTarget, status: string) {
  const updated = structuredClone(state);
  if (target.kind === 'relationships') {
    if (status === 'removed')
      updated.companies = updated.companies.filter((row) => row.id !== target.companyId);
    else updated.companies.find((row) => row.id === target.companyId)!.status = 'archived';
  } else if (target.kind === 'assignments') {
    if (status === 'removed')
      updated.agents = updated.agents.filter((row) => row.id !== target.agentId);
    else updated.agents.find((row) => row.id === target.agentId)!.status = 'archived';
  }
  return updated;
}

describe('retained drafts after their target disappears', () => {
  it.each(unavailableTargets)(
    'offers safe dismissal after a $status $target.kind target is refreshed and the user goes Back',
    ({ target, status }) => {
      const onSubmit = vi.fn();
      const onClose = vi.fn();
      const html = renderDialog(target, {
        state: withoutTarget(target, status),
        onSubmit,
        onClose,
      });
      expect(html).toContain('no longer available');
      expect(html).toContain('role="alert"');
      expect(html).toContain('has been removed or archived');
      expect(html).toMatch(/<button class="button" type="button">Close<\/button>/);
      expect(html).not.toMatch(
        /<form\b|<select\b|Review relationship|Review assignment|Make primary/,
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it.each(unavailableTargets)(
    'keeps a $status $target.kind target hidden while the existing save receipt needs confirmation',
    ({ target, status }) => {
      const onSubmit = vi.fn();
      const onClose = vi.fn();
      const advanced = renderDialog(target, {
        state: withoutTarget(target, status),
        reviewing: true,
        error: 'The save response was interrupted.',
        onSubmit,
        onClose,
      });
      const review = renderToStaticMarkup(
        createElement(PreviewDialog, {
          preview: {
            id: 'original-save-receipt',
            baseRevision: 1,
            summary: 'Review the existing management change',
            changes: ['Apply the originally reviewed change'],
            createdAt: now,
          },
          busy: false,
          error: 'The save response was interrupted.',
          recovery: 'retry',
          backToEditor: true,
          onClose,
          onApply: () => {},
          onRefresh: () => {},
        }),
      );
      expect(advanced).toBe('');
      expect((advanced + review).match(/<dialog\b/g)).toHaveLength(1);
      expect(review).toContain('Save confirmation pending');
      expect(review).toContain('Retry save');
      expect(review).toMatch(/<button class="button" disabled="">Back<\/button>/);
      expect(review).not.toContain('Refresh preview');
      expect(onClose).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it.each(targets.slice(0, 2))(
    'locks every dismissal if the $kind target becomes unavailable during a busy operation',
    (target) => {
      const html = renderDialog(target, {
        state: withoutTarget(target, 'removed'),
        busy: true,
      });
      const buttons = html.match(/<button\b[^>]*>/g) ?? [];
      expect(buttons).toHaveLength(2);
      expect(buttons.every((button) => button.includes('disabled=""'))).toBe(true);
    },
  );
});
