// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
import { cn } from "@/lib/utils";

/**
 * Shared tab-row styling. One line, horizontally scrollable, never wrapping —
 * a narrow Inspector must clip into a scroll area, not stack into two rows.
 */
export const tabListClass =
  "scrollbar-none flex shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-border px-3 py-2";

export function tabButtonClass(active: boolean, className?: string) {
  return cn(
    "focus-console shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
    active
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-hover hover:text-foreground",
    className,
  );
}
