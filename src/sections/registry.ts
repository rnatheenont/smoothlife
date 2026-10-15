import type { AnySectionDefinition, PageKind } from "@/lib/pages/types";
import type { SectionRules } from "@/lib/pages/edit";
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
import { pageHeader } from "./page_header/definition";
import { breadcrumb } from "./breadcrumb/definition";
import { featureCards } from "./feature_cards/definition";
import { linkPills } from "./link_pills/definition";
import { faq } from "./faq/definition";
import { legalDocument } from "./legal_document/definition";
import { ctaCard } from "./cta_card/definition";
import { toolCards } from "./tool_cards/definition";
import { helpTopicsSection } from "./help_topics/definition";
import { promoList } from "./promo_list/definition";
import { tierCards } from "./tier_cards/definition";
import { pageState } from "./page_state/definition";
import { contactInfoSection } from "./contact_info/definition";
import { contactChannels } from "./contact_channels/definition";
import { storeList } from "./store_list/definition";
import { footerLinks } from "./footer_links/definition";
import { announcementBar } from "./announcement_bar/definition";
import { mobileTabsSection } from "./mobile_tabs/definition";
import { headerLinksSection } from "./header_links/definition";
import { articleGrid } from "./article_grid/definition";
import { questionList } from "./question_list/definition";
import { concernTiles } from "./concern_tiles/definition";
import { collectionTiles } from "./collection_tiles/definition";
import { brandDirectory } from "./brand_directory/definition";
import { searchApp } from "./search_app/definition";
import { shopHero } from "./shop_hero/definition";
import { shopListing } from "./shop_listing/definition";
import { entityHeader } from "./entity_header/definition";
import { routineSteps } from "./routine_steps/definition";
import { concernProducts } from "./concern_products/definition";
import { collectionHeader } from "./collection_header/definition";
import { collectionProducts } from "./collection_products/definition";
import { categoryChips } from "./category_chips/definition";
import { categoryHeader } from "./category_header/definition";
import { advisorEntry } from "./advisor_entry/definition";
import { categoryListing } from "./category_listing/definition";
import { productDetail } from "./product_detail/definition";
import { relatedProducts } from "./related_products/definition";
import { recentlyViewed } from "./recently_viewed/definition";
import { articlePage } from "./article_page/definition";
import { questionArticle } from "./question_article/definition";
import { questionProducts } from "./question_products/definition";
import { relatedQuestions } from "./related_questions/definition";
import { cartApp } from "./cart_app/definition";
import { accountReferral } from "./account_referral/definition";
import { accountPoints } from "./account_points/definition";
import { inkLinkCard } from "./ink_link_card/definition";
import { advisorQuiz } from "./advisor_quiz/definition";

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

  // The content sections, for the pages that are words rather than shelves.
  // They arrived with the plan to bring /about, /help and the rest into the
  // system; each one replaces a piece of markup that used to need a deploy.
  pageHeader,
  breadcrumb,
  featureCards,
  linkPills,
  faq,
  legalDocument,
  ctaCard,
  toolCards,
  helpTopicsSection,
  promoList,
  tierCards,
  pageState,
  contactInfoSection,
  contactChannels,
  storeList,
  footerLinks,
  announcementBar,
  mobileTabsSection,
  headerLinksSection,
  articleGrid,
  questionList,
  concernTiles,
  collectionTiles,
  brandDirectory,
  searchApp,
  shopHero,
  shopListing,
  entityHeader,
  routineSteps,
  concernProducts,
  collectionHeader,
  collectionProducts,
  categoryChips,
  categoryHeader,
  advisorEntry,
  categoryListing,
  productDetail,
  relatedProducts,
  recentlyViewed,
  articlePage,
  questionArticle,
  questionProducts,
  relatedQuestions,
  cartApp,
  accountReferral,
  accountPoints,
  inkLinkCard,
  advisorQuiz,

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

/**
 * The locking rules, in the shape `edit.ts` asks for.
 *
 * It takes predicates rather than importing this file so that its tests can
 * run without React; this is the other end of that arrangement — one object,
 * built once, that the editor and the save route both pass in.
 *
 * A type the registry has never heard of is neither locked nor pinned: an
 * unknown section is already dropped at render time, and treating it as
 * locked here would make a document nobody can repair.
 */
export const SECTION_RULES: SectionRules = {
  isLocked: (type) => Boolean(SECTION_REGISTRY[type]?.locked),
  pinnedOf: (type) => SECTION_REGISTRY[type]?.pinned,
};

/** The locked sections a page of this kind cannot go live without. Used by
 *  the publish check — a /shop with no listing is a page that looks finished
 *  and sells nothing. */
export function requiredSectionsFor(kind: PageKind): AnySectionDefinition[] {
  return ALL.filter((def) => def.locked && def.enabledOn.includes(kind));
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
