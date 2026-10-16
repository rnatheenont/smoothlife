import { SCHEMA_VERSION, type PageDoc } from "../doc";
import { SECTION_REGISTRY } from "@/sections/registry";

// The automatic brand page, expressed as a document.
//
// Every brand gets this page without anyone building it — the sections read
// which brand from the page's slug and fill themselves from the catalogue and
// the brand's profile. The same document does two other jobs, like the home
// page's (see home.ts):
//
//  1. What a brand page is seeded with when the team chooses to lay one out
//     by hand, so they start from the page the brand already has.
//  2. The fallback when a brand has no published page of its own, or the one
//     it has cannot be read.
//
// With no profile filled in, this renders the page the brand always had: the
// story section draws nothing, and the shelf at the top uses review counts.

const ORDER = [
  "brand_hero",
  // Draws nothing unless this brand is in a campaign that is on, so it costs
  // an out-of-season page nothing to carry it.
  "brand_campaign_bar",
  "brand_bestsellers",
  "brand_story",
  "brand_product_lines",
  "brand_all_links",
] as const;

export function defaultBrandDoc(): PageDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    sections: ORDER.map((type) => {
      const def = SECTION_REGISTRY[type];
      if (!def) throw new Error(`[pages] default brand doc names an unknown section: ${type}`);
      // Fixed ids, for the same reasons as the home page's: the document is
      // compared, seeded and logged, and a fresh id each time helps none of it.
      return { id: `brand-${type}`, type, v: def.version, settings: def.defaults };
    }),
  };
}
