"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import {
  Description,
  FieldError,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";

// One text field in the console, label and all.
//
// Half the fields in here had a label and half did not, and of the ones that
// did, the label was a <label> with its own class string copied from the
// screen next door — so a required mark was red on one form and amber on the
// next, and the hint under a field was 11px here and 12px there.
//
// TextField ties the three together: the label points at the input without
// anyone writing an id, the hint is announced as the field's description
// rather than read as loose text after it, and an error is announced when it
// appears instead of only being visible.
//
// `onChange` hands over the value, not the event — that is HeroUI's signature
// and it is the right one, because not one call site in this console wanted
// anything from the event but `target.value`.

export default function AdminField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  multiline,
  rows,
  inputMode,
  autoComplete,
  min,
  max,
  step,
  className,
  controlClassName,
  labelSuffix,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?:
    | "text"
    | "email"
    | "password"
    | "url"
    | "tel"
    | "number"
    | "date"
    | "datetime-local";
  placeholder?: string;
  /** Said once, under the field, before anything has gone wrong. */
  hint?: ReactNode;
  /** Said instead of the hint, once something has. */
  error?: string | null;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  multiline?: boolean;
  rows?: number;
  inputMode?:
    "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search";
  autoComplete?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  className?: string;
  controlClassName?: string;
  /** Anything that belongs beside the label — a count, a warning, a toggle. */
  labelSuffix?: ReactNode;
}) {
  return (
    <TextField
      type={multiline ? undefined : type}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      isInvalid={Boolean(error)}
      fullWidth
      className={className}
    >
      {label && (
        <Label className="text-xs font-semibold text-slate-600">
          {label}
          {labelSuffix}
        </Label>
      )}
      {multiline ? (
        <TextArea
          fullWidth
          rows={rows}
          placeholder={placeholder}
          className={controlClassName}
        />
      ) : (
        <Input
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          min={min}
          max={max}
          step={step}
          className={clsx(controlClassName)}
        />
      )}
      {/* The hint steps aside for the error rather than stacking under it:
          two lines of small grey-and-red text under a field is how a form
          ends up taller than the screen it is meant to fit on. */}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <Description>{hint}</Description>
      ) : null}
    </TextField>
  );
}
