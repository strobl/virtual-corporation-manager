// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface Column<Row> {
  key: string;
  header: string;
  /** Fixed width keeps the layout stable across loading and selection. */
  width: string;
  align?: 'left' | 'right';
  cell: (row: Row) => React.ReactNode;
}

export interface CompactTableProps<Row> {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  rowDisabled?: (row: Row) => boolean;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Generic dense data table. Uses real table semantics, fixed column widths
 * (so nothing reflows while loading or selecting), and ArrowUp/ArrowDown/
 * Home/End row movement via a roving tabindex.
 */
export function CompactTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  selectedId = null,
  onSelect,
  rowDisabled,
  loading = false,
  error = null,
  emptyMessage = 'No rows.',
  disabled = false,
  className,
}: CompactTableProps<Row>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLTableRowElement>());
  const keys = rows.map(rowKey);
  const active = activeId ?? selectedId ?? keys[0] ?? null;

  useEffect(() => {
    if (activeId && !keys.includes(activeId)) setActiveId(null);
  }, [keys, activeId]);

  const focusRow = (id: string) => {
    setActiveId(id);
    refs.current.get(id)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, id: string) => {
    if (disabled) return;
    const index = keys.indexOf(id);
    const move = (target: number) => {
      const next = keys[target];
      if (next) {
        event.preventDefault();
        focusRow(next);
      }
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(keys.length - 1);
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(id);
    }
  };

  const status = error ? 'error' : loading ? 'loading' : rows.length === 0 ? 'empty' : 'ready';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card',
        disabled && 'opacity-60',
        className,
      )}
      data-status={status}
    >
      <table
        className="w-full table-fixed border-collapse text-dense"
        aria-busy={loading || undefined}
        aria-rowcount={rows.length}
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-muted/50">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'border-b border-border px-dense-3 py-dense-1 text-micro font-medium text-muted-foreground',
                  column.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {status !== 'ready' ? (
            <tr>
              <td
                colSpan={columns.length}
                className={cn(
                  'h-row px-dense-2 text-dense',
                  status === 'error' ? 'text-danger' : 'text-muted-foreground',
                )}
              >
                <span role={status === 'error' ? 'alert' : 'status'}>
                  {status === 'error' ? error : status === 'loading' ? 'Loading…' : emptyMessage}
                </span>
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rowKey(row);
              const isSelected = selectedId === id;
              const isDisabled = disabled || Boolean(rowDisabled?.(row));
              return (
                <tr
                  key={id}
                  ref={(el) => {
                    if (el) refs.current.set(id, el);
                    else refs.current.delete(id);
                  }}
                  tabIndex={active === id ? 0 : -1}
                  aria-selected={isSelected}
                  aria-disabled={isDisabled || undefined}
                  onFocus={() => setActiveId(id)}
                  onKeyDown={(event) => onKeyDown(event, id)}
                  onClick={() => {
                    if (isDisabled) return;
                    setActiveId(id);
                    onSelect?.(id);
                  }}
                  className={cn(
                    'focus-console h-row border-b border-border-subtle text-[length:var(--type-dense)]',
                    isSelected
                      ? 'bg-primary/10 text-foreground [&>td:first-child]:shadow-[inset_2px_0_0_var(--color-primary)]'
                      : 'text-foreground hover:bg-hover',
                    isDisabled && 'text-disabled-foreground',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'truncate px-dense-2',
                        column.align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
