import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkRecord, WorkspaceState } from '../src/domain/contracts';
import {
  RunDialog,
  submitRunTask,
  WorkView,
  type RunInfo,
  type IntegrationStatus,
} from '../src/web/Work';
import {
  createWorkViewModel,
  getRunTargetCompany,
  initialRunForScope,
  runDisplayState,
} from '../src/web/work-view-model';
import * as api from '../src/web/client';

afterEach(() => vi.restoreAllMocks());

const createdAt = '2026-09-05T08:00:00Z';
function run(id: string, patch: Partial<RunInfo> = {}): RunInfo {
  return {
    id,
    requestId: `request-${id}`,
    agentId: 'shared-agent',
    agentName: 'Shared agent',
    companyId: 'a',
    task: `Task ${id}`,
    transport: 'codex',
    status: 'completed',
    output: `Output ${id}`,
    error: null,
    createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    durationMs: 10,
    outputSha256: null,
    deliveryStatus: 'none',
    runtimeVersion: null,
    sessionId: null,
    ...patch,
  };
}
function record(value: RunInfo, patch: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: `work-${value.id}`,
    runId: value.id,
    companyId: value.companyId,
    agentId: value.agentId,
    title: `Result ${value.id}`,
    output: value.output,
    provenance: 'codex',
    status: 'submitted',
    createdAt,
    durationMs: 10,
    ...patch,
  };
}
function workspace(work: WorkRecord[] = []): WorkspaceState {
  return {
    schemaVersion: 3,
    revision: 9,
    companies: ['a', 'b'].map((id) => ({
      id,
      name: id === 'a' ? 'Alpha Studio' : 'Beta Studio',
      shortCode: id.toUpperCase(),
      description: '',
      color: '#ffffff',
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    })),
    departments: [],
    agents: [
      {
        id: 'shared-agent',
        name: 'Shared agent',
        role: 'Analyst',
        kind: 'agent',
        instructions: '',
        responsibilities: [],
        departmentId: null,
        managerId: null,
        status: 'active',
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    assignments: [
      {
        id: 'current-assignment',
        agentId: 'shared-agent',
        companyId: 'b',
        isPrimary: true,
        startedAt: createdAt,
        endedAt: null,
      },
    ],
    relationships: [],
    work,
    history: [],
  };
}

describe('company work presentation', () => {
  it('uses persisted company provenance after an agent moves, including accepted manual work', () => {
    const a = run('historical-a');
    const b = run('current-b', { companyId: 'b', status: 'running' });
    const state = workspace([
      record(a),
      record(b, { status: 'accepted' }),
      record(a, { id: 'manual-a', runId: null, provenance: 'manual', status: 'accepted' }),
    ]);
    const view = createWorkViewModel(state, [b, a], 'a');
    expect(view.scopeName).toBe('Alpha Studio');
    expect(view.runs.map((item) => item.id)).toEqual(['historical-a']);
    expect(view.work.map((item) => item.id)).toEqual(['work-historical-a', 'manual-a']);
    expect(view.acceptedRecords.map((item) => item.id)).toEqual(['manual-a']);
    expect(view.stats).toEqual({
      tasks: 1,
      running: 0,
      queued: 0,
      completed: 1,
      accepted: 1,
      reviewable: 1,
    });
    expect(createWorkViewModel(state, [b, a], 'b').stats).toEqual({
      tasks: 1,
      running: 1,
      queued: 0,
      completed: 0,
      accepted: 1,
      reviewable: 0,
    });
  });

  it('separates review, execution and explicit acceptance, preserving every original value', () => {
    const review = run('review', {
      task: 'Exact\n  original task',
      output: '\n  Exact output ✨\n',
    });
    const accepted = run('accepted');
    const queued = run('queued', { status: 'queued', output: '' });
    const running = run('running', { status: 'running', output: '' });
    const failed = run('failed', { status: 'failed', output: '', error: 'Failed' });
    const completed = run('completed-without-record');
    const originalRuns = [queued, completed, accepted, running, review, failed];
    const state = workspace([record(review), record(accepted, { status: 'accepted' })]);
    const before = JSON.stringify({ state, originalRuns });
    const view = createWorkViewModel(state, originalRuns, 'a');
    expect(view.runs.map((item) => item.id)).toEqual([
      'review',
      'queued',
      'completed-without-record',
      'accepted',
      'running',
      'failed',
    ]);
    expect(view.stats).toEqual({
      tasks: 6,
      running: 1,
      queued: 1,
      completed: 3,
      accepted: 1,
      reviewable: 1,
    });
    expect(view.runs[0]).toBe(review);
    expect(view.work[0]).toBe(state.work[0]);
    expect(JSON.stringify({ state, originalRuns })).toBe(before);
    expect(view.runs.map((item) => runDisplayState(item, view.work).label)).toEqual([
      'Needs your review',
      'Queued',
      'Run completed',
      'Accepted',
      'Running',
      'Failed',
    ]);
  });

  it.each([
    ['missing work', {}, null],
    ['empty output', { output: '' }, {}],
    ['whitespace output', { output: '\n \t' }, {}],
    ['work from another company', {}, { companyId: 'b' }],
    ['work from another agent', {}, { agentId: 'someone-else' }],
    ['work for another run', {}, { runId: 'another-run' }],
    ['failed work', {}, { status: 'failed' }],
  ] as const)('does not offer review for %s', (_name, runPatch, workPatch) => {
    const value = run('result', runPatch);
    const work = workPatch === null ? [] : [record(value, workPatch)];
    expect(runDisplayState(value, work)).toMatchObject({
      label: 'Run completed',
      reviewable: false,
    });
    expect(createWorkViewModel(workspace(work), [value], 'a').stats.reviewable).toBe(0);
  });

  it.each(['queued', 'running', 'failed'] as const)(
    'does not relabel a %s run as reviewable or accepted from a conflicting work record',
    (status) => {
      const value = run(status, { status });
      for (const workStatus of ['submitted', 'accepted'] as const) {
        const display = runDisplayState(value, [record(value, { status: workStatus })]);
        expect(display.reviewable).toBe(false);
        expect(display.tone).toBe(status);
      }
    },
  );

  it('keeps the unselected view explicitly global and an unknown company empty', () => {
    const runs = [run('a'), run('b', { companyId: 'b' })];
    const state = workspace(runs.map((value) => record(value)));
    expect(createWorkViewModel(state, runs)).toMatchObject({
      scopeName: 'All companies',
      stats: { tasks: 2, reviewable: 2 },
    });
    expect(createWorkViewModel(state, runs, 'missing')).toMatchObject({
      scopeName: 'Selected company',
      runs: [],
      work: [],
      stats: { tasks: 0, reviewable: 0 },
    });
  });

  it('renders the selected company and review invitation without exposing other-company results', () => {
    const a = run('a', { task: 'Review the local proposal' });
    const b = run('b', {
      companyId: 'b',
      task: 'PRIVATE OTHER COMPANY TASK',
      output: 'PRIVATE OTHER OUTPUT',
    });
    const state = workspace([
      record(a),
      record(b, { status: 'accepted', title: 'PRIVATE OTHER RECORD' }),
    ]);
    const render = (companyId: string | null) =>
      renderToStaticMarkup(
        createElement(WorkView, {
          state,
          runs: [b, a],
          companyId,
          onSelectAgent: () => {},
          onRefresh: () => {},
          onAccept: () => {},
        }),
      );
    const html = render('a');
    expect(html).toContain('<h2>Alpha Studio</h2>');
    expect(html).toContain('Work ready for review');
    expect(html).toContain('Review work');
    expect(html).toContain('Review the local proposal');
    expect(html).not.toContain('PRIVATE OTHER');
    expect(html).not.toContain('Accept result');
    expect(render(null)).toContain('<h2>All companies</h2>');
    expect(render('missing')).not.toContain('Work ready for review');
  });
});

describe('task company handoff', () => {
  function sharedWorkspace() {
    const state = workspace();
    state.assignments[0]!.isPrimary = false;
    state.assignments.push({
      ...state.assignments[0]!,
      id: 'primary-a',
      companyId: 'a',
      isPrimary: true,
    });
    return state;
  }

  it('mirrors primary-first runtime ordering, including ended and absent primary assignments', () => {
    const state = sharedWorkspace();
    const before = JSON.stringify(state);
    expect(getRunTargetCompany(state, 'shared-agent')?.id).toBe('a');
    expect(JSON.stringify(state)).toBe(before);
    state.assignments[1]!.isPrimary = false;
    expect(getRunTargetCompany(state, 'shared-agent')?.id).toBe('b');
    state.assignments[1]!.isPrimary = true;
    state.assignments[1]!.endedAt = createdAt;
    expect(getRunTargetCompany(state, 'shared-agent')?.id).toBe('b');
    state.assignments[0]!.endedAt = createdAt;
    expect(getRunTargetCompany(state, 'shared-agent')).toBeNull();
  });

  it('does not silently substitute an active secondary company for an archived primary', () => {
    const state = sharedWorkspace();
    state.companies[0]!.status = 'archived';
    expect(getRunTargetCompany(state, 'shared-agent')).toBeNull();
    state.companies[0]!.status = 'active';
    state.agents[0]!.status = 'archived';
    expect(getRunTargetCompany(state, 'shared-agent')).toBeNull();
    state.agents[0]!.status = 'active';
    state.agents[0]!.kind = 'human';
    expect(getRunTargetCompany(state, 'shared-agent')).toBeNull();
  });

  it.each(['a', 'b'])(
    'forwards the server run from selected company %s, then selects its actual company detail',
    async (selectedCompanyId) => {
      const state = sharedWorkspace();
      const created = run('new-a', { status: 'queued', task: 'New handoff task', output: '' });
      const prior = run('old-b', { companyId: 'b', task: 'Other company task' });
      const post = vi.spyOn(api, 'request').mockResolvedValue(created);
      const payload = {
        agentId: 'shared-agent',
        task: 'New handoff task',
        requestId: 'attempt-1',
        transport: 'codex' as const,
      };
      let companyId = selectedCompanyId;
      let initialRunId: string | null = null;
      let runs: RunInfo[] = [prior];
      const onStarted = vi.fn(async (value: RunInfo) => {
        companyId = value.companyId;
        initialRunId = value.id;
        runs = [value, ...runs];
      });
      expect(await submitRunTask(payload, onStarted)).toBe(created);
      expect(post).toHaveBeenCalledExactlyOnceWith('/api/runs', payload);
      expect(Object.keys(payload).sort()).toEqual(['agentId', 'requestId', 'task', 'transport']);
      expect(onStarted).toHaveBeenCalledExactlyOnceWith(created);
      expect(companyId).toBe('a');
      expect(initialRunForScope(runs, companyId, initialRunId)).toBe(created);
      expect(initialRunForScope(runs, 'b', initialRunId)).toBeNull();
      const html = renderToStaticMarkup(
        createElement(WorkView, {
          state,
          runs,
          companyId,
          initialRunId,
          onSelectAgent: () => {},
          onRefresh: () => {},
          onAccept: () => {},
        }),
      );
      expect(html).toContain('<h2>Alpha Studio</h2>');
      expect(html).toContain('aria-labelledby="dialog-task-result"');
      expect(html).toContain('New handoff task');
      expect(html).toContain('Original task');
      expect(html).not.toContain('Other company task');
      expect(html).not.toContain('Accept result');
    },
  );

  it('does not navigate on a failed submission and retains the all-company scope contract', async () => {
    const onStarted = vi.fn(async (_value: RunInfo) => {});
    vi.spyOn(api, 'request').mockRejectedValue(new Error('Queue full'));
    await expect(
      submitRunTask(
        { agentId: 'shared-agent', task: 'A task', requestId: 'attempt-2', transport: 'buzz' },
        onStarted,
      ),
    ).rejects.toThrow('Queue full');
    expect(onStarted).not.toHaveBeenCalled();
    const values = [run('a'), run('b', { companyId: 'b' })];
    expect(initialRunForScope(values, null, 'b')).toBe(values[1]);
    expect(initialRunForScope([], 'b', 'b')).toBeNull();
    expect(initialRunForScope(values, 'a', 'b')).toBeNull();
    expect(createWorkViewModel(workspace(), values, null)).toMatchObject({
      scopeName: 'All companies',
      stats: { tasks: 2 },
    });
  });

  it('renders an explicit controlled scope selector without changing the supplied scope', () => {
    const state = sharedWorkspace();
    const runs = [run('a'), run('b', { companyId: 'b' })];
    const onScopeChange = vi.fn();
    const render = (companyId: string | null) =>
      renderToStaticMarkup(
        createElement(WorkView, {
          state,
          runs,
          companyId,
          selectedCompanyName: 'Alpha Studio',
          onScopeChange,
          onSelectAgent: () => {},
          onRefresh: () => {},
          onAccept: () => {},
        }),
      );
    const company = render('a');
    expect(company).toContain('Work scope');
    expect(company).toContain('<option value="company" selected="">Alpha Studio</option>');
    expect(company).not.toContain('Task b');
    const all = render(null);
    expect(all).toContain('<option value="all" selected="">All companies</option>');
    expect(all).toContain('Task a');
    expect(all).toContain('Task b');
    expect(onScopeChange).not.toHaveBeenCalled();
  });

  it('shows the actual destination before start, explains cross-company execution, and holds without a target', () => {
    const state = sharedWorkspace();
    const status: IntegrationStatus = {
      codex: { available: true, authenticated: true, state: 'ready', message: 'Ready' },
      buzz: { state: 'not-configured', available: false, message: '' },
      slack: { state: 'not-configured', message: '' },
      activeRuns: 0,
      queuedRuns: 0,
      costNotice: 'Provider access is separate.',
    };
    const render = (
      actualCompanyName: string | null,
      selectedCompanyName: string,
      targetDiffersFromSelection: boolean,
    ) =>
      renderToStaticMarkup(
        createElement(RunDialog, {
          agent: state.agents[0]!,
          status,
          actualCompanyName,
          selectedCompanyName,
          targetDiffersFromSelection,
          onStarted: async (_value: RunInfo) => {},
          onClose: () => {},
        }),
      );
    const shared = render('Alpha Studio', 'Beta Studio', true);
    expect(shared).toContain('Task company: Alpha Studio');
    expect(shared).toContain(
      'You are viewing Beta Studio. This task belongs to Alpha Studio, where its result will open.',
    );
    expect(render('Alpha Studio', 'Alpha Studio', false)).not.toContain('You are viewing');
    const missing = render(null, 'Beta Studio', true);
    expect(missing).toContain('Assign this agent to an active company');
    expect(missing).toContain('class="button primary" disabled=""');
  });
});

describe('result hierarchy', () => {
  function resultDialog(value: RunInfo, work: WorkRecord[] = []) {
    const state = workspace(work);
    const before = JSON.stringify({ value, state });
    const html = renderToStaticMarkup(
      createElement(WorkView, {
        state,
        runs: [value],
        companyId: value.companyId,
        initialRunId: value.id,
        onSelectAgent: () => {},
        onRefresh: () => {},
        onAccept: () => {},
      }),
    );
    expect(JSON.stringify({ value, state })).toBe(before);
    const dialog = html.match(/<dialog\b[\s\S]*?<\/dialog>/)?.[0];
    expect(dialog).toBeDefined();
    return dialog!;
  }

  it('presents exact output before native technical disclosure and retains complete context and explicit actions', () => {
    const value = run('receipt-original-id', {
      task:
        'Original task: keep <tags> & "quotes".\n  Preserve whitespace and all instructions.\n' +
        'Long context '.repeat(60),
      output:
        "Output first.\n<script>alert('plain text')</script>\n  Keep tabs\tand trailing spaces.  ",
      agentName: 'A deliberately long agent identity '.repeat(10),
      runtimeVersion: 'runtime-test-version',
      durationMs: 1250,
      outputSha256: 'a'.repeat(64),
    });
    const dialog = resultDialog(value, [record(value)]);
    const escaped = (text: string) =>
      text.replace(
        /[&<>"']/g,
        (character) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
          })[character]!,
      );
    const output = dialog.match(/<pre\b[^>]*aria-label="Task output"[^>]*>([\s\S]*?)<\/pre>/);
    const task = dialog.match(/<pre\b[^>]*aria-label="Original task"[^>]*>([\s\S]*?)<\/pre>/);
    expect(output?.[1]).toBe(escaped(value.output));
    expect(task?.[1]).toBe(escaped(value.task));
    expect(dialog).not.toContain('<script>');
    expect(dialog.indexOf('Needs your review')).toBeLessThan(
      dialog.indexOf('aria-label="Task output"'),
    );
    expect(dialog.indexOf('aria-label="Task output"')).toBeLessThan(
      dialog.indexOf('<summary>Technical details</summary>'),
    );
    expect(dialog.indexOf('<summary>Technical details</summary>')).toBeLessThan(
      dialog.indexOf('<summary>Read original task</summary>'),
    );
    const technical = dialog.match(
      /<details([^>]*)><summary>Technical details<\/summary>([\s\S]*?)<\/details>/,
    );
    expect(technical).not.toBeNull();
    // Native details/summary supply keyboard activation and expanded state; no custom role or tab suppression.
    expect(technical![1]).not.toMatch(/\bopen(?:=|\s|$)|\brole=|tabindex/);
    for (const label of ['Runtime', 'Started', 'Duration', 'Run ID', 'Output SHA-256']) {
      expect(technical![2]).toContain(`<dt>${label}</dt>`);
    }
    expect(technical![2]).toContain('codex runtime-test-version');
    expect(technical![2]).toContain('1.3 seconds');
    expect(technical![2]).toContain(value.id);
    expect(technical![2]).toContain(value.outputSha256);
    expect(dialog).toContain(escaped(value.agentName));
    expect(dialog).toContain('Accept result');
    expect(dialog).toContain('Download result');
    expect(dialog).toContain('tabindex="0" role="region" aria-label="Task output"');
    expect(dialog).toContain('tabindex="0" role="region" aria-label="Original task"');
  });

  it.each(['queued', 'running', 'failed', 'completed'] as const)(
    'keeps the %s empty-output explanation before technical details without granting acceptance',
    (status) => {
      const value = run(`no-output-${status}`, {
        status,
        output: '',
        error: status === 'failed' ? 'The runtime returned no result.' : null,
      });
      const dialog = resultDialog(value);
      const message =
        status === 'failed' || status === 'completed'
          ? 'No output was returned.'
          : 'Waiting for the runtime to return its result…';
      expect(dialog.indexOf(message)).toBeGreaterThan(-1);
      expect(dialog.indexOf(message)).toBeLessThan(
        dialog.indexOf('<summary>Technical details</summary>'),
      );
      expect(dialog).not.toContain('Accept result');
      expect(dialog).not.toContain('Download result');
      if (value.error) expect(dialog).toContain(`role="alert">${value.error}</p>`);
    },
  );
});
