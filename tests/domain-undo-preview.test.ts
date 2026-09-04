import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createWorkspaceStore } from '../src/db/store.js';
import type { DomainCommand, WorkspaceState, WorkspaceStore } from '../src/domain/contracts.js';

const directories: string[] = [];
const stores: WorkspaceStore[] = [];
function open() {
  const directory = mkdtempSync(join(tmpdir(), 'gitflash-undo-preview-')); directories.push(directory);
  const store = createWorkspaceStore(directory); stores.push(store); return { store, directory };
}
function apply(store: WorkspaceStore, commands: DomainCommand[]) { return store.apply(store.preview(commands, store.snapshot().revision).id); }
const company = (name: string): DomainCommand => ({ type: 'company.create', input: { name, shortCode: name, description: 'Original purpose', color: '#123456' } });
const agent = (companyId: string): DomainCommand => ({ type: 'agent.create', companyId, input: {
  name: 'Analyst', role: 'Product Analyst', kind: 'agent', instructions: 'Cite the supporting evidence.', responsibilities: ['Review customer needs'], departmentId: null, managerId: null,
} });
function config(state: WorkspaceState) {
  return { companies: state.companies, departments: state.departments, agents: state.agents, assignments: state.assignments, relationships: state.relationships };
}
function persistedRows(directory: string) {
  const database = new DatabaseSync(join(directory, 'workspace.sqlite'), { readOnly: true });
  try {
    return Object.fromEntries(['workspace_meta', 'previews', 'changes', 'companies', 'departments', 'agents', 'assignments', 'relationships', 'work', 'integration_runs']
      .map(table => [table, database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  } finally { database.close(); }
}
afterEach(() => { for (const store of stores.splice(0)) store.close(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('reviewed undo', () => {
  it('previews exact reverse field values without writing a preview, audit, or configuration record', () => {
    const { store, directory } = open(); const companyId = apply(store, [company('STUDIO')]).state.companies[0]!.id;
    const agentId = apply(store, [agent(companyId)]).state.agents[0]!.id;
    apply(store, [{ type: 'work.record', input: { companyId, agentId, title: 'Retained deliverable', output: 'Useful private result stays unchanged.', provenance: 'manual', status: 'submitted', durationMs: null, runId: null } }]);
    const original = store.snapshot();
    const changed = apply(store, [
      { type: 'company.update', id: companyId, input: { description: 'Changed purpose' } },
      { type: 'agent.update', id: agentId, input: { instructions: 'Use the revised evidence.', responsibilities: ['Review scope', 'Explain limitations'] } },
    ]);
    const before = store.snapshot(); const persistedBefore = persistedRows(directory);
    const preview = store.previewUndo(changed.changeId, changed.state.revision);
    expect(preview).toMatchObject({ changeId: changed.changeId, baseRevision: changed.state.revision });
    expect(preview.summary).toBe(`Undo: ${before.history[0]!.summary}`);
    const effects = preview.changes.join('\n');
    expect(effects).toContain('Description: "Changed purpose" → "Original purpose"');
    expect(effects).toContain('Instructions: "Use the revised evidence." → "Cite the supporting evidence."');
    expect(effects).toContain('Responsibilities: ["Review scope","Explain limitations"] → ["Review customer needs"]');
    expect(effects).not.toContain('assignment'); expect(effects).not.toContain('Retained deliverable'); expect(effects).not.toContain('Useful private result');
    expect(store.snapshot()).toEqual(before); expect(persistedRows(directory)).toEqual(persistedBefore);
    expect(store.previewUndo(changed.changeId, changed.state.revision)).toEqual(preview);
    const restored = store.undo(preview.changeId, preview.baseRevision);
    expect(config(restored)).toEqual(config(original)); expect(restored.work).toEqual(original.work);
    expect(restored.revision).toBe(changed.state.revision + 1); expect(restored.history[0]!.action).toBe('change.undo');
  });

  it('shows removal of a newly created agent and assignment while excluding unchanged companies', () => {
    const { store } = open(); const original = apply(store, [company('STUDIO')]).state;
    const created = apply(store, [agent(original.companies[0]!.id)]);
    const preview = store.previewUndo(created.changeId, created.state.revision);
    expect(preview.changes).toHaveLength(2);
    expect(preview.changes[0]).toContain('Remove agent "Analyst"');
    expect(preview.changes[0]).toContain('Instructions: "Cite the supporting evidence."');
    expect(preview.changes[1]).toContain('Remove assignment'); expect(preview.changes[1]).toContain('Primary: true');
    expect(preview.changes.some(line => line.startsWith('Remove company'))).toBe(false);
    const restored = store.undo(preview.changeId, preview.baseRevision);
    expect(config(restored)).toEqual(config(original));
  });

  it('reviews and restores archive effects on status, dated assignments, and relationships', () => {
    const { store } = open(); const companies = apply(store, [company('STUDIO'), company('PARTNER')]).state.companies;
    apply(store, [agent(companies[0]!.id)]);
    apply(store, [{ type: 'relationship.create', input: { fromCompanyId: companies[0]!.id, toCompanyId: companies[1]!.id, kind: 'collaboration', percentage: null, description: 'Research partnership' } }]);
    const original = store.snapshot(); const archived = apply(store, [{ type: 'company.archive', id: companies[0]!.id }]);
    const preview = store.previewUndo(archived.changeId, archived.state.revision);
    expect(preview.changes.filter(line => line.includes('Status: "archived" → "active"'))).toHaveLength(2);
    const assignment = preview.changes.find(line => line.startsWith('Restore assignment'))!;
    expect(assignment).toContain(`Ended at: ${JSON.stringify(archived.state.assignments[0]!.endedAt)} → null`);
    const relationship = preview.changes.find(line => line.startsWith('Restore relationship'))!;
    expect(relationship).toContain(`Ended at: ${JSON.stringify(archived.state.relationships[0]!.endedAt)} → null`);
    expect(preview.changes.some(line => line.startsWith('Restore company "PARTNER"'))).toBe(false);
    expect(config(store.undo(preview.changeId, preview.baseRevision))).toEqual(config(original));
  });

  it('rejects a stale confirmation after another change and preserves the intervening state', () => {
    const { store } = open(); const created = apply(store, [company('STUDIO')]);
    const preview = store.previewUndo(created.changeId, created.state.revision);
    const intervening = apply(store, [company('PARTNER')]).state;
    expect(() => store.undo(preview.changeId, preview.baseRevision)).toThrow(expect.objectContaining({ code: 'STALE_PREVIEW' }));
    expect(() => store.previewUndo(preview.changeId, preview.baseRevision)).toThrow(expect.objectContaining({ code: 'STALE_PREVIEW' }));
    expect(() => store.previewUndo(preview.changeId, intervening.revision)).toThrow(expect.objectContaining({ code: 'UNDO_UNAVAILABLE' }));
    expect(store.snapshot()).toEqual(intervening);
  });

  it('uses the same eligibility checks for missing, permanent, and already undone changes', () => {
    const { store } = open();
    expect(() => store.previewUndo('missing', 0)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(() => store.previewUndo('missing', -1)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    const companyId = apply(store, [company('STUDIO')]).state.companies[0]!.id;
    const created = apply(store, [agent(companyId)]); const agentId = created.state.agents[0]!.id;
    const work = apply(store, [{ type: 'work.record', input: { companyId, agentId, title: 'Permanent evidence', output: 'A complete useful result', provenance: 'codex', status: 'submitted', durationMs: 10, runId: 'undo-test-work' } }]);
    expect(() => store.previewUndo(work.changeId, work.state.revision)).toThrow(expect.objectContaining({ code: 'UNDO_UNAVAILABLE' }));
    const update = apply(store, [{ type: 'company.update', id: companyId, input: { name: 'Revised studio' } }]);
    const preview = store.previewUndo(update.changeId, update.state.revision); const restored = store.undo(preview.changeId, preview.baseRevision);
    expect(() => store.previewUndo(update.changeId, restored.revision)).toThrow(expect.objectContaining({ code: 'UNDO_UNAVAILABLE' }));
    expect(() => store.previewUndo(restored.history[0]!.id, restored.revision)).toThrow(expect.objectContaining({ code: 'UNDO_UNAVAILABLE' }));
    expect(restored.work).toEqual(work.state.work);
  });
});
