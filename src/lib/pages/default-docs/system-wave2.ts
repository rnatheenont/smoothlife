// With the extension, so the unit tests can load this file without a bundler.
import { type PageDoc } from "../doc.ts";
import { doc, type DraftSection } from "./build.ts";

// The pages of wave 2, written as documents.
//
// Same rule as wave 1: each of these is the page already on the site, section
// by section, with the same words and the same marks. If something here
// differs from the hand-written page it is a mistake in here, not an
// improvement — the check that the page did not move is only possible while
// there is something to compare it against.
//
// Wave 2 is the listing side of the shop (/shop, /collections, /concern,
// /brands, /search) and the knowledge library. This file fills in as those
// pages move over; the registry in system-pages.ts lists them all, and the
// admin only offers the ones that have a document here.

/** A listing page's header: the title, one line under it, and nothing else.
 *  Four of the knowledge pages are exactly this plus their grid.
 *
 *  `layout: "document"` rather than "page" is the right one here and it is
 *  worth saying why: it puts the title 8px above its summary and sets the
 *  summary in the quieter grey with room under it, which is what these pages
 *  are already written as. "page" would set the summary a shade darker and in
 *  a narrower column — a visible change on the day the page moved. */
const listingHeader = (
  title: string,
  intro: string,
  over: { layout?: string; topRoom?: string } = {}
) => ({
  type: "page_header",
  v: 1,
  settings: {
    eyebrow: "",
    title,
    intro,
    image: "",
    align: "left",
    background: "page",
    layout: over.layout ?? "document",
    topRoom: over.topRoom ?? "page",
    mascot: "",
    eyebrowIcon: "",
  },
});

/** A page that is a header and one grid of guides, filtered to one kind. */
const guideIndex = (title: string, intro: string, category: string): PageDoc =>
  doc([
    listingHeader(title, intro),
    {
      type: "article_grid",
      v: 1,
      settings: { heading: "", headingSize: "base", source: "static", category, limit: 24, room: "end" },
    },
  ]);

/**
 * The knowledge hub: the title, the four ways in, the blog, the guides.
 *
 * The one adjusted gap on the page is the pills' `space.top`. The header's
 * document layout leaves 32px under its summary and this page has always had
 * 24px, so the row is nudged up one 8px step. Doing it here, where it shows
 * in the editor as "ชิดขึ้น", beats adding a third header layout that nobody
 * could describe the difference of.
 */
const knowledge = (): PageDoc =>
  doc([
    listingHeader("Beauty Knowledge", "คลังความรู้เรื่องผิวพรรณจากผู้เชี่ยวชาญ พร้อมแหล่งอ้างอิงที่น่าเชื่อถือ"),
    {
      type: "link_pills",
      v: 1,
      common: { space: { top: "-1" } },
      settings: {
        heading: "",
        room: "under_header",
        items: [
          { label: "Ingredient Library", href: "/knowledge/ingredients" },
          { label: "Routine Guides", href: "/knowledge/routines" },
          { label: "Question Hub", href: "/knowledge/questions" },
          { label: "Video and How-to", href: "/knowledge/videos" },
        ],
      },
    },
    {
      type: "article_grid",
      v: 1,
      settings: {
        heading: "บทความล่าสุด",
        headingSize: "base",
        source: "shopify",
        category: "",
        limit: 24,
        room: "between",
      },
    },
    {
      type: "article_grid",
      v: 1,
      settings: {
        heading: "Expert Guides",
        headingSize: "base",
        source: "static",
        category: "",
        limit: 24,
        room: "end",
      },
    },
  ]);

const knowledgeIngredients = (): PageDoc =>
  guideIndex("Ingredient Library", "ทำความรู้จักส่วนผสมสำคัญในผลิตภัณฑ์ดูแลผิว", "ingredient");

const knowledgeRoutines = (): PageDoc =>
  guideIndex("Routine Guides", "คู่มือจัดรูทีนดูแลผิวสำหรับทุกสภาพผิว", "routine");

const knowledgeVideos = (): PageDoc =>
  guideIndex("Video and How-to", "วิดีโอสาธิตวิธีใช้ผลิตภัณฑ์อย่างถูกต้อง", "video");

