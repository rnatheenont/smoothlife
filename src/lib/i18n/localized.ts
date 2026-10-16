// Relative imports with extensions, so the unit test can load this without a
// bundler (see src/sections/breadcrumb/trail.ts for the same trade).
import { z } from "zod";

// Text that may exist in two languages.
//
// Both languages live in one document rather than one row per language, which
// is what makes publish, rollback and scheduling apply to both at once and
// keeps the section order identical between them. See §B2 of the plan.
//
// The important decision here is what happens to everything written before
// today: a plain string is Thai. Not "Thai that needs migrating" — Thai, now
// and permanently. `tx()` is what makes old data work, and that is on purpose:
//
//   A migrate() saying "v1 means string, convert it to {th}" would run on
//   every render for ever, because nothing ever writes a new `v` onto a
//   section that is already saved. The editor replaces `settings` and leaves
//   the version number alone, so a section stored at v1 stays v1 for life.
//   That exact mistake already cost us once — hero_banners' first migrate
//   ("coming from v1, slides = []") deleted the admin's slides on every
//   request while the editor still showed them.
//
// So: no SCHEMA_VERSION bump, no migrate. The editor writes {th, en} when
// somebody saves; everything else is read through tx().

export type Locale = "th" | "en";

export const LOCALES: Locale[] = ["th", "en"];

export const DEFAULT_LOCALE: Locale = "th";

/** Text that may carry a translation. A bare string is Thai. */
export type LText = string | { th: string; en?: string };

/**
 * The zod shape for one translatable field.
 *
 * Accepts the old plain string as well as the pair, so a document written
 * before any of this still parses — which is the whole point.
 */
export const lText = (max = 200) =>
  z.union([
    z.string().max(max),
    z.object({ th: z.string().max(max), en: z.string().max(max).optional() }),
  ]);

/**
 * Read one field in one language.
 *
 * English falls back to Thai, and an English value that is only whitespace
 * counts as missing: a half-finished translation should show the Thai that
 * says something rather than a blank where a price or a promise was.
 */
export function tx(value: LText | undefined | null, locale: Locale): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (locale === "en") return value.en?.trim() || value.th || "";
  return value.th || "";
}

/** Whether a field has anything to show in this language of its own. */
export function hasTranslation(value: LText | undefined | null, locale: Locale): boolean {
  if (value == null) return false;
  if (typeof value === "string") return locale === "th";
  return locale === "en" ? Boolean(value.en?.trim()) : Boolean(value.th);
}

/**
 * The Thai side on its own, whatever shape the value is in.
 *
 * Used where the Thai text is the thing being acted on rather than displayed:
 * the hash that tells the editor a translation has gone stale, and the text
 * handed to a translator.
 */
export function thaiOf(value: LText | undefined | null): string {
  if (value == null) return "";
  return typeof value === "string" ? value : value.th || "";
}

/**
 * A stored value, split into the two boxes an editor needs.
 *
 * Anything written before today is a plain string, and a plain string is
 * Thai — so it goes in the Thai box and English starts empty. The editor and
 * tx() have to agree about what an old value means, so they read it here.
 */
export function splitLText(value: unknown): { th: string; en: string } {
  if (typeof value === "string") return { th: value, en: "" };
  if (value && typeof value === "object") {
    const o = value as { th?: unknown; en?: unknown };
    return { th: typeof o.th === "string" ? o.th : "", en: typeof o.en === "string" ? o.en : "" };
  }
  return { th: "", en: "" };
}

/**
 * The two boxes, back into one stored value.
 *
 * With no English it collapses to a plain string rather than `{th}`, which
 * keeps a document the shape it has always been until somebody actually
 * writes a translation — so "a plain string is Thai" stays true of every
 * document, not only of the old ones.
 */
export function joinLText(th: string, en: string): LText {
  return en.trim() ? { th, en } : th;
}
