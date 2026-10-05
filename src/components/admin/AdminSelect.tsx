"use client";

import clsx from "clsx";
import { Select, ListBox, ListBoxItem } from "@heroui/react";

// The console's dropdown, on HeroUI.
//
// It replaces a native <select> wearing the `adminSelect` class string, which
// existed only because the browser's own arrow sits hard against the border
// and cannot be moved — so the arrow was turned off and redrawn as a
// background image. HeroUI draws its own menu, so none of that is needed.
//
// It keeps the pill shape on purpose. These sit on the same toolbar as the
// search box and the filter chips, and on that row they are the same kind of
// thing; a square dropdown among round chips reads as a different control.
//
// `value`/`onChange` rather than HeroUI's `selectedKey`/`onSelectionChange`:
// every call site here is a controlled string, and a wrapper that still spoke
// in Keys would leave `String(key)` scattered across forty screens.

export type AdminSelectOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

export default function AdminSelect({
  value,
  onChange,
  options,
  label,
  placeholder,
  isDisabled,
  className,
  triggerClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  /** What it is, for a screen reader — these sit on toolbars with no visible
   *  label far more often than they sit in a form. */
  label: string;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <Select
      aria-label={label}
      selectedKey={value}
      isDisabled={isDisabled}
      onSelectionChange={(key) => onChange(String(key ?? ""))}
      className={className}
      placeholder={placeholder}
    >
      <Select.Trigger
        // Shape and type only. The horizontal padding is HeroUI's to set: the
        // chevron is positioned absolutely and the trigger earns its right-hand
        // padding from a :has() rule, so overriding pr- here puts the arrow on
        // top of the words.
        // Border and display are set here rather than left to HeroUI's field
        // variables: the console wants a visible hairline on every dropdown,
        // and these sit inside running sentences on the campaign screens where
        // a block-level trigger drops off the text's baseline.
        className={clsx(
          "inline-flex rounded-full border border-surface-line bg-white",
          "text-[12px] font-semibold text-brand-ink",
          triggerClassName,
        )}
      >
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBoxItem key={o.value} id={o.value} isDisabled={o.isDisabled}>
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
