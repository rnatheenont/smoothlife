"use client";

import type React from "react";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import { InputGroup } from "@heroui/react";

// The console's search box: a magnifier, a field, and a way to empty it.
//
// Every list screen had its own copy of this — an absolutely positioned icon,
// a left padding chosen to clear it, and on some screens a clear button
// positioned from the right edge. They had drifted: three different heights,
// two different icon sizes, and the clear button existed on four of nine.
//
// InputGroup owns the arithmetic now, so the parts cannot fall out of step
// with each other, and a screen that never had a clear button gets one.

export default function AdminSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
  autoFocus,
  inputClassName,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** For a screen reader. These sit on toolbars with no visible label. */
  label?: string;
  className?: string;
  autoFocus?: boolean;
  inputClassName?: string;
  /** For the lists where Enter picks the first match. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <InputGroup className={clsx("min-h-10", className)}>
      <InputGroup.Prefix>
        <Search size={15} className="text-slate-400" aria-hidden="true" />
      </InputGroup.Prefix>
      <InputGroup.Input
        // type="search" so a phone offers a search key and the field is
        // announced as one. WebKit then draws its own clear button, which
        // would sit beside ours — and which Firefox does not draw at all, so
        // ours is the one that can be relied on. The utility below removes it.
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder ?? "ค้นหา"}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        className={clsx("[&::-webkit-search-cancel-button]:appearance-none", inputClassName)}
      />
      {value && (
        <InputGroup.Suffix>
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="ล้างคำค้น"
            className="grid size-6 place-items-center rounded-full text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-600"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </InputGroup.Suffix>
      )}
    </InputGroup>
  );
}
