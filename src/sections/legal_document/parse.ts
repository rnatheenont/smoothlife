// Turning a typed document into blocks.
//
// Out here rather than inside the component so it can be tested: the rules
// are small and their mistakes are quiet — a heading that keeps its "## ",
// an anchor that two headings share so the contents sends you to the wrong
// clause, a trailing blank that becomes an empty paragraph.

export type LegalBlock =
  | { kind: "h2"; text: string; id: string }
  | { kind: "h3"; text: string; id: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

/** A heading and everything under it, which is how these documents are read:
 *  nobody reads a policy, they read one clause of one. */
export type LegalGroup = { heading?: Extract<LegalBlock, { kind: "h2" }>; blocks: LegalBlock[] };

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
    else if (text.split("\n").every((line) => line.trim().startsWith("- ")))
      // A block whose every line is a bullet is a list. Every line, not the
      // first: a paragraph that happens to start with a dash is a paragraph,
      // and splitting it would drop the rest of it on the floor.
      blocks.push({ kind: "ul", items: text.split("\n").map((line) => line.trim().slice(2).trim()) });
    else blocks.push({ kind: "p", text });
  }
  return blocks;
}

/** Blocks, grouped under the heading they belong to. Anything before the
 *  first heading is its own group with no heading, rather than dropped. */
export function groupLegal(blocks: LegalBlock[]): LegalGroup[] {
  const groups: LegalGroup[] = [];
  for (const block of blocks) {
    if (block.kind === "h2") groups.push({ heading: block, blocks: [] });
    else {
      if (groups.length === 0) groups.push({ blocks: [] });
      groups[groups.length - 1].blocks.push(block);
    }
  }
  return groups;
}
