/** Adapted from the private GitFlash prototype's pure ownership graph rules.
 * Only graph traversal and percentage semantics are retained; no hosted state.
 */
export interface DirectedEdge {
  fromCompanyId: string;
  toCompanyId: string;
}

export function findActivePath(
  edges: readonly DirectedEdge[],
  from: string,
  to: string,
): string[] | null {
  const queue: string[][] = [[from]];
  const seen = new Set<string>([from]);
  for (let index = 0; index < queue.length; index += 1) {
    const path = queue[index]!;
    const node = path[path.length - 1]!;
    if (node === to && path.length > 1) return path;
    for (const edge of edges) {
      if (edge.fromCompanyId !== node) continue;
      if (edge.toCompanyId === to) return [...path, to];
      if (seen.has(edge.toCompanyId)) continue;
      seen.add(edge.toCompanyId);
      queue.push([...path, edge.toCompanyId]);
    }
  }
  return null;
}

export function isValidPercentage(percentage: unknown): percentage is number | null {
  return (
    percentage === null ||
    (typeof percentage === 'number' &&
      Number.isFinite(percentage) &&
      percentage > 0 &&
      percentage <= 100)
  );
}
