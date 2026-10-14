import type { PageDoc, SectionInstance } from "./doc";

/**
 * What this file is allowed to know about section types.
 *
 * A predicate rather than the registry itself, deliberately. The registry
 * pulls in every section's definition, which pulls in every section's
 * component, which is React and Shopify data — and this file's whole value is
 * that its mistakes can be caught by a test that runs in milliseconds with no
 * DOM and no network. Callers that have the registry pass these two in; the
 * tests pass a literal.
 *
 * Both are optional, and a document with no rules behaves exactly as it did
 * before locking existed.
 */
export type SectionRules = {
  isLocked?: (type: string) => boolean;
  pinnedOf?: (type: string) => "top" | "bottom" | undefined;
};

function lockedAt(doc: PageDoc, id: string, rules: SectionRules): boolean {
  const section = doc.sections.find((s) => s.id === id);
  return Boolean(section && rules.isLocked?.(section.type));
}

/** How many pinned sections are welded to each end right now.
 *
 *  Counted from the document rather than assumed, because a page can hold
 *  more than one of them — a breadcrumb above a page header, both pinned to
 *  the top — and because a document written before a section became pinned
 *  may not have it at the end yet. What is counted is the run that is
 *  already there; it is not this function's job to repair the rest. */
function pinnedEnds(doc: PageDoc, rules: SectionRules): { top: number; bottom: number } {
  const pin = (i: number) => rules.pinnedOf?.(doc.sections[i].type);
  let top = 0;
  while (top < doc.sections.length && pin(top) === "top") top += 1;
  let bottom = 0;
  while (bottom < doc.sections.length - top && pin(doc.sections.length - 1 - bottom) === "bottom") bottom += 1;
  return { top, bottom };
}

// What the editor does to a document, as functions rather than as code inside
// a button handler.
//
// Out here they can be tested: reordering, hiding, adding and deleting are
// small operations whose mistakes are quiet — an off-by-one that drops the
// last section, a move that silently does nothing at the end of the list, a
// delete that takes the wrong one because two sections share a key. None of
// those announce themselves in a UI; all of them are one assertion each.
//
// Every function returns a new document and never mutates its input, because
// the editor compares the old and the new to decide whether to autosave.

/** A new id. Short enough to read in a log, random enough that two people
 *  adding a section at the same moment do not collide. */
export function newSectionId(): string {
  return `s-${crypto.randomUUID().slice(0, 8)}`;
}

function withSections(doc: PageDoc, sections: SectionInstance[]): PageDoc {
  return { ...doc, sections };
}

/**
 * Moves a section up (-1) or down (+1).
 *
 * A move off either end returns the document unchanged rather than wrapping
 * around: the person pressing "up" on the first section means "nothing left
 * to do", not "send it to the bottom".
 */
export function moveSection(doc: PageDoc, id: string, delta: number, rules: SectionRules = {}): PageDoc {
  const from = doc.sections.findIndex((s) => s.id === id);
  if (from < 0) return doc;
  const to = from + delta;
  if (to < 0 || to >= doc.sections.length) return doc;
  if (rules.pinnedOf?.(doc.sections[from].type)) return doc;
  const { top, bottom } = pinnedEnds(doc, rules);
  if (to < top || to > doc.sections.length - 1 - bottom) return doc;

  const sections = [...doc.sections];
  [sections[from], sections[to]] = [sections[to], sections[from]];
  return withSections(doc, sections);
}

/**
 * Moves a section to a position, the way dragging one does.
 *
 * Not the same operation as moveSection: that one *swaps* with its
 * neighbour, which is right for a one-step arrow and wrong for a drag —
 * dropping the first section onto the fifth should leave the ones in between
 * shifted up by one, not have the fifth jump to the top.
 *
 * Out-of-range indexes return the document untouched rather than clamping,
 * because every caller is a pointer that has been dropped somewhere, and a
 * drop that landed nowhere should do nothing rather than something nearby.
 */
export function reorderSections(doc: PageDoc, from: number, to: number, rules: SectionRules = {}): PageDoc {
  const last = doc.sections.length - 1;
  if (from < 0 || from > last || to < 0 || to > last || from === to) return doc;

  // A pinned section does not travel, and nothing travels past one. The
  // editor draws these outside the sortable list so neither drop can be
  // aimed in the first place; this is the same answer given again where it
  // can be tested, for the documents that do not come from the editor.
  if (rules.pinnedOf?.(doc.sections[from].type)) return doc;
  const { top, bottom } = pinnedEnds(doc, rules);
  if (to < top || to > last - bottom) return doc;

  const sections = [...doc.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return withSections(doc, sections);
}

/** Hides or shows a section. Hidden sections stay in the document, which is
 *  the difference between this and deleting one — the settings survive. */
export function toggleHidden(doc: PageDoc, id: string, rules: SectionRules = {}): PageDoc {
  // Hiding the buy box leaves a product page that cannot sell. The section
  // stays.
  if (lockedAt(doc, id, rules)) return doc;
  return withSections(
    doc,
    doc.sections.map((s) => (s.id === id ? { ...s, common: { ...s.common, hidden: !s.common?.hidden } } : s))
  );
}

export function removeSection(doc: PageDoc, id: string, rules: SectionRules = {}): PageDoc {
  if (lockedAt(doc, id, rules)) return doc;
  return withSections(doc, doc.sections.filter((s) => s.id !== id));
}

/** Adds a section at the end. The defaults are copied, not shared — two
 *  sections of the same type must not end up editing one settings object. */
export function addSection(
  doc: PageDoc,
  entry: { type: string; version: number; defaults: unknown },
  id: string = newSectionId()
): PageDoc {
  return withSections(doc, [
    ...doc.sections,
    { id, type: entry.type, v: entry.version, settings: structuredClone(entry.defaults) },
  ]);
}

export function updateSettings(doc: PageDoc, id: string, settings: unknown): PageDoc {
  return withSections(doc, doc.sections.map((s) => (s.id === id ? { ...s, settings } : s)));
}

/**
 * A list of slugs as typed: one per line, or separated by commas, or both.
 *
 * Parsed back into a list on the way out so the document keeps storing a
 * list. The alternative — storing whatever string was typed — is how a
 * section stops matching its schema and quietly disappears from the page.
 */
export function parseSlugList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