/**
 * The question hub: the answers the team published, then the guides about
 * them.
 *
 * The breadcrumb is here in "data_only" mode because the hand-written page
 * declared a BreadcrumbList and never drew a trail. Keeping the data and not
 * the row is what makes this page move into the system without moving on the
 * screen; whoever wants the row can turn it on in the editor, as a decision
 * rather than as a side effect of the move.
 *
 * The middle step is named from the registry, which carries a `crumb` of
 * "ความรู้เรื่องผิวและสุขภาพ" for /knowledge — the same words this page's
 * hand-written BreadcrumbList used. The trail is worked out from the page's
 * address on purpose (see the note in the breadcrumb section about typed
 * trails going stale), so the place to change that name is the registry.
 */
const questions = (): PageDoc =>
  doc([
    { type: "breadcrumb", v: 1, settings: { showHome: true, display: "data_only" } },
    listingHeader("คำถามที่พบบ่อย", "คำถามที่ลูกค้าถามเข้ามาจริง พร้อมคำตอบจากทีมงาน"),
    { type: "question_list", v: 1, settings: {} },
    {
      type: "article_grid",
      v: 1,
      settings: { heading: "บทความตอบคำถาม", headingSize: "lg", source: "static", category: "qa", limit: 24, room: "end" },
    },
  ]);

/** The concern hub: the header, then every concern as a picture. */
const concernHub = (): PageDoc =>
  doc([
    listingHeader(
      "ช้อปตามปัญหาผิวที่กังวล",
      "เลือกดูผลิตภัณฑ์ที่ตรงกับความต้องการของผิวคุณ พร้อมคำแนะนำจากผู้เชี่ยวชาญ"
    ),
    {
      type: "concern_tiles",
      v: 1,
      settings: {
        showAdvisor: true,
        advisorTitle: "ไม่แน่ใจว่าผิวคุณกังวลเรื่องอะไร?",
        advisorCta: "ให้น้อง Smoothie ช่วยประเมิน →",
        advisorHref: "/advisor",
      },
    },
  ]);

/**
 * The collections index: the trail, the title, then the tiles.
 *
 * Three things about this one are unlike the pages before it, and all three
 * come from the page as it is written today rather than from a preference.
 *
 * The breadcrumb is the top of the page, not a strip above a header, so it
 * carries the page's top padding ("room": "page") and the header carries
 * none. The header is the "listing" rhythm, where the line under the title
 * sits 4px away instead of 8. And the line under the title is not in the
 * header at all: it counts the collections, so it belongs to the block that
 * has them — a header that said "72 คอลเลกชัน" would be a number frozen on
 * the day somebody typed it.
 *
 * The last step reads "คอลเลกชัน", not the "คอลเลกชันทั้งหมด" the admin
 * list calls this page: the registry entry carries a shorter `crumb` for the
 * trail. Two steps of the same trail saying the same long words, and then
 * the h1 saying them a third time, places nothing.
 */
const collectionsIndex = (): PageDoc =>
  doc([
    { type: "breadcrumb", v: 1, settings: { showHome: true, display: "row", room: "page" } },
    listingHeader("คอลเลกชันทั้งหมด", "", { layout: "listing", topRoom: "none" }),
    {
      type: "collection_tiles",
      v: 1,
      settings: { countSuffix: "คอลเลกชัน อัปเดตตรงจากร้าน", emptyText: "ยังไม่มีคอลเลกชันในขณะนี้" },
    },
  ]);

/**
 * /brands and /search: one locked block each, and nothing above it yet.
 *
 * A document with a single section it cannot remove looks like a waste of a
 * document until you want the thing these pages have never had — a line of
 * copy above the directory during a brand launch, a promo under the search
 * box. That is what these two exist for; today they draw exactly what the
 * routes drew.
 */
const brandsIndex = (): PageDoc => doc([{ type: "brand_directory", v: 1, settings: {} }]);

const search = (): PageDoc => doc([{ type: "search_app", v: 1, settings: { loadingText: "กำลังโหลด…" } }]);

/**
 * The shop: the banner, then everything else.
 *
 * Two blocks rather than three. The category row belongs inside the listing
 * because it is sticky and a sticky element can only travel inside its own
 * parent — see the note in the shop_listing section. Splitting it out would
 * have made it stop pinning after 24 pixels.
 */
