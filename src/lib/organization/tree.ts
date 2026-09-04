// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
/**
 * WO-24 Workspace Tree composition (pure).
 *
 * The tree is derived, never stored: the Workspace is the top node, active
 * root corporations hang from it, every active owned corporation appears
 * under EVERY active owner (duplicates beyond the first are marked shared),
 * assigned Team Members appear under every corporation with a covering active
 * Assignment, and — under All and Assets only — active Factories appear under
 * their current lessee or, when vacant, under their owner.
 *
 * The Operating lens hides Factories and Plant Tiles; it never hides an
 * active corporation or an assigned member.
 *
 * Every row carries a stable path id so the same entity appearing under two
 * owners can be expanded independently while still sharing one Selection.
 */
import type { Lens, Selection, SelectionEntityType } from '@/types/organization-view';

/** Declared legal nature of an entity; independent of what it operates. */
export const ENTITY_TYPES = ['holding', 'opco', 'propco', 'serviceco', 'spv', 'other'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  holding: 'Holding',
  opco: 'OpCo',
  propco: 'PropCo',
  serviceco: 'ServiceCo',
  spv: 'SPV',
  other: 'Entity',
};

export function asEntityType(value: string | null | undefined): EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value ?? '')
    ? (value as EntityType)
    : 'other';
}

/** Non-ownership, non-assignment links between entities. */
export const RELATION_KINDS = [
  'operates',
  'manages',
  'provides_services_to',
  'finances',
  'leases_to',
  'licenses',
  'participates_in',
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const RELATION_LABELS: Record<RelationKind, string> = {
  operates: 'operates',
  manages: 'manages',
  provides_services_to: 'provides services to',
  finances: 'finances',
  leases_to: 'leases to',
  licenses: 'licenses',
  participates_in: 'participates in',
};

export interface CorporationRow {
  id: string;
  name: string;
  shortCode: string;
  /** Registry accent colour (hex) or null when the owner set none. */
  color?: string | null;
  /** Declared legal nature; defaults to `other` for older rows. */
  entityType?: string | null;
}

export interface OwnershipEdgeRow {
  ownerCorporationId: string;
  ownedCorporationId: string;
  /** Declared stake, or null when the owner never recorded one. */
  percentage?: number | null;
}

export interface MemberRow {
  id: string;
  name: string;
  shortCode?: string | null;
  role?: string | null;
  /** `human` or `agent`. */
  kind?: string | null;
  /** Internal org chart: who this person reports to, workspace-wide. */
  managerId?: string | null;
  /** Internal org chart: optional department / team label. */
  department?: string | null;
}

export interface AssignmentRow {
  teamMemberId: string;
  corporationId: string;
  isPrimary: boolean;
}

export interface FactoryRow {
  id: string;
  name: string;
  shortCode: string;
  /** Current active owner. */
  ownerCorporationId: string | null;
}

export interface RelationshipRow {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relation: string;
  note?: string | null;
}

export interface WorkspaceSnapshot {
  workspaceName: string;
  /** Active rows only — the server filters status. */
  corporations: readonly CorporationRow[];
  ownership: readonly OwnershipEdgeRow[];
  members: readonly MemberRow[];
  assignments: readonly AssignmentRow[];
  factories: readonly FactoryRow[];
  /** Operational links; empty for snapshots produced before they existed. */
  relationships?: readonly RelationshipRow[];
}

export const EMPTY_SNAPSHOT: WorkspaceSnapshot = {
  workspaceName: 'Workspace',
  corporations: [],
  ownership: [],
  members: [],
  assignments: [],
  factories: [],
  relationships: [],
};

export type TreeNodeKind = 'workspace' | SelectionEntityType;

export interface OrgTreeNode {
  /** Stable path-scoped row id (unique per row). */
  id: string;
  kind: TreeNodeKind;
  /** Domain entity id; shared by every row showing the same entity. */
  entityId: string;
  label: string;
  shortCode: string | null;
  /** Registry accent colour (hex) for corporation rows; null otherwise. */
  color?: string | null;
  /** True when this corporation has more than one active owner. */
  shared: boolean;
  children: OrgTreeNode[];
}

export const WORKSPACE_NODE_ID = 'workspace';

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

/** Selection targets for a node; the Workspace node is not selectable. */
export function nodeSelection(node: OrgTreeNode): Selection | null {
  if (node.kind === 'workspace') return null;
  return { type: node.kind, id: node.entityId };
}

export function buildWorkspaceTree(snapshot: WorkspaceSnapshot, lens: Lens = 'all'): OrgTreeNode[] {
  const showFactories = lens === 'all' || lens === 'assets';
  const showMembers = lens === 'all' || lens === 'operating';

  const corporations = [...snapshot.corporations].sort(byName);
  const active = new Set(corporations.map((c) => c.id));
  const edges = snapshot.ownership.filter(
    (e) => active.has(e.ownerCorporationId) && active.has(e.ownedCorporationId),
  );

  const ownersOf = new Map<string, string[]>();
  const ownedBy = new Map<string, string[]>();
  for (const edge of edges) {
    ownersOf.set(edge.ownedCorporationId, [
      ...(ownersOf.get(edge.ownedCorporationId) ?? []),
      edge.ownerCorporationId,
    ]);
    ownedBy.set(edge.ownerCorporationId, [
      ...(ownedBy.get(edge.ownerCorporationId) ?? []),
      edge.ownedCorporationId,
    ]);
  }

  const membersById = new Map(snapshot.members.map((m) => [m.id, m]));
  const membersOf = new Map<string, MemberRow[]>();
  for (const assignment of snapshot.assignments) {
    const member = membersById.get(assignment.teamMemberId);
    if (!member || !active.has(assignment.corporationId)) continue;
    const list = membersOf.get(assignment.corporationId) ?? [];
    if (!list.some((m) => m.id === member.id)) list.push(member);
    membersOf.set(assignment.corporationId, list);
  }

  const factoriesOf = new Map<string, FactoryRow[]>();
  for (const factory of snapshot.factories) {
    const host = factory.ownerCorporationId;
    if (!host || !active.has(host)) continue;
    factoriesOf.set(host, [...(factoriesOf.get(host) ?? []), factory]);
  }

  const build = (
    corporation: CorporationRow,
    path: string,
    ancestors: Set<string>,
  ): OrgTreeNode => {
    const id = `${path}/corporation:${corporation.id}`;
    const owners = ownersOf.get(corporation.id) ?? [];
    const node: OrgTreeNode = {
      id,
      kind: 'corporation',
      entityId: corporation.id,
      label: corporation.name,
      shortCode: corporation.shortCode,
      color: corporation.color ?? null,
      shared: owners.length > 1,
      children: [],
    };
    // A cycle can never be committed (WO-37), but the tree still refuses to
    // recurse through an ancestor rather than trusting the data.
    const nextAncestors = new Set(ancestors).add(corporation.id);

    if (showMembers) {
      for (const member of [...(membersOf.get(corporation.id) ?? [])].sort(byName)) {
        node.children.push({
          id: `${id}/member:${member.id}`,
          kind: 'member',
          entityId: member.id,
          label: member.name,
          shortCode: member.shortCode ?? null,
          shared: false,
          children: [],
        });
      }
    }

    const owned = (ownedBy.get(corporation.id) ?? [])
      .map((childId) => corporations.find((c) => c.id === childId))
      .filter((c): c is CorporationRow => Boolean(c) && !ancestors.has((c as CorporationRow).id))
      .sort(byName);
    for (const child of owned) node.children.push(build(child, id, nextAncestors));

    if (showFactories) {
      for (const factory of [...(factoriesOf.get(corporation.id) ?? [])].sort(byName)) {
        node.children.push({
          id: `${id}/factory:${factory.id}`,
          kind: 'factory',
          entityId: factory.id,
          label: factory.name,
          shortCode: factory.shortCode,
          shared: false,
          children: [],
        });
      }
    }
    return node;
  };

  // A corporation with no active owner is a root.
  const roots = corporations.filter((c) => (ownersOf.get(c.id) ?? []).length === 0);
  const workspaceNode: OrgTreeNode = {
    id: WORKSPACE_NODE_ID,
    kind: 'workspace',
    entityId: WORKSPACE_NODE_ID,
    label: snapshot.workspaceName,
    shortCode: null,
    shared: false,
    children: roots.map((root) => build(root, WORKSPACE_NODE_ID, new Set())),
  };
  return [workspaceNode];
}

export interface FlatRow {
  node: OrgTreeNode;
  level: number;
  parentId: string | null;
}

export function flattenVisible(
  nodes: readonly OrgTreeNode[],
  expanded: ReadonlySet<string>,
  level = 1,
  parentId: string | null = null,
  out: FlatRow[] = [],
): FlatRow[] {
  for (const node of nodes) {
    out.push({ node, level, parentId });
    if (node.children.length > 0 && expanded.has(node.id)) {
      flattenVisible(node.children, expanded, level + 1, node.id, out);
    }
  }
  return out;
}

/** Every node id, used to expand-all or to reveal a hidden selection. */
export function allNodeIds(nodes: readonly OrgTreeNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    out.push(node.id);
    allNodeIds(node.children, out);
  }
  return out;
}

