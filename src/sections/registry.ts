import type { AnySectionDefinition, PageKind } from "@/lib/pages/types";
import { smoothieAsk } from "./smoothie_ask/definition";
import { heroBannersSection } from "./hero_banners/definition";
import { iconShortcuts } from "./icon_shortcuts/definition";
import { flashSaleBar } from "./flash_sale_bar/definition";
import { flashSaleShelf } from "./flash_sale_shelf/definition";
import { dealOfDay } from "./deal_of_day/definition";
import { freeGiftPromo } from "./free_gift_promo/definition";
import { concernCoverflow } from "./concern_coverflow/definition";
import { socialVideos } from "./social_videos/definition";
import { brandCircles } from "./brand_circles/definition";
import { articleGallery } from "./article_gallery/definition";
import { richText } from "./rich_text/definition";
import { imageBanner } from "./image_banner/definition";
import { productGrid } from "./product_grid/definition";
import { uspIcons } from "./usp_icons/definition";
import { spacer } from "./spacer/definition";
import { brandHero } from "./brand_hero/definition";
import { brandGroupTabs } from "./brand_group_tabs/definition";
import { brandBestsellers } from "./brand_bestsellers/definition";
import { brandStory } from "./brand_story/definition";
import { brandProductLines } from "./brand_product_lines/definition";
import { brandAllLinks } from "./brand_all_links/definition";
import { brandCampaignBar } from "./brand_campaign_bar/definition";
import { campaignHero } from "./campaign_hero/definition";
import { countdownBanner } from "./countdown_banner/definition";
import { voucherStrip } from "./voucher_strip/definition";
import { categoryJumpTabs } from "./category_jump_tabs/definition";
import { productTabs } from "./product_tabs/definition";
import { campaignTerms } from "./campaign_terms/definition";
import { campaignSlot } from "./campaign_slot/definition";
import { dealTiers } from "./deal_tiers/definition";
import { hotspotImage } from "./hotspot_image/definition";
import { nextCampaign } from "./next_campaign/definition";

// Every section the system knows how to render, by type.
//
// This list is the contract. A document may name any type it likes; only the
// ones here are drawn, and anything else is skipped with a log (see
// render.tsx). That is what keeps an admin from being able to put the site in
// a state the code cannot handle — they choose from this library, they do not
// invent entries in it.
//
// Removing an entry orphans every document that still uses it, so a type is
// retired only after nothing references it.

const ALL: AnySectionDefinition[] = [
  smoothieAsk,
  heroBannersSection,
  iconShortcuts,
  flashSaleBar,
  flashSaleShelf,
  dealOfDay,
  freeGiftPromo,
  concernCoverflow,
  socialVideos,
  brandCircles,
  articleGallery,

  // The general-purpose ones. Everything above wraps a piece of the home page
  // as it already was; these are the blocks a page built from scratch is made
  // of, and they are the reason /p/ pages can be anything at all.
  richText,
  imageBanner,
  productGrid,
  uspIcons,
  spacer,

  // Brand pages only. Each reads which brand from the page's own slug, so
  // they mean nothing anywhere else — enabledOn keeps them out of every
  // other library.
  brandHero,
  brandGroupTabs,
  brandBestsellers,
  brandStory,
  brandProductLines,
  brandAllLinks,
  brandCampaignBar,

  // Campaign pages. The first four read the campaign's own phase or its four
  // dates (ctx.phase, ctx.times), which only a campaign page provides — put
  // one anywhere else and it would have nothing to count towards.
  campaignHero,
  countdownBanner,
  voucherStrip,
  categoryJumpTabs,
  productTabs,
  campaignTerms,
  dealTiers,
  hotspotImage,
  nextCampaign,

  // Reads which campaign to show from the database rather than from its own
  // settings, which is what lets it sit on the home page out of season and
  // render nothing.
  campaignSlot,
];

export const SECTION_REGISTRY: Record<string, AnySectionDefinition> = Object.fromEntries(
  ALL.map((def) => [def.type, def])
);

export const SECTION_LIST: AnySectionDefinition[] = ALL;

/** The sections an admin may add to a page of this kind, for the library
 *  panel in the editor. */
export function sectionsFor(kind: PageKind): AnySectionDefinition[] {
  return ALL.filter((def) => def.enabledOn.includes(kind));
}

// A section whose defaults do not satisfy its own schema is a section the
// editor cannot add: the admin presses "เพิ่ม section", the document fails
// validation, and the new block never appears. That is a mistake made while
// writing a definition, so it should be found while writing one.
//
// Checked here rather than in a unit test because the definitions import
// React components through the "@/" alias, which `node --test` cannot
// resolve — this runs wherever the app does. It throws in development and
// only complains in production, because a bad default is worth stopping a
// developer and is not worth taking the site down for.
for (const def of ALL) {
  const parsed = def.schema.safeParse(def.defaults);
  if (!parsed.success) {
    const message = `[sections] "${def.type}" defaults do not satisfy its own schema: ${parsed.error.message}`;
    if (process.env.NODE_ENV === "development") throw new Error(message);
    console.error(message);
  }
}
