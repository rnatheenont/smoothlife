import { SCHEMA_VERSION, type PageDoc } from "../doc";
import { SECTION_REGISTRY } from "@/sections/registry";

// The home page as it stands in the code, expressed as a document.
//
// Two jobs, and it has to be the same object for both:
//
//  1. What the `home` page is seeded with the first time it is created, so an
//     admin opening the editor finds today's page rather than a blank one.
//  2. The fallback. If Supabase is unreachable, or the stored document turns
//     out to be unreadable, the page renders from this instead — which is why
//     the home page cannot go blank no matter what happens to the database.
//
// Each section takes the defaults declared on its own definition, so there is
// one copy of "what this section starts as" rather than two that drift.

/** Settings straight from the definition, so this file never restates them. */
function defaultsOf(type: string): unknown {
  const def = SECTION_REGISTRY[type];
  if (!def) throw new Error(`[pages] default home doc names an unknown section: ${type}`);
  return def.defaults;
}

/** Ids are fixed strings rather than generated: this document is compared
 *  against the stored one, seeded more than once across environments, and
 *  referred to in logs — a different id every call would make all three
 *  harder for no gain. */
const ORDER = [
  "smoothie_ask",
  "hero_banners",
  "icon_shortcuts",
  "flash_sale_bar",
  "deal_of_day",
  "free_gift_promo",
  "concern_coverflow",
  "social_videos",
  "brand_circles",
  "article_gallery",
] as const;

/**
 * Sections a brand-new home page starts with hidden.
 *
 * These three used to be switched on and off by a row in free_gift_widgets,
 * and every one of those rows ships off (see DEFAULT_SETTINGS in
 * use-widget-settings). Now that the section's own eye icon is the switch,
 * starting them visible would turn three promos on for anyone who seeds a
 * home page — a flash sale with no deadline and a deal card nobody wrote.
 * They are on the page, in the right order, waiting to be turned on.
 */
const HIDDEN_AT_FIRST = new Set(["flash_sale_bar", "deal_of_day", "free_gift_promo"]);

export function defaultHomeDoc(): PageDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    sections: ORDER.map((type) => ({
      id: `home-${type}`,
      type,
      v: SECTION_REGISTRY[type].version,
      settings: defaultsOf(type),
      ...(HIDDEN_AT_FIRST.has(type) ? { common: { hidden: true } } : {}),
    })),
  };
}
