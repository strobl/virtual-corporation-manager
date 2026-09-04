// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TYPEAHEAD_RESET_MS } from "@/lib/organization/tree";

export interface TreeNode {
  id: string;
  label: string;
  /** Optional right-aligned trailing content (e.g. a NumericText). */
  trailing?: React.ReactNode;
  disabled?: boolean;
  children?: TreeNode[];
  /** Extra strings typeahead may match (e.g. a short code). */
  searchTerms?: string[];
}

export interface DenseTreeProps {
  label: string;
  nodes: TreeNode[];
  selectedId?: string | null;
  /** Rows sharing one logical selection (the same entity shown twice). */
  selectedIds?: readonly string[];
  onSelect?: ((id: string) => void) | undefined;
  /** Buffered consecutive-character typeahead over the visible rows. */
  typeahead?: boolean;
  expandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

interface FlatNode {
  node: TreeNode;
  level: number;
  parentId: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

function flatten(
  nodes: TreeNode[],
  expanded: Set<string>,
  level = 1,
  parentId: string | null = null,
  out: FlatNode[] = [],
): FlatNode[] {
  for (const node of nodes) {
    const hasChildren = Boolean(node.children?.length);
    const isExpanded = hasChildren && expanded.has(node.id);
    out.push({ node, level, parentId, hasChildren, expanded: isExpanded });
    if (isExpanded && node.children) flatten(node.children, expanded, level + 1, node.id, out);
  }
  return out;
}

/**
 * Generic, product-neutral tree. Renders nested rows with ARIA
 * tree/treeitem semantics and full roving-tabindex keyboard navigation:
 * ArrowUp/ArrowDown move, ArrowRight expands then descends, ArrowLeft
 * collapses then ascends, Home/End jump to the first/last visible row.
 */
export function DenseTree({
  label,
  nodes,
  selectedId = null,
  selectedIds,
  onSelect,
  typeahead = false,
  expandedIds,
  onExpandedChange,
  loading = false,
  error = null,
  emptyMessage = "No items.",
  disabled = false,
  className,
}: DenseTreeProps) {
  const [internalExpanded, setInternalExpanded] = useState<string[]>([]);
  const controlled = expandedIds !== undefined;
  const expanded = useMemo(
    () => new Set(controlled ? expandedIds : internalExpanded),
    [controlled, expandedIds, internalExpanded],
  );
  const rows = useMemo(() => flatten(nodes, expanded), [nodes, expanded]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const buffer = useRef({ text: "", at: 0 });
  const selectedSet = useMemo(
    () => new Set<string>(selectedIds ?? (selectedId ? [selectedId] : [])),
    [selectedIds, selectedId],
  );

  const active = activeId ?? selectedId ?? rows[0]?.node.id ?? null;

  useEffect(() => {
    if (activeId && !rows.some((r) => r.node.id === activeId)) setActiveId(null);
  }, [rows, activeId]);

  const setExpanded = useCallback(
    (next: Set<string>) => {
      const ids = [...next];
      if (!controlled) setInternalExpanded(ids);
      onExpandedChange?.(ids);
    },
    [controlled, onExpandedChange],
  );

  const toggle = useCallback(
    (id: string, open: boolean) => {
      const next = new Set(expanded);
      if (open) next.add(id);
      else next.delete(id);
      setExpanded(next);
    },
    [expanded, setExpanded],
  );

  const focusRow = useCallback((id: string) => {
    setActiveId(id);
    rowRefs.current.get(id)?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent, row: FlatNode) => {
    if (disabled) return;
    const index = rows.findIndex((r) => r.node.id === row.node.id);
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = rows[index + 1];
        if (next) focusRow(next.node.id);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = rows[index - 1];
        if (prev) focusRow(prev.node.id);
        break;
      }
      case "ArrowRight": {
        event.preventDefault();
        if (row.hasChildren && !row.expanded) toggle(row.node.id, true);
        else if (row.expanded) {
          const child = rows[index + 1];
          if (child) focusRow(child.node.id);
        }
        break;
      }
      case "ArrowLeft": {
        event.preventDefault();
        if (row.hasChildren && row.expanded) toggle(row.node.id, false);
        else if (row.parentId) focusRow(row.parentId);
        break;
      }
      case "Home": {
        event.preventDefault();
        const first = rows[0];
        if (first) focusRow(first.node.id);
        break;
      }
      case "End": {
        event.preventDefault();
        const last = rows[rows.length - 1];
        if (last) focusRow(last.node.id);
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        if (!row.node.disabled) onSelect?.(row.node.id);
        break;
      }
      default: {
        if (!typeahead) break;
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) break;
        event.preventDefault();
        const now = Date.now();
        buffer.current.text =
          now - buffer.current.at > TYPEAHEAD_RESET_MS
            ? event.key
            : buffer.current.text + event.key;
        buffer.current.at = now;
        const needle = buffer.current.text.toLowerCase();
        const from = buffer.current.text.length === 1 ? index + 1 : index;
        for (let step = 0; step < rows.length; step += 1) {
          const candidate = rows[(from + step + rows.length) % rows.length];
          if (!candidate) continue;
          const terms = [candidate.node.label, ...(candidate.node.searchTerms ?? [])];
          if (terms.some((term) => term.toLowerCase().startsWith(needle))) {
            // A match moves focus; no match leaves focus exactly where it is.
            focusRow(candidate.node.id);
            break;
          }
        }
        break;
      }
    }
  };

