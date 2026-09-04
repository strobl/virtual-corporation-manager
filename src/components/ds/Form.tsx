// Adapted from strobl/org-manager-console (GitFlash source prototype, 7edae2ad).
import { forwardRef, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Validation message                                                   */
/* ------------------------------------------------------------------ */

export type MessageTone = "error" | "hint" | "success";

export function ValidationMessage({
  id,
  tone = "error",
  children,
}: {
  id?: string | undefined;
  tone?: MessageTone | undefined;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      data-tone={tone}
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "mt-dense-0 text-micro",
        tone === "error" && "text-danger",
        tone === "success" && "text-success",
        tone === "hint" && "text-muted-foreground",
      )}
    >
      {tone === "error" ? <span aria-hidden="true">! </span> : null}
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Field wrapper: programmatic label + described-by/error association   */
/* ------------------------------------------------------------------ */

interface FieldShellProps {
  label: string;
  /** Visually hides the label without removing it from the accessibility tree. */
  hideLabel?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
  controlId?: string | undefined;
  className?: string | undefined;
}

export function Field({
  label,
  hideLabel,
  hint,
  error,
  required,
  children,
  controlId,
  className,
}: FieldShellProps) {
  const generated = useId();
  const id = controlId ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("mb-dense-3", className)}>
      <label
        htmlFor={id}
        className={cn(
          "mb-dense-1 block text-micro font-medium text-muted-foreground",
          hideLabel && "sr-only",
        )}
      >
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="mt-dense-0 text-micro text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <ValidationMessage id={errorId} tone="error">
        {error}
      </ValidationMessage>
    </div>
  );
}

const controlBase =
  "focus-console w-full rounded-control border border-border bg-card px-dense-3 py-dense-2 text-[length:var(--type-dense)] shadow-xs transition-colors hover:border-input text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground aria-[invalid=true]:border-danger";

/* ------------------------------------------------------------------ */
/* Text input                                                           */
/* ------------------------------------------------------------------ */

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hideLabel, hint, error, className, id: controlId, required, ...props },
  ref,
) {
  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      {...(controlId ? { controlId } : {})}
    >
      {({ id, describedBy, invalid }) => (
        <input
          {...props}
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlBase, className)}
        />
      )}
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* Select                                                               */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, error, options, className, id: controlId, required, ...props },
  ref,
) {
  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      {...(controlId ? { controlId } : {})}
    >
      {({ id, describedBy, invalid }) => (
        <select
          {...props}
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlBase, className)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* Checkbox                                                             */
/* ------------------------------------------------------------------ */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  hint?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, error, className, id: controlId, ...props },
  ref,
) {
  const generated = useId();
  const id = controlId ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="mb-dense-3">
      <div className="flex items-center gap-dense-2">
        <input
          {...props}
          ref={ref}
          type="checkbox"
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "focus-console size-3.5 shrink-0 rounded-control border border-border accent-selected disabled:cursor-not-allowed",
            className,
          )}
        />
        <label htmlFor={id} className="text-[length:var(--type-dense)] text-foreground">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className="mt-dense-0 text-micro text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <ValidationMessage id={errorId} tone="error">
        {error}
      </ValidationMessage>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Button                                                               */
/* ------------------------------------------------------------------ */

export type ButtonVariant = "default" | "primary" | "danger" | "ghost";

export interface ConsoleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Text announced while `loading` is true. */
  loadingLabel?: string;
}

const variantClass: Record<ButtonVariant, string> = {
  default: "bg-card text-foreground shadow-xs hover:bg-hover",
  primary: "border-transparent bg-primary text-primary-foreground shadow-xs hover:opacity-90",
  danger: "border-transparent bg-danger text-danger-foreground shadow-xs hover:opacity-90",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-hover",
};

export const ConsoleButton = forwardRef<HTMLButtonElement, ConsoleButtonProps>(
  function ConsoleButton(
    {
      variant = "default",
      loading = false,
      loadingLabel = "Working…",
      disabled,
      children,
      className,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        className={cn(
          "focus-console inline-flex min-h-8 items-center justify-center gap-dense-1 rounded-control border border-border px-dense-3 py-dense-1 text-[length:var(--type-dense)] font-medium transition-colors",
          "disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-disabled disabled:text-disabled-foreground",
          variantClass[variant],
          className,
        )}
      >
        {loading ? (
          <>
            <span aria-hidden="true">▪</span>
            {loadingLabel}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
