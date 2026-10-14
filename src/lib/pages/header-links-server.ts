import { headerLinksSchema, HEADER_LINKS_DEFAULT, HEADER_SECTION, usableHeaderLinks, type HeaderLinks } from "./header-links";
import { publishedDoc } from "./store";

// Reading the published header links. Server only — see header-links.ts.

export async function headerLinks(): Promise<HeaderLinks> {
  const doc = await publishedDoc("global", "header");
  const section = doc?.sections.find((s) => s.type === HEADER_SECTION);
  if (!section) return HEADER_LINKS_DEFAULT;

  const parsed = headerLinksSchema.safeParse(section.settings);
  if (!parsed.success) {
    console.error("[header] the stored links do not fit — using the built-in ones");
    return HEADER_LINKS_DEFAULT;
  }
  return usableHeaderLinks(parsed.data);
}
