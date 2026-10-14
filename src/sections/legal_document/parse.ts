// Turning a typed document into blocks.
//
// Out here rather than inside the component so it can be tested: the rules
// are small and their mistakes are quiet — a heading that keeps its "## ",
// an anchor that two headings share so the contents sends you to the wrong
// clause, a trailing blank that becomes an empty paragraph.

export type LegalBlock =
  | { kind: "h2"; text: string; id: string }
  | { kind: "h3"; text: string; id: string }
  | { kind: "p"; text: string };

/** A heading's anchor. Thai has no case and no spaces to strip, so the
 *  position in the document is what keeps two identically-named clauses
 *  apart. */
export const legalAnchor = (index: number) => `s${index}`;

export function parseLegal(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const raw of body.split(/\n{2,}/)) {
    const text = raw.trim();
    if (!text) continue;
    if (text.startsWith("### ")) blocks.push({ kind: "h3", text: text.slice(4), id: legalAnchor(blocks.length) });
    else if (text.startsWith("## ")) blocks.push({ kind: "h2", text: text.slice(3), id: legalAnchor(blocks.length) });
    else blocks.push({ kind: "p", text });
  }
  return blocks;
}
