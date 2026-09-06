import type { ChangePreview, DomainCommand, WorkspaceState } from '../domain/contracts';
import { ApiError, client } from './client';

export type PendingChange =
  | { kind: 'commands'; commands: DomainCommand[]; summary: string }
  | { kind: 'template'; id: string };
export type ApplyRecovery = 'retry' | 'refresh';
export interface PendingApply {
  preview: ChangePreview;
  companyIds: string[];
  change: PendingChange | null;
  corporationSetup: boolean;
}
export const PENDING_APPLY_KEY = 'vcm.pending-configuration-apply';

/** Only a definite rejection allows replacing the saved preview receipt. */
export function applyRecovery(error: unknown): ApplyRecovery {
  return error instanceof ApiError && ['STALE_PREVIEW', 'NOT_FOUND'].includes(error.code)
    ? 'refresh'
    : 'retry';
}

/** Refresh a rejected base without replacing the owner's entered definition. */
export async function prepareRecoverableChange(
  change: PendingChange,
  base: WorkspaceState,
  onRefreshed: (state: WorkspaceState) => void,
  gateway: Pick<typeof client, 'preview' | 'template' | 'state'> = client,
) {
  const make = (state: WorkspaceState) =>
    change.kind === 'template'
      ? gateway.template(change.id, state.revision)
      : gateway.preview(change.commands, state.revision, change.summary);
  let baseState = base;
  let preview: ChangePreview;
  try {
    preview = await make(baseState);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'STALE_PREVIEW') throw error;
    baseState = await gateway.state();
    onRefreshed(baseState);
    preview = await make(baseState);
  }
  return { preview, baseState };
}

export function readPendingApply(storage: Pick<Storage, 'getItem'>): PendingApply | null {
  try {
    const saved = JSON.parse(storage.getItem(PENDING_APPLY_KEY) ?? 'null') as PendingApply | null;
    if (
      !saved ||
      typeof saved.preview?.id !== 'string' ||
      typeof saved.preview.summary !== 'string' ||
      !Array.isArray(saved.preview.changes) ||
      !saved.preview.changes.every((row) => typeof row === 'string') ||
      !Array.isArray(saved.companyIds) ||
      !saved.companyIds.every((id) => typeof id === 'string')
    )
      return null;
    return saved;
  } catch {
    return null;
  }
}
