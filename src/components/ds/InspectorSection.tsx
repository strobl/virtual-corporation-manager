// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InspectorSectionProps {
  title: string;
  /** Right-aligned controls in the section header bar. */
  actions?: ReactNode;
  /** Makes the section expand/collapse. Omit for a static section. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Compact titled section for inspector panes: hard 1px border, dense header
 * bar, optional actions, and accessible expand/collapse when collapsible.
 */
export function InspectorSection({
  title,
  actions,
  collapsible = false,
  defaultOpen = true,
  open,
  onOpenChange,
  children,
  className,
}: InspectorSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = collapsible ? (open ?? internalOpen) : true;
  const bodyId = useId();

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section
      className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}
      aria-label={title}
    >
      <div className="flex h-row items-center gap-dense-2 border-b border-border bg-muted/50 px-dense-3">
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={isOpen}
            aria-controls={bodyId}
            className="focus-console -mx-dense-1 flex items-center gap-dense-1 px-dense-1 text-micro font-medium text-foreground hover:bg-hover"
          >
            <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
            {title}
          </button>
        ) : (
          <h3 className="text-micro font-semibold text-foreground">{title}</h3>
        )}
        {actions ? <div className="ml-auto flex items-center gap-dense-1">{actions}</div> : null}
      </div>
      <div id={bodyId} hidden={!isOpen} className="p-dense-3 text-dense text-foreground">
        {children}
      </div>
    </section>
  );
}
