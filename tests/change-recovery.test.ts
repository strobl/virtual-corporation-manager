import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTemplate } from '../src/company/templates';
import { createWorkspaceStore } from '../src/db/store';
import type { DomainCommand, WorkspaceStore } from '../src/domain/contracts';
import { DomainError } from '../src/domain/errors';
import { ApiError } from '../src/web/client';
import {
  applyRecovery,
  PENDING_APPLY_KEY,
  prepareRecoverableChange,
  readPendingApply,
  type PendingApply,
  type PendingChange,
} from '../src/web/change-recovery';

const stores: WorkspaceStore[] = [];
const directories: string[] = [];
function open(directory = mkdtempSync(join(tmpdir(), 'vcm-change-recovery-'))) {
  if (!directories.includes(directory)) directories.push(directory);
  const store = createWorkspaceStore(directory);
  stores.push(store);
  return { store, directory };
}
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

/** Exercise the real store while preserving the frontend's HTTP error contract. */
async function transport<T>(run: () => T): Promise<T> {
  try {
    return run();
  } catch (error) {
    if (error instanceof DomainError) throw new ApiError(error.code, error.message);
    throw error;
  }
}
function gateway(store: WorkspaceStore) {
  return {
    state: vi.fn(() => transport(() => store.snapshot())),
    preview: vi.fn((commands: DomainCommand[], revision: number, summary: string) =>
      transport(() => store.preview(commands, revision, summary)),
    ),
    template: vi.fn((id: string, revision: number) =>
      transport(() =>
        store.preview(
          [{ type: 'definition.import', definition: getTemplate(id) }],
          revision,
          `Create ${id} company`,
        ),
      ),
    ),
    apply: (id: string) => transport(() => store.apply(id)),
  };
}
function addCompany(store: WorkspaceStore, shortCode: string) {
  return store.apply(
    store.preview(
      [
        {
          type: 'company.create',
          input: { name: `Company ${shortCode}`, shortCode, description: '', color: '#256c5b' },
        },
      ],
      store.snapshot().revision,
    ).id,
  );
}
function ownerChange(): Extract<PendingChange, { kind: 'commands' }> {
  const definition = structuredClone(getTemplate('product-studio'));
  definition.companies[0].name = 'Owner-defined Corporation C';
  definition.companies[0].shortCode = 'CUSTOM-C';
  definition.companies[0].description = 'Keep the entered purpose after recovery.';
  definition.agents[0].instructions = 'Keep the owner-defined operating instructions.';
  return {
    kind: 'commands',
    commands: [{ type: 'definition.import', definition }],
    summary: 'Create the reviewed owner-defined corporation',
  };
}