  const status = error ? "error" : loading ? "loading" : rows.length === 0 ? "empty" : "ready";

  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-border bg-card", disabled && "opacity-60", className)}
      data-status={status}
    >
      {status !== "ready" ? (
        <p
          className={cn(
            "px-dense-3 py-dense-2 text-dense",
            status === "error" ? "text-danger" : "text-muted-foreground",
          )}
          role={status === "error" ? "alert" : "status"}
        >
          {status === "error" ? error : status === "loading" ? "Loading…" : emptyMessage}
        </p>
      ) : (
        <div role="tree" aria-label={label} aria-busy={loading || undefined} className="py-dense-0">
          {rows.map((row) => {
            const isSelected = selectedSet.has(row.node.id);
            const isActive = active === row.node.id;
            return (
              <div
                key={row.node.id}
                role="treeitem"
                aria-level={row.level}
                aria-selected={isSelected}
                aria-disabled={row.node.disabled || disabled || undefined}
                {...(row.hasChildren ? { "aria-expanded": row.expanded } : {})}
                tabIndex={isActive ? 0 : -1}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.node.id, el);
                  else rowRefs.current.delete(row.node.id);
                }}
                onFocus={() => setActiveId(row.node.id)}
                onKeyDown={(event) => onKeyDown(event, row)}
                onClick={() => {
                  if (row.node.disabled || disabled) return;
                  setActiveId(row.node.id);
                  onSelect?.(row.node.id);
                }}
                className={cn(
                  "focus-console flex h-row cursor-default items-center gap-dense-1 pr-dense-2 text-[length:var(--type-dense)]",
                  isSelected
                    ? "bg-primary/10 font-medium text-foreground shadow-[inset_2px_0_0_var(--color-primary)]"
                    : "text-foreground hover:bg-hover",
                  (row.node.disabled || disabled) && "cursor-not-allowed text-disabled-foreground",
                )}
                style={{ paddingLeft: `calc(var(--tree-indent) * ${row.level})` }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  disabled={!row.hasChildren}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (row.hasChildren) toggle(row.node.id, !row.expanded);
                  }}
                  className="w-3 shrink-0 text-left text-micro disabled:opacity-0"
                >
                  {row.expanded ? "−" : "+"}
                </button>
                <span className="truncate">{row.node.label}</span>
                {row.node.trailing ? (
                  <span className="ml-auto pl-dense-2">{row.node.trailing}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
