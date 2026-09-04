"use client";

import { useId } from "react";
import clsx from "clsx";

// A labelled form control with its hint and error wired to it properly.
//
// The 98 raw <input>s in the codebase mostly carry a <p> of helper text and a
// red <p> for the error sitting as loose siblings, which a screen reader never
// reads out with the field. Here `aria-describedby` and `aria-invalid` are
// derived, so getting it right is the default rather than something each form
// has to remember.

type Props = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Renders a textarea instead of an input. */
  multiline?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export default function Field({
  label,
  hint,
  error,
  required,
  multiline,
  className,
  id,
  ...rest
}: Props) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  const control = clsx(
    "w-full rounded-lg border px-3 py-2 text-sm transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:border-brand-600",
    "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
    "dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
    error
      ? "border-rose-400 focus-visible:ring-rose-500 focus-visible:border-rose-500"
      : "border-slate-200 dark:border-slate-700",
    className
  );

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
        {required && (
          <span className="ml-0.5 text-rose-500" aria-hidden>
            *
          </span>
        )}
      </label>

      {multiline ? (
        <textarea
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={clsx(errorId, hintId) || undefined}
          className={control}
          {...rest}
        />
      ) : (
        <input
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={clsx(errorId, hintId) || undefined}
          className={control}
          {...rest}
        />
      )}

      {hint && !error && (
        <p id={hintId} className="mt-1 text-[11px] text-slate-400">
          {hint}
        </p>
      )}
      {/* role="alert" so a validation failure is announced when it appears,
          not only when the field is next focused. */}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