describe('configuration review and apply recovery', () => {
  it('refreshes a stale first review without replacing the entered definition or company baseline', async () => {
    const { store } = open();
    const initial = store.snapshot();
    const change = ownerChange();
    const originalChange = structuredClone(change);
    const fresh = addCompany(store, 'A').state;
    const api = gateway(store);
    const onRefreshed = vi.fn();

    const prepared = await prepareRecoverableChange(change, initial, onRefreshed, api);

    expect(api.preview.mock.calls).toEqual([
      [originalChange.commands, initial.revision, originalChange.summary],
      [originalChange.commands, fresh.revision, originalChange.summary],
    ]);
    expect(api.state).toHaveBeenCalledTimes(1);
    expect(onRefreshed).toHaveBeenCalledExactlyOnceWith(fresh);
    expect(prepared.baseState).toEqual(fresh);
    expect(prepared.baseState.companies.map((company) => company.id)).toEqual([
      fresh.companies[0].id,
    ]);
    expect(prepared.preview.baseRevision).toBe(fresh.revision);
    expect(change).toEqual(originalChange);
    expect(store.snapshot()).toEqual(fresh);

    const applied = await api.apply(prepared.preview.id);
    expect(
      applied.state.companies.find((company) => company.shortCode === 'CUSTOM-C'),
    ).toMatchObject({
      name: 'Owner-defined Corporation C',
      description: 'Keep the entered purpose after recovery.',
    });
    expect(applied.state.agents[0].instructions).toBe(
      'Keep the owner-defined operating instructions.',
    );
  });

  it('replays the saved preview after a committed apply loses its response, including after reopening SQLite', async () => {
    const { store, directory } = open();
    const change = ownerChange();
    const api = gateway(store);
    const prepared = await prepareRecoverableChange(change, store.snapshot(), vi.fn(), api);
    const pending: PendingApply = {
      preview: prepared.preview,
      companyIds: prepared.baseState.companies.map((company) => company.id),
      change,
      corporationSetup: true,
    };
    const saved = new Map([[PENDING_APPLY_KEY, JSON.stringify(pending)]]);
    const lostResponse = new TypeError('Connection ended after the apply committed.');
    await expect(
      (async () => {
        await api.apply(pending.preview.id);
        throw lostResponse;
      })(),
    ).rejects.toBe(lostResponse);
    expect(applyRecovery(lostResponse)).toBe('retry');
    const committed = store.snapshot();
    expect(committed.companies).toHaveLength(1);
    store.close();

    const reopened = open(directory).store;
    const restored = readPendingApply({ getItem: (key) => saved.get(key) ?? null });
    expect(restored).toEqual(pending);
    const replay = await gateway(reopened).apply(restored!.preview.id);
    expect(replay.replayed).toBe(true);
    expect(replay.changeId).toBe(committed.history[0].id);
    expect(replay.state).toEqual(committed);

    // Rebuilding the same import would be a second creation, not an apply retry.
    const duplicatePreview = reopened.preview(
      change.commands,
      replay.state.revision,
      change.summary,
    );
    const duplicate = reopened.apply(duplicatePreview.id);
    expect(duplicate.state.companies.map((company) => company.shortCode)).toEqual([
      'CUSTOM-C',
      'CUSTOM-C-2',
    ]);
  });

  it('excludes an unrelated company from setup completion after refreshing a rejected apply', async () => {
    const { store } = open();
    const originalBase = addCompany(store, 'A').state;
    const change = ownerChange();
    const api = gateway(store);
    const first = await prepareRecoverableChange(change, originalBase, vi.fn(), api);
    const intervening = addCompany(store, 'B').state;
    const rejected = await api.apply(first.preview.id).catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(ApiError);
    expect(rejected).toMatchObject({ code: 'STALE_PREVIEW' });
    expect(applyRecovery(rejected)).toBe('refresh');
    expect(store.snapshot()).toEqual(intervening);

    const refreshed = await prepareRecoverableChange(change, first.baseState, vi.fn(), api);
    expect(refreshed.preview.id).not.toBe(first.preview.id);
    expect(refreshed.baseState).toEqual(intervening);
    const companyIds = refreshed.baseState.companies.map((company) => company.id);
    const result = await api.apply(refreshed.preview.id);
    const created = result.state.companies.filter((company) => !companyIds.includes(company.id));
    expect(created).toHaveLength(1);
    expect(created[0].shortCode).toBe('CUSTOM-C');
    expect(result.state.companies.filter((company) => companyIds.includes(company.id))).toEqual(
      intervening.companies,
    );
  });

  it('attributes no created company to a replayed edit after another company was added', async () => {
    const { store } = open();
    const original = addCompany(store, 'A').state;
    const companyA = original.companies[0];
    const change: PendingChange = {
      kind: 'commands',
      commands: [{ type: 'company.update', id: companyA.id, input: { name: 'Updated A' } }],
      summary: 'Rename company A',
    };
    const api = gateway(store);
    const prepared = await prepareRecoverableChange(change, original, vi.fn(), api);
    const saved = JSON.stringify({
      preview: prepared.preview,
      companyIds: prepared.baseState.companies.map((company) => company.id),
      change,
      corporationSetup: false,
    } satisfies PendingApply);
    const lostResponse = new TypeError('The company edit committed before the response was lost.');
    await expect(
      (async () => {
        await api.apply(prepared.preview.id);
        throw lostResponse;
      })(),
    ).rejects.toBe(lostResponse);
    const committed = store.snapshot();
    expect(committed.companies[0].name).toBe('Updated A');
    const intervening = addCompany(store, 'B').state;
    expect(intervening.companies.map((company) => company.shortCode)).toEqual(['A', 'B']);

    const restored = readPendingApply({ getItem: () => saved });
    const replay = await api.apply(restored!.preview.id);
    expect(replay.replayed).toBe(true);
    expect(replay.changeId).toBe(committed.history[0].id);
    expect(replay.createdCompanyIds).toEqual([]);
    expect(replay.state).toEqual(intervening);
    expect(store.snapshot()).toEqual(intervening);
  });

  it('retains the original creation IDs after undo without attributing a later company to replay', async () => {
    const { store, directory } = open();
    const change = ownerChange();
    const api = gateway(store);
    const prepared = await prepareRecoverableChange(change, store.snapshot(), vi.fn(), api);
    const saved = JSON.stringify({
      preview: prepared.preview,
      companyIds: [],
      change,
      corporationSetup: true,
    } satisfies PendingApply);
    const lostResponse = new TypeError(
      'The corporation import committed before its response was lost.',
    );
    await expect(
      (async () => {
        await api.apply(prepared.preview.id);
        throw lostResponse;
      })(),
    ).rejects.toBe(lostResponse);
    const committed = store.snapshot();
    const companyC = committed.companies[0];
    expect(companyC.shortCode).toBe('CUSTOM-C');
    const undone = store.undo(committed.history[0].id, committed.revision);
    expect(undone.companies).toEqual([]);
    const intervening = addCompany(store, 'B').state;
    const companyB = intervening.companies[0];
    expect(companyB.shortCode).toBe('B');
    store.close();

    const reopened = open(directory).store;
    const restored = readPendingApply({ getItem: () => saved });
    const replay = await gateway(reopened).apply(restored!.preview.id);
    expect(replay.replayed).toBe(true);
    expect(replay.changeId).toBe(committed.history[0].id);
    expect(replay.createdCompanyIds).toEqual([companyC.id]);
    expect(replay.createdCompanyIds).not.toContain(companyB.id);
    expect(replay.state.companies.some((company) => company.id === companyC.id)).toBe(false);
    expect(replay.state).toEqual(intervening);
    expect(reopened.snapshot()).toEqual(intervening);
  });

  it('refreshes template review but permits replacing an apply receipt only after definite rejection', async () => {
    const { store } = open();
    const initial = store.snapshot();
    const fresh = addCompany(store, 'A').state;
    const api = gateway(store);
    const prepared = await prepareRecoverableChange(
      { kind: 'template', id: 'product-studio' },
      initial,
      vi.fn(),
      api,
    );
    expect(api.template.mock.calls).toEqual([
      ['product-studio', initial.revision],
      ['product-studio', fresh.revision],
    ]);
    expect(api.preview).not.toHaveBeenCalled();
    expect(prepared.baseState).toEqual(fresh);

    const missing = await api.apply('missing-preview').catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(ApiError);
    expect(missing).toMatchObject({ code: 'NOT_FOUND' });
    expect(applyRecovery(missing)).toBe('refresh');
    expect(applyRecovery(new ApiError('INTERNAL_ERROR', 'Commit outcome is unknown.'))).toBe(
      'retry',
    );
    expect(applyRecovery({ code: 'STALE_PREVIEW' })).toBe('retry');
  });

  it('rejects missing, corrupt or malformed saved receipts without reading unrelated storage', () => {
    const { store } = open();
    const preview = store.preview(ownerChange().commands, store.snapshot().revision);
    const pending: PendingApply = {
      preview,
      companyIds: [],
      change: null,
      corporationSetup: false,
    };
    const getItem = vi.fn(() => JSON.stringify(pending));
    expect(readPendingApply({ getItem })).toEqual(pending);
    expect(getItem).toHaveBeenCalledExactlyOnceWith(PENDING_APPLY_KEY);
    for (const value of [
      null,
      '{broken json',
      'null',
      '{}',
      JSON.stringify({ ...pending, preview: { ...preview, id: 3 } }),
      JSON.stringify({ ...pending, preview: { ...preview, changes: [null] } }),
      JSON.stringify({ ...pending, companyIds: [42] }),
    ]) {
      expect(readPendingApply({ getItem: () => value })).toBeNull();
    }
    expect(
      readPendingApply({
        getItem: () => {
          throw new Error('Storage unavailable.');
        },
      }),
    ).toBeNull();
  });
});
