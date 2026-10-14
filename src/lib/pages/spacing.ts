import type { SectionCommon, SpaceStep } from "./doc";

// Turning a section's spacing steps into classes.
//
// Written out one class per step, never built from a template string: a
// Tailwind class assembled at runtime is a class Tailwind never generated,
// and the result is a section with no spacing at all rather than the step
// that was asked for. Small table, no cleverness.

const TOP: Record<SpaceStep, string> = {
  "-2": "-mt-4",
  "-1": "-mt-2",
  "0": "",
  "1": "mt-2",
  "2": "mt-4",
};

const BOTTOM: Record<SpaceStep, string> = {
  "-2": "-mb-4",
  "-1": "-mb-2",
  "0": "",
  "1": "mb-2",
  "2": "mb-4",
};

/** What the editor offers, in the order it offers it. */
export const SPACE_OPTIONS: [SpaceStep, string][] = [
  ["-2", "ชิดขึ้นมาก"],
  ["-1", "ชิดขึ้น"],
  ["0", "ปกติ"],
  ["1", "ห่างขึ้น"],
  ["2", "ห่างขึ้นมาก"],
];

/**
 * The spacing classes for one section, or an empty string.
 *
 * Empty for a section nobody has adjusted, which is almost all of them —
 * and an empty class list is what keeps this from touching the markup of
 * every page that has never used it.
 */
export function spacingClass(common: SectionCommon | undefined): string {
  const top = common?.space?.top;
  const bottom = common?.space?.bottom;
  return [top ? TOP[top] : "", bottom ? BOTTOM[bottom] : ""].filter(Boolean).join(" ");
}
