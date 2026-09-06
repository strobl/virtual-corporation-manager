import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QuickCompanySetup, type QuickCompanySetupProps } from '../src/web/QuickCompanySetup';
import { EntityEditor, PreviewDialog } from '../src/web/Dialogs';
import { HumanResultDialog } from '../src/web/HumanResultDialog';
import { emptyState } from '../src/domain/model';

function renderSetup(props: Partial<QuickCompanySetupProps> = {}) {
  return renderToStaticMarkup(
    createElement(QuickCompanySetup, {
      onReview: () => {},
      onClose: () => {},
      ...props,
    }),
  );
}

describe('simple company creation', () => {
  it('asks only for a labeled company name and optional purpose before the save review', () => {
    const html = renderSetup();
    expect(html.match(/<input\b/g)).toHaveLength(1);
    expect(html.match(/<textarea\b/g)).toHaveLength(1);
    expect(html).toMatch(/<label>Company name<input\b[^>]*required=""/);
    expect(html).toMatch(/<label>Purpose[\s\S]*?<textarea\b/);
    expect(html.match(/<textarea\b[^>]*>/)?.[0]).not.toContain('required');
    expect(html).not.toMatch(/<(?:select|ol)\b|type="(?:color|checkbox|radio)"/);
    expect(html.match(/<form\b/g)).toHaveLength(1);
    expect(html.match(/<button\b[^>]*type="submit"/g)).toHaveLength(1);
  });

  it('hides its own dialog while the parent shows the authoritative save review', () => {
    const onReview = vi.fn();
    const onClose = vi.fn();
    expect(renderSetup({ reviewing: true, onReview, onClose })).toBe('');
    expect(onReview).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks the form and every dismissal while the parent prepares a change', () => {
    const html = renderSetup({ busy: true });
    expect(html).toMatch(/<fieldset\b[^>]*disabled=""/);
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.includes('disabled=""'))).toBe(true);
  });

  it('renders failed preparation as a focusable alert with an available retry', () => {
    const html = renderSetup({ error: 'Could not reach the local workspace.' });
    expect(html).toMatch(/<div\b[^>]*role="alert"[^>]*tabindex="-1"/);
    expect(html).toContain('Could not reach the local workspace.');
    expect(html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0]).not.toContain('disabled');
  });

  it('keeps company review technical changes collapsed behind the create action', () => {
    const html = renderToStaticMarkup(
      createElement(PreviewDialog, {
        company: { name: 'Northstar Studio', purpose: 'Build useful products.' },
        preview: {
          id: 'actual-preview-receipt',
          baseRevision: 7,
          summary: 'Import Northstar Studio',
          changes: ['New IDs are created; short code: NORTHSTAR; color: #256c5b'],
          createdAt: '2026-09-06T16:00:00Z',
        },
        busy: false,
        error: null,
        onClose: () => {},
        onApply: () => {},
        onRefresh: () => {},
      }),
    );
    expect(html).toContain('Create Northstar Studio');
    expect(html).toContain('Build useful products.');
    expect(html).toMatch(
      /<details class="text-disclosure"><summary>Review technical details<\/summary><ol[\s\S]*New IDs are created/,
    );
    expect(html).not.toContain('<details open');
    expect(html).not.toContain('Import Northstar Studio');
    expect(html).toMatch(/<button class="button">Back<\/button>/);
    expect(html).toMatch(/<button class="button primary">[\s\S]*Create company<\/button>/);
  });

  it('preserves interrupted-save confirmation and disables company review dismissal', () => {
    const html = renderToStaticMarkup(
      createElement(PreviewDialog, {
        company: { name: 'Northstar Studio', purpose: '' },
        preview: {
          id: 'same-preview-receipt',
          baseRevision: 7,
          summary: 'Import Northstar Studio',
          changes: ['Create the company'],
          createdAt: '2026-09-06T16:00:00Z',
        },
        busy: false,
        error: 'Save response interrupted.',
        recovery: 'retry',
        onClose: () => {},
        onApply: () => {},
        onRefresh: () => {},
      }),
    );
    expect(html).toContain('Save confirmation pending');
    expect(html).toContain('Retry this same save');
    expect(html).toMatch(/<button class="button" disabled="">Back<\/button>/);
    expect(html).toMatch(/<button class="button primary">[\s\S]*Retry save<\/button>/);
    expect(html).not.toContain('Refresh preview');
  });

  it.each([false, true])(
    'shows every affected company in a member review (editing: %s)',
    (editing) => {
      const html = renderToStaticMarkup(
        createElement(PreviewDialog, {
          member: {
            name: 'Alex Morgan',
            role: 'Operations lead',
            kind: 'human',
            companyNames: ['Northstar Studio', 'Northstar Services'],
            editing,
          },
          preview: {
            id: 'member-preview',
            baseRevision: 7,
            summary: 'Update team member: Alex Morgan',
            changes: ['Instructions: Coordinate operations → Lead operations'],
            createdAt: '2026-09-06T16:00:00Z',
          },
          busy: false,
          error: null,
          onClose: () => {},
          onApply: () => {},
          onRefresh: () => {},
        }),
      );
      const visible = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
      expect(visible).toContain(`${editing ? 'Save' : 'Add'} Alex Morgan`);
      expect(visible).toContain('Human · Operations lead');
      expect(visible).toContain('Northstar Studio');
      expect(visible).toContain('Northstar Services');
      expect(visible).not.toContain('Instructions:');
      expect(html).toMatch(
        /<details class="text-disclosure"><summary>Review technical details<\/summary>/,
      );
      expect(visible).toContain(editing ? 'Save member' : 'Add member');
      expect(visible).toContain('>Back</button>');
      if (editing) expect(visible).toContain('These changes apply across all listed companies.');
    },
  );

  it('keeps generic change reviews and their actions unchanged', () => {
    const html = renderToStaticMarkup(
      createElement(PreviewDialog, {
        preview: {
          id: 'generic-preview',
          baseRevision: 7,
          summary: 'End company assignment',
          changes: ['End Alex’s assignment to Northstar Services'],
          createdAt: '2026-09-06T16:00:00Z',
        },
        busy: false,
        error: null,
        onClose: () => {},
        onApply: () => {},
        onRefresh: () => {},
      }),
    );
    expect(html).toContain('Review your changes');
    expect(html).toContain('End company assignment');
    expect(html).toContain('End Alex’s assignment to Northstar Services');
    expect(html).not.toContain('Review technical details');
    expect(html).toContain('>Discard draft</button>');
    expect(html).toContain('Apply changes</button>');
  });

  it('hides preserved member and human result editors while the parent shows the preview', () => {
    const onSubmit = vi.fn();
    const shared = { busy: false, error: null, reviewing: true, onClose: () => {}, onSubmit };
    expect(
      renderToStaticMarkup(
        createElement(EntityEditor, {
          ...shared,
          target: { kind: 'agent', companyId: 'company' },
          state: emptyState(),
        }),
      ),
    ).toBe('');
    expect(
      renderToStaticMarkup(
        createElement(HumanResultDialog, {
          ...shared,
          companyId: 'company',
          agent: {
            id: 'human',
            name: 'Alex',
            role: 'Operations',
            kind: 'human',
            instructions: '',
            responsibilities: [],
            departmentId: null,
            managerId: null,
            status: 'active',
            version: 1,
            createdAt: '2026-09-06T16:00:00Z',
            updatedAt: '2026-09-06T16:00:00Z',
          },
        }),
      ),
    ).toBe('');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