const shop = (): PageDoc =>
  doc([
    {
      type: "shop_hero",
      v: 1,
      settings: { eyebrow: "PRODUCTS", title: "สินค้าทั้งหมด", subtitle: "ดูแลตัวเองได้ง่าย ๆ ในทุกวัน" },
    },
    { type: "shop_listing", v: 1, settings: {} },
  ]);

/**
 * The cart: one locked block, and room around it.
 *
 * Wave 4 rather than wave 2, and it lives in this file because the file is
 * where the documents that are "one locked app" already are — /brands and
 * /search are the same shape. The wave comes from the registry, not from
 * which file the document is written in.
 */
const cart = (): PageDoc => doc([{ type: "cart_app", v: 1, settings: {} }]);

/**
 * The two account pages that take a marketing line.
 *
 * One locked block each, which looks like a waste of a document until the
 * month somebody wants to say "ชวนเพื่อนเดือนนี้ได้คูปองเพิ่ม" above the
 * share link, or what 500 points buys this month above the points table.
 *
 * /account/login is deliberately not here, and the reason is structural
 * rather than a matter of time: its body swaps the entire site chrome when
 * the visitor is on their way back to a campaign (CampaignChrome reads
 * ?returnTo), which is not something a page built of sections inside the
 * normal chrome can express. A promo block wrapped around a sign-in form is
 * also the least useful slot in the set.
 */
const accountReferralPage = (): PageDoc => doc([{ type: "account_referral", v: 1, settings: {} }]);

const accountPointsPage = (): PageDoc => doc([{ type: "account_points", v: 1, settings: {} }]);

/**
 * The three advisors.
 *
 * Same three blocks each: the mascot header, the quiz, and on /advisor a dark
 * band that offers the camera scan instead. The questions are locked — they
 * are the product — and everything written above them is now editable, which
 * is the whole reason these pages are worth moving.
 *
 * The one adjusted gap is the header's `space.bottom`. The mascot header
 * leaves 32px under its row and all three of these pages have always had 24,
 * so it is pulled up one 8px step — the same nudge /knowledge needed, for the
 * same reason, and visible in the editor as "ชิดขึ้น".
 */
const advisorHeader = (over: {
  eyebrow: string;
  title: string;
  intro: string;
  mascotSize?: string;
}): DraftSection => ({
  type: "page_header",
  v: 1,
  common: { space: { bottom: "-1" } },
  settings: {
    eyebrow: over.eyebrow,
    title: over.title,
    intro: over.intro,
    image: "",
    align: "left",
    background: "page",
    layout: "page",
    topRoom: "page",
    mascot: "/mascot/smoothie-hi.png",
    mascotSize: over.mascotSize ?? "md",
    eyebrowIcon: "sparkles",
  },
});

const advisor = (): PageDoc =>
  doc([
    advisorHeader({
      eyebrow: "Guided Assessment",
      title: "น้อง Smoothie",
      intro: "ผู้ช่วย AI ของ Smoothlife.com แนะนำสกินแคร์และวิเคราะห์ผิวให้คุณ",
      mascotSize: "lg",
    }),
    {
      type: "ink_link_card",
      v: 1,
      settings: {
        title: "สแกนผิวสดด้วยกล้องหน้า",
        body: "ระบบจับโครงหน้าแล้วถ่ายให้เอง 3 มุมในราว 10 วินาที บอกอายุผิว สิว รูขุมขน จุดด่างดำ ริ้วรอย พร้อมสินค้าที่ตรงกับผลของคุณ",
        href: "/skin-coach",
        icon: "camera",
        image: "",
        padding: "md",
        room: "md",
      },
    },
    { type: "advisor_quiz", v: 1, settings: { variant: "skin" } },
  ]);

const supplementAdvisor = (): PageDoc =>
  doc([
    advisorHeader({
      eyebrow: "Supplement Advisor",
      title: "หาอาหารเสริมที่ใช่สำหรับคุณ",
      intro: "ตอบ 5 คำถาม รับแพลนดูแลตัวเองที่พอดีกับเป้าหมายและงบของคุณ",
    }),
    { type: "advisor_quiz", v: 1, settings: { variant: "supplement" } },
  ]);

