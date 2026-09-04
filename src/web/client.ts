import type {
  ApplyResult,
  ChangePreview,
  DomainCommand,
  TemplateSummary,
  WorkspaceState,
} from '../domain/contracts';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface UndoPreview {
  changeId: string;
  baseRevision: number;
  summary: string;
  changes: string[];
}

let session: Promise<string> | null = null;
async function token(): Promise<string> {
  session ??= fetch('/api/session', { credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) throw new Error('Could not connect to the local server.');
      return (await response.json()).token as string;
    })
    .catch((error) => {
      session = null;
      throw error;
    });
  return session;
}

export async function request<T>(path: string, body?: unknown, retrySession = true): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers:
      body === undefined
        ? {}
        : {
            'Content-Type': 'application/json',
            'X-GitFlash-Token': await token(),
          },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (
    !response.ok &&
    body !== undefined &&
    retrySession &&
    String(data.error?.code).toLowerCase() === 'invalid_session'
  ) {
    session = null;
    return request<T>(path, body, false);
  }
  if (!response.ok)
    throw new ApiError(
      data.error?.code ?? 'request_failed',
      data.error?.message ?? 'The local server could not complete this request.',
    );
  return data as T;
}

export const client = {
  state: () => request<WorkspaceState>('/api/state'),
  templates: () => request<TemplateSummary[]>('/api/templates'),
  preview: (commands: DomainCommand[], baseRevision: number, summary: string) =>
    request<ChangePreview>('/api/preview', { commands, baseRevision, summary }),
  template: (id: string, baseRevision: number) =>
    request<ChangePreview>(`/api/templates/${encodeURIComponent(id)}/preview`, {
      baseRevision,
    }),
  apply: (previewId: string) => request<ApplyResult>('/api/apply', { previewId }),
  undo: (changeId: string, baseRevision: number) =>
    request<WorkspaceState>('/api/undo', { changeId, baseRevision }),
  undoPreview: (changeId: string, baseRevision: number) =>
    request<UndoPreview>('/api/undo/preview', { changeId, baseRevision }),
};
