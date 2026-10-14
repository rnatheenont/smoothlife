import { footerColumnsSchema, FOOTER_COLUMNS_DEFAULT, FOOTER_SECTION, type FooterColumns } from "./footer-links";
import { publishedDoc } from "./store";

// Reading the published footer columns. Server only — see footer-links.ts
// for why the two halves are apart.

/**
 * The columns to draw.
 *
 * A column with no links, or a link with no address, is dropped rather than
 * drawn empty: the footer is the one component on the site that nobody looks
 * at while editing it, so a half-filled row would ship.
 *
 * Any failure — no document, wrong shape, database unreachable — falls back
 * to the built-in columns. The footer never renders without links.
 */
export async function footerColumns(): Promise<FooterColumns> {
  const doc = await publishedDoc("global", "footer");
  const section = doc?.sections.find((s) => s.type === FOOTER_SECTION);
  if (!section) return FOOTER_COLUMNS_DEFAULT;

  const parsed = footerColumnsSchema.safeParse(section.settings);
  if (!parsed.success) {
    console.error("[footer] the stored columns do not fit — using the built-in ones");
    return FOOTER_COLUMNS_DEFAULT;
  }

  const columns = parsed.data.columns
    .map((col) => ({ ...col, links: col.links.filter((l) => l.href && l.label) }))
    .filter((col) => col.title && col.links.length > 0);
  return columns.length > 0 ? columns : FOOTER_COLUMNS_DEFAULT;
}
