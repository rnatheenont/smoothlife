import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's built-in scales. Without these, it
// would read `text-body-s` as a colour and drop it next to `text-brand-800`,
// or treat `shadow-card` and `rounded-xl2` as unknown and keep both sides of
// a conflict. Names come from the @theme block in globals.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["h1", "h2", "h3", "h4", "h5", "h6", "title-l", "title", "title-s", "body-xl", "body-l", "body", "body-s", "body-xs", "label", "tag"],
      radius: ["xl2", "2xs", "s", "m", "l", "circle"],
      shadow: ["card", "cardHover", "layer-xs", "layer-sm", "layer", "layer-lg"],
    },
  },
});

/** Joins class names and lets a later Tailwind class override an earlier one (shadcn / Magic UI convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
