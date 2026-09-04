export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'DomainError';
  }
}

export function requireDomain(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
