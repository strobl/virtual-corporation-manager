// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
import { cn } from '@/lib/utils';

export type NumericAlign = 'right' | 'left';
export type NumericTone = 'default' | 'muted' | 'danger' | 'success';

export interface NumericTextProps {
  /** Pre-formatted value. NumericText never computes or rounds anything. */
  value: string | number;
  /** Optional unit or currency marker rendered after the digits. */
  unit?: string;
  align?: NumericAlign;
  tone?: NumericTone;
  /** Accessible label when the digits alone are ambiguous. */
  label?: string;
  /**
   * `value` (default) renders tabular sans digits; `code` switches to
   * monospace and is reserved for identifiers and short codes.
   */
  variant?: 'value' | 'code';
  className?: string;
}

const toneClass: Record<NumericTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  danger: 'text-danger',
  success: 'text-success',
};

/**
 * Presentation-only numeric display with tabular (fixed-advance) digits so
 * quantities and money line up down a column. No calculation, no formatting
 * logic — callers pass an already-formatted string.
 */
export function NumericText({
  value,
  unit,
  align = 'right',
  tone = 'default',
  label,
  variant = 'value',
  className,
}: NumericTextProps) {
  return (
    <span
      data-testid="numeric-text"
      data-align={align}
      aria-label={label}
      className={cn(
        'tabular text-dense whitespace-nowrap',
        variant === 'code' && 'font-mono',
        align === 'right' ? 'text-right' : 'text-left',
        toneClass[tone],
        className,
      )}
    >
      {value}
      {unit ? <span className="ml-dense-0 text-muted-foreground">{unit}</span> : null}
    </span>
  );
}