/** Rows (path ids) for one entity, in document order. */
export function rowsForEntity(
  nodes: readonly OrgTreeNode[],
  selection: Selection | null,
  out: string[] = [],
): string[] {
  if (!selection) return out;
  for (const node of nodes) {
    if (node.kind === selection.type && node.entityId === selection.id) out.push(node.id);
    rowsForEntity(node.children, selection, out);
  }
  return out;
}

/**
 * Ancestor node ids that must be expanded for EVERY row of `selection` to
 * become visible — a shared corporation appears under each of its owners, and
 * all of those rows must read as selected. Empty when the entity is absent
 * under the current Lens.
 */
export function ancestorsToReveal(
  nodes: readonly OrgTreeNode[],
  selection: Selection | null,
): string[] {
  const ancestors = new Set<string>();
  for (const rowId of rowsForEntity(nodes, selection)) {
    const parts = rowId.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      ancestors.add(parts.slice(0, index).join('/'));
    }
  }
  return [...ancestors];
}

export const TYPEAHEAD_RESET_MS = 1_000;

/**
 * Buffered consecutive-character typeahead over the VISIBLE rows, matching
 * name or short code, case-insensitively, wrapping from just after the
 * current row. Returns `null` on no match so focus does not move.
 */
export function matchTypeahead(
  rows: readonly FlatRow[],
  buffer: string,
  currentIndex: number,
): string | null {
  const needle = buffer.trim().toLowerCase();
  if (needle === '' || rows.length === 0) return null;
  // A repeated single character cycles through matches; a longer buffer may
  // still match the current row (the user is refining it).
  const start = buffer.length === 1 ? currentIndex + 1 : currentIndex;
  for (let step = 0; step < rows.length; step += 1) {
    const row = rows[(start + step + rows.length) % rows.length];
    if (!row) continue;
    const name = row.node.label.toLowerCase();
    const code = (row.node.shortCode ?? '').toLowerCase();
    if (name.startsWith(needle) || (code !== '' && code.startsWith(needle))) return row.node.id;
  }
  return null;
}