const oralCareAdvisor = (): PageDoc =>
  doc([
    advisorHeader({
      eyebrow: "Oral Care Advisor",
      title: "เลือกชุดดูแลช่องปากที่ใช่สำหรับคุณ",
      intro: "ตอบ 3 คำถาม รับเซ็ตแนะนำแบบพอดีตัวใน 30 วินาที",
    }),
    { type: "advisor_quiz", v: 1, settings: { variant: "oral_care" } },
  ]);

/**
 * The subscription page: five blocks, three of them locked.
 *
 * A lit dark banner with the two ways to subscribe as its two buttons,
 * then those two ways in full, then an invitation to build a set, then
 * the terms — folded, at the end. The banner's buttons are anchors into
 * this same page: a banner that asks for a subscription and offers
 * nothing to press is a screenful spent on nothing.
 *
 * The terms used to sit second, above every price on the page, on the
 * reasoning that they belong above the thing they are the terms of. Read as
 * a visitor rather than as a lawyer, that is three cards of dense billing
 * copy standing between somebody and the first thing they could buy. The
 * terms of a thing cannot be read before the thing. They are still one tap
 * away, and the line under each subscribe button still says what the charge
 * does.
 *
 * The two numbers in the copy are tokens, not typed digits: {discount} is the
 * best plan's percentage and {bundleDiscount} is the bundle discount, both
 * from data/subscriptions.ts. A headline promising 15% beside a plan table
 * offering 20% is worse than no headline at all.
 */
const subscription = (): PageDoc =>
  doc([
    {
      type: "subscription_hero",
      v: 1,
      settings: {
        badge: "Smoothlife Subscription",
        title: "ดูแลตัวเองต่อเนื่อง\nไม่ต้องสั่งซ้ำ ประหยัดสูงสุด {discount}%",
        intro:
          "เลือกสินค้าที่ใช้ประจำ กำหนดรอบส่งของคุณเอง 3 / 6 หรือ 12 เดือน ยิ่งเลือกรอบยาว ยิ่งได้ส่วนลดมากขึ้น",
        ctaLabel: "เลือกชุดสมัครสมาชิก",
        ctaHref: "#subscription-sets",
        ctaSecondaryLabel: "เลือกสินค้าเอง",
        ctaSecondaryHref: "#subscription-picker",
        perks: [
          { icon: "truck", label: "ส่งฟรีทุกรอบ" },
          { icon: "clock", label: "เลือกรอบส่ง 3 / 6 / 12 เดือน" },
          { icon: "shield", label: "ของแท้ 100% มีอย." },
        ],
      },
    },
    {
      type: "subscription_sets",
      v: 1,
      settings: {
        heading: "เลือกชุดสมัครสมาชิก",
        intro: "ชุดสินค้าที่ทีมคัดมาให้ครบ ไม่ต้องเลือกเอง ใช้ต่อเนื่องได้จริง",
      },
    },
    {
      type: "subscription_picker",
      v: 1,
      settings: {
        heading: "หรือเลือกสินค้าเอง",
        intro: "อยากได้แค่สินค้าชิ้นเดียวแบบสมัครรายรอบ เลือกได้จากที่นี่",
      },
    },
    {
      type: "subscription_build",
      v: 1,
      settings: {
        title: "จัดชุดสินค้าเอง",
        body: "เลือกสินค้าที่ใช้ประจำมาจัดเป็นชุดของตัวเอง รับส่วนลดชุดพิเศษ -{bundleDiscount}% ซ้อนทับกับส่วนลดตามรอบที่เลือกได้อีก",
        cta: "เริ่มจัดชุด",
        href: "/subscription/build",
      },
    },
    { type: "subscription_terms", v: 1, settings: {} },
  ]);

/** Merged into SYSTEM_DEFAULT_DOCS. Keyed by the registry's page key, and a
 *  page with no entry here is simply not offered in the admin yet. */
export const WAVE2_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  knowledge,
  "knowledge-ingredients": knowledgeIngredients,
  "knowledge-routines": knowledgeRoutines,
  "knowledge-videos": knowledgeVideos,
  questions,
  "concern-hub": concernHub,
  collections: collectionsIndex,
  brands: brandsIndex,
  search,
  shop,
  cart,
  "account-referral": accountReferralPage,
  "account-points": accountPointsPage,
  advisor,
  "supplement-advisor": supplementAdvisor,
  "oral-care-advisor": oralCareAdvisor,
  subscription,
};
