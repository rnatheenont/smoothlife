"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { Tooltip } from "@heroui/react";

// A control that shows only an icon, and says what it is when you look at it.
//
// The browser's own `title` is not enough here: it waits about a second, a
// keyboard never reaches it, and a touch screen never shows it at all — so the
// two controls at the right of the inbox toolbar were, to anyone who had not
// been told, small grey shapes. This shows on hover and on keyboard focus.
//
// The button and the tooltip are one component because HeroUI's trigger has to
// *be* the control, not wrap it: wrapping put a role="button" span around a
// real button, which is two tab stops and two things claiming to be the same
// button.

export default function IconButton({
  label,
  icon,
  onClick,
  pressed,
  className,
}: {
  /** What it does, in the words it would use if it had room for words. */
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <Tooltip delay={200} closeDelay={0}>
      <Tooltip.Trigger<"button">
        render={(props) => (
          <button
            {...props}
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            aria-label={label}
            className={clsx(
              "grid size-9 shrink-0 place-items-center rounded-full text-slate-500 transition-colors",
              "hover:bg-surface-soft hover:text-brand-800",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action",
              className,
            )}
          >
            {icon}
          </button>
        )}
      />
      <Tooltip.Content showArrow>{label}</Tooltip.Content>
    </Tooltip>
  );
}
