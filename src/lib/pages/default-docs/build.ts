// With the extension, so the unit tests can load these files without a
// bundler (tsconfig allows it; see src/sections/breadcrumb/trail.ts for the
// same trade made for the same reason).
import { SCHEMA_VERSION, type PageDoc, type SectionCommon } from "../doc.ts";

export type DraftSection = { type: string; v: number; settings: unknown; common?: SectionCommon };

/**
 * A document, with its sections numbered.
 *
 * Ids are the section's type and its position, assigned here rather than by a
 * counter that keeps climbing across calls. Two things depend on that: a
 * second call has to produce the same document as the first (a test says so),
 * and the ids are what a preview click and an error report point at — "the
 * second feature_cards" is worth reading in a log, "feature_cards-47" is not.
 *
 * Shared by every wave's file rather than copied into each: the ids are part
 * of the document, and two slightly different builders would eventually
 * produce two numbering schemes for no reason anybody could remember.
 */
export const doc = (sections: DraftSection[]): PageDoc => ({
  schemaVersion: SCHEMA_VERSION,
  sections: sections.map((section, i) => ({ id: `${section.type}-${i + 1}`, ...section })),
});
