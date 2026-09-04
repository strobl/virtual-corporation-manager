// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
/**
 * Internal Org Chart derivations (pure).
 *
 * A corporation is NOT the same thing as the org chart inside it. This module
 * only ever answers the second question — "inside ONE virtual corporation, who
 * is above whom?" — over people and agents that hold an active assignment to
 * that corporation. Ownership, holdings and PropCos never appear here.
 *
 * The hierarchy comes from `managerId`. A manager outside the corporation is
 * ignored (the member becomes a local root), and reporting cycles are broken
 * deterministically so a bad row can never hang a render.
 */
import type { WorkspaceSnapshot } from "./tree";

export type PersonKind = "human" | "agent";

export interface OrgPerson {
  id: string;
  name: string;
  role: string;
  kind: PersonKind;
  department: string | null;
  /** Manager inside THIS corporation, or null when this person is a local top. */
  managerId: string | null;
  /** 0 = corporation lead, 1 = department heads, and so on. */
  level: number;
  directReportIds: string[];
  /** Everyone below, at any depth. */
  totalReports: number;
  /** Ids from the top of the chain down to (and excluding) this person. */
  chain: string[];
}

export interface OrgPyramid {
  corporationId: string;
  people: OrgPerson[];
  byId: Map<string, OrgPerson>;
  /** People per level, ordered top-down; index is the level. */
  levels: OrgPerson[][];
  rootIds: string[];
  departments: string[];
  counts: { people: number; humans: number; agents: number; departments: number; depth: number };
}

const EMPTY: OrgPyramid = {
  corporationId: "",
  people: [],
  byId: new Map(),
  levels: [],
  rootIds: [],
  departments: [],
  counts: { people: 0, humans: 0, agents: 0, departments: 0, depth: 0 },
};

export function emptyPyramid(corporationId = ""): OrgPyramid {
  return { ...EMPTY, corporationId, byId: new Map(), levels: [], people: [], rootIds: [] };
}

function asKind(value: string | null | undefined): PersonKind {
  return value === "agent" ? "agent" : "human";
}

export function buildOrgPyramid(
  snapshot: WorkspaceSnapshot,
  corporationId: string | null,
): OrgPyramid {
  if (!corporationId) return emptyPyramid("");

  const memberIds = new Set(
    snapshot.assignments
      .filter((assignment) => assignment.corporationId === corporationId)
      .map((assignment) => assignment.teamMemberId),
  );

  const people: OrgPerson[] = snapshot.members
    .filter((member) => memberIds.has(member.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role ?? "",
      kind: asKind(member.kind ?? null),
      department: (member.department ?? null) || null,
      managerId: null,
      level: 0,
      directReportIds: [],
      totalReports: 0,
      chain: [],
    }));

  const byId = new Map(people.map((person) => [person.id, person]));

  // Only keep reporting lines that stay inside this corporation.
  for (const member of snapshot.members) {
    const person = byId.get(member.id);
    if (!person) continue;
    const managerId = member.managerId ?? null;
    if (managerId && managerId !== person.id && byId.has(managerId)) {
      person.managerId = managerId;
    }
  }

  // Break cycles: anyone whose chain loops back becomes a local root.
  for (const person of people) {
    const seen = new Set<string>([person.id]);
    let cursor = person.managerId;
    while (cursor) {
      if (seen.has(cursor)) {
        person.managerId = null;
        break;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.managerId ?? null;
    }
  }

  for (const person of people) {
    if (person.managerId) byId.get(person.managerId)?.directReportIds.push(person.id);
  }
  for (const person of people) {
    person.directReportIds.sort((a, b) =>
      (byId.get(a)?.name ?? "").localeCompare(byId.get(b)?.name ?? ""),
    );
  }

  const rootIds = people.filter((person) => person.managerId === null).map((p) => p.id);

  // Levels and chains from the roots down.
  const walk = (id: string, level: number, chain: string[]) => {
    const person = byId.get(id);
    if (!person) return 0;
    person.level = level;
    person.chain = chain;
    let below = 0;
    for (const childId of person.directReportIds) {
      below += 1 + walk(childId, level + 1, [...chain, id]);
    }
    person.totalReports = below;
    return below;
  };
  for (const rootId of rootIds) walk(rootId, 0, []);

  const depth = people.reduce((max, person) => Math.max(max, person.level), 0);
  const levels: OrgPerson[][] = Array.from({ length: people.length ? depth + 1 : 0 }, () => []);
  for (const person of people) levels[person.level]?.push(person);
  for (const row of levels) {
    row.sort(
      (a, b) =>
        b.totalReports - a.totalReports ||
        (a.department ?? "").localeCompare(b.department ?? "") ||
        a.name.localeCompare(b.name),
    );
  }

  const departments = [
    ...new Set(people.map((person) => person.department).filter((d): d is string => Boolean(d))),
  ].sort((a, b) => a.localeCompare(b));

  return {
    corporationId,
    people,
    byId,
    levels,
    rootIds,
    departments,
    counts: {
      people: people.length,
      humans: people.filter((p) => p.kind === "human").length,
      agents: people.filter((p) => p.kind === "agent").length,
      departments: departments.length,
      depth: people.length ? depth + 1 : 0,
    },
  };
}

export interface PyramidFilters {
  query: string;
  kind: "all" | PersonKind;
  department: string;
  /** Highest level index still rendered; null shows every level. */
  maxLevel: number | null;
}

export const EMPTY_PYRAMID_FILTERS: PyramidFilters = {
  query: "",
  kind: "all",
  department: "all",
  maxLevel: null,
};

export function matchesPerson(person: OrgPerson, filters: PyramidFilters): boolean {
  if (filters.kind !== "all" && person.kind !== filters.kind) return false;
  if (filters.department !== "all" && (person.department ?? "") !== filters.department)
    return false;
  if (filters.maxLevel !== null && person.level > filters.maxLevel) return false;
  const query = filters.query.trim().toLowerCase();
  if (query === "") return true;
  return (
    person.name.toLowerCase().includes(query) ||
    person.role.toLowerCase().includes(query) ||
    (person.department ?? "").toLowerCase().includes(query)
  );
}

export function filterPyramid(pyramid: OrgPyramid, filters: PyramidFilters): OrgPerson[][] {
  return pyramid.levels.map((row) => row.filter((person) => matchesPerson(person, filters)));
}

/** Ids on the command chain of `personId`, including the person itself. */
export function commandChain(pyramid: OrgPyramid, personId: string | null): Set<string> {
  if (!personId) return new Set();
  const person = pyramid.byId.get(personId);
  if (!person) return new Set();
  return new Set([...person.chain, person.id]);
}

/** Tree rows for the alternative Tree view, depth-first from every root. */
export interface PyramidTreeRow {
  person: OrgPerson;
  depth: number;
}

export function pyramidTreeRows(
  pyramid: OrgPyramid,
  collapsedIds: ReadonlySet<string>,
): PyramidTreeRow[] {
  const rows: PyramidTreeRow[] = [];
  const walk = (id: string, depth: number) => {
    const person = pyramid.byId.get(id);
    if (!person) return;
    rows.push({ person, depth });
    if (collapsedIds.has(id)) return;
    for (const childId of person.directReportIds) walk(childId, depth + 1);
  };
  for (const rootId of pyramid.rootIds) walk(rootId, 0);
  return rows;
}
