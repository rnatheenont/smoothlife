import type { PageDoc, SectionInstance } from "./doc";

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
export function moveSection(doc: PageDoc, id: string, delta: number): PageDoc {
  const from = doc.sections.findIndex((s) => s.id === id);
  if (from < 0) return doc;
  const to = from + delta;
  if (to < 0 || to >= doc.sections.length) return doc;

  const sections = [...doc.sections];
  [sections[from], sections[to]] = [sections[to], sections[from]];
  return withSections(doc, sections);
}

/** Hides or shows a section. Hidden sections stay in the document, which is
 *  the difference between this and deleting one — the settings survive. */
export function toggleHidden(doc: PageDoc, id: string): PageDoc {
  return withSections(
    doc,
    doc.sections.map((s) => (s.id === id ? { ...s, common: { ...s.common, hidden: !s.common?.hidden } } : s))
  );
}

export function removeSection(doc: PageDoc, id: string): PageDoc {
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
