import type { AnySectionDefinition, PageKind } from "@/lib/pages/types";
import { smoothieAsk } from "./smoothie_ask/definition";
import { brandCircles } from "./brand_circles/definition";
import { socialVideos } from "./social_videos/definition";

// Every section the system knows how to render, by type.
//
// This list is the contract. A document may name any type it likes; only the
// ones here are drawn, and anything else is skipped with a log (see
// render.tsx). That is what keeps an admin from being able to put the site in
// a state the code cannot handle — they choose from this library, they do not
// invent entries in it.
//
// Removing an entry orphans every document that still uses it, so a type is
// retired only after nothing references it.

const ALL: AnySectionDefinition[] = [smoothieAsk, brandCircles, socialVideos];

export const SECTION_REGISTRY: Record<string, AnySectionDefinition> = Object.fromEntries(
  ALL.map((def) => [def.type, def])
);

export const SECTION_LIST: AnySectionDefinition[] = ALL;

/** The sections an admin may add to a page of this kind, for the library
 *  panel in the editor. */
export function sectionsFor(kind: PageKind): AnySectionDefinition[] {
  return ALL.filter((def) => def.enabledOn.includes(kind));
}

// A section whose defaults do not satisfy its own schema is a section the
// editor cannot add: the admin presses "เพิ่ม section", the document fails
// validation, and the new block never appears. That is a mistake made while
// writing a definition, so it should be found while writing one.
//
// Checked here rather than in a unit test because the definitions import
// React components through the "@/" alias, which `node --test` cannot
// resolve — this runs wherever the app does. It throws in development and
// only complains in production, because a bad default is worth stopping a
// developer and is not worth taking the site down for.
for (const def of ALL) {
  const parsed = def.schema.safeParse(def.defaults);
  if (!parsed.success) {
    const message = `[sections] "${def.type}" defaults do not satisfy its own schema: ${parsed.error.message}`;
    if (process.env.NODE_ENV === "development") throw new Error(message);
    console.error(message);
  }
}
