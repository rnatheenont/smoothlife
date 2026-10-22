// Which permission each admin API route needs — the whole map, in one file.
//
// The alternative was a check inside each of the sixty-odd route handlers,
// which fails in the direction that matters: the day someone adds a route and
// forgets the check, it ships wide open and nothing says so. Here an
// unlisted route is refused (see `ruleFor` returning null and the proxy
// gate treating that as a denial), so forgetting this file breaks the route
// loudly in development instead of quietly in production.
//
// Order matters: the first prefix that matches wins, so a narrower path must
// be listed above the broader one it sits under — refunding money is not the
// same permission as reading the transaction list it lives under.

export type RouteRule = {
  prefix: string;
  /** null: any signed-in admin may call it, whatever their role. */
  permission: string | null;
  /** When present, the rule only applies to these methods. */
  methods?: string[];
};

/** No session at all — these are how you get one, or get back in. */
export const PUBLIC_ADMIN_ROUTES = [
  "/api/admin/login",
  "/api/admin/forgot-password",
  "/api/admin/reset-password",
];

const READ = ["GET", "HEAD"];

export const ADMIN_ROUTE_RULES: RouteRule[] = [
  // Who am I, am I still signed in, and the read-only landing numbers. Every
  // role sees these or the panel cannot render at all.
  { prefix: "/api/admin/me", permission: null },
  { prefix: "/api/admin/logout", permission: null },
  { prefix: "/api/admin/overview", permission: null },
  // The audit log keeps its own owner check inside the route, the way
  // /api/admin/users does — being signed in is only what gets you as far as
  // that check.
  { prefix: "/api/admin/audit", permission: null, methods: READ },

  // Accounts and roles keep their own, stricter gate inside the route
  // (checkOwnerSession — literally the owner, not a permission anyone can be
  // granted). Here they only need to be signed in; the route decides.
  { prefix: "/api/admin/users", permission: null },

  // Money. Reading a transaction and reversing one are different jobs:
  // support answers "did my payment go through", and that is as far as it
  // goes.
  // Asking 2C2P what really happened reads like support work; writing their
  // answer back can confirm a payment and create an order, which does not.
  // Receipt campaign: answering "did my receipt go through" is support work;
  // approving one hands out a claim on a ฿55,000 prize.
  // The campaign's sales figure is read-only and reads like the receipt
  // console it sits in a tab of — same permission, no write side at all.
  {
    prefix: "/api/admin/campaigns/dentiste-sales",
    permission: "receipts.view",
    methods: READ,
  },
  { prefix: "/api/admin/receipts", permission: "receipts.view", methods: READ },
  { prefix: "/api/admin/receipts", permission: "receipts.manage" },
  {
    prefix: "/api/admin/checkout-transactions/reconcile",
    permission: "checkout.view",
    methods: READ,
  },
  {
    prefix: "/api/admin/checkout-transactions/reconcile",
    permission: "checkout.refund",
  },
  {
    prefix: "/api/admin/checkout-transactions/refund",
    permission: "checkout.refund",
  },
  {
    prefix: "/api/admin/checkout-transactions/mark-refunded",
    permission: "checkout.refund",
  },
  { prefix: "/api/admin/checkout-transactions", permission: "checkout.view" },
  // Issuing a gift card creates money out of nothing.
  { prefix: "/api/admin/gift-cards", permission: "gift_cards.manage" },
  // Recomputes every customer's points at once.
  {
    prefix: "/api/admin/loyalty/recalculate",
    permission: "loyalty.recalculate",
  },

  // Knowledge base. Drafting and publishing are deliberately different: an
  // answer promoted from a real chat, or a correction filed against a wrong
  // one, lands as a draft that a person publishes — so support can do both
  // without being able to put words in the assistant's mouth.
  { prefix: "/api/admin/kb/promote", permission: "kb.draft" },
  { prefix: "/api/admin/kb/logs", permission: "kb.draft" },
  // Reading the base is part of drafting for it; changing what it says is
  // not — support can look up what the assistant is allowed to answer
  // without being able to rewrite it.
  // Reading the refusal rules is a draft-level job; changing one changes what
  // the assistant says to every customer at once, which is publishing.
  { prefix: "/api/admin/kb/blocked-topics", permission: "kb.draft", methods: READ },
  { prefix: "/api/admin/kb/blocked-topics", permission: "kb.publish" },
  { prefix: "/api/admin/kb/articles", permission: "kb.draft", methods: READ },
  { prefix: "/api/admin/kb/articles", permission: "kb.publish" },
  { prefix: "/api/admin/kb/reindex", permission: "kb.publish" },
  { prefix: "/api/admin/kb/seed", permission: "kb.publish" },
  // Importing. Reading a document and showing what it would do writes
  // nothing, so it is a drafting job; so is committing, because everything
  // lands as a draft. Undoing an import is not — it deletes rows and
  // restores others, and the rows it touches may have been published since.
  { prefix: "/api/admin/kb/import/rollback", permission: "kb.publish" },
  { prefix: "/api/admin/kb/import", permission: "kb.draft" },
  { prefix: "/api/admin/kb/export", permission: "kb.draft", methods: READ },
  // The topics are the tabs and chips on /faq: renaming one changes what
  // every customer sees, so changing them is publishing even though no
  // answer changed.
  { prefix: "/api/admin/kb/topics", permission: "kb.draft", methods: READ },
  { prefix: "/api/admin/kb/topics", permission: "kb.publish" },
  // The queue of questions nobody has answered, and what is done with one.
  // All of it is drafting: every action either writes a draft, files a
  // question away, or adds a search word to an existing answer. None of it
  // changes what a customer is told.
  { prefix: "/api/admin/kb/gaps", permission: "kb.draft" },
  // Reading how the FAQ centre is doing changes nothing.
  { prefix: "/api/admin/kb/stats", permission: "kb.draft", methods: READ },
  // Running the accuracy test reads the base and asks the embedding provider;
  // rebuilding the test set replaces it, which is how the number stops
  // meaning what it meant last week.
  { prefix: "/api/admin/kb/eval", permission: "kb.draft", methods: READ },
  { prefix: "/api/admin/kb/eval", permission: "kb.publish" },
  // Answering a question asked on a product page: the answer is shown to the
  // customer who asked, so it is a publish.
  { prefix: "/api/admin/product-questions", permission: "kb.publish" },

  // Page titles and descriptions, and the assistant that drafts them.
  { prefix: "/api/admin/seo", permission: "seo.manage" },

  // Customize Page. Reading a draft and publishing it are different jobs:
  // opening the editor to look at what is there should not require the right
  // to change what every visitor sees. Saving a draft counts as editing, not
  // publishing — a draft is not live, and making people wait for someone with
  // publish rights before they can type is how drafts end up in a chat thread
  // instead of in the tool.
  { prefix: "/api/admin/pages", permission: "pages.edit", methods: ["GET", "PUT"] },
  { prefix: "/api/admin/pages", permission: "pages.publish" },

  // The banners the home page is pulling from the shop right now, read-only,
  // so the editor can offer them as a starting point to edit. Reading them
  // is part of laying out a page, and there is no write side.
  { prefix: "/api/admin/hero-banners", permission: "pages.edit", methods: READ },

  // The picture library. Same permission as editing a page, because that is
  // what it is for — and uploading a picture nobody has placed yet changes
  // nothing a visitor can see.
  { prefix: "/api/admin/media", permission: "pages.edit" },

  // The free-form product content blocks (ingredients, how-to-use, etc. in
  // both languages) that overlay the generated catalogue — same split as
  // everywhere else content gets written: reading what's there is lighter
  // than publishing a change to a live product page.
  {
    prefix: "/api/admin/product-content",
    permission: "product_content.view",
    methods: READ,
  },
  {
    prefix: "/api/admin/product-content",
    permission: "product_content.manage",
  },

  // Which shelf a product sits on inside its category. Same pair of
  // permissions as the content blocks above, because it is the same job:
  // reading the review queue is lighter than deciding what a customer will
  // find when they open "กันแดด".
  {
    prefix: "/api/admin/product-subcategories",
    permission: "product_content.view",
    methods: READ,
  },
  {
    prefix: "/api/admin/product-subcategories",
    permission: "product_content.manage",
  },

  // Above the broad inbox rule, which its path would otherwise match first.
  // Same permission as answering: whoever is on the receiving end of
  // "somebody is waiting" is who should point it at the right place.
  { prefix: "/api/admin/inbox-alert-settings", permission: "inbox.manage" },
  // Covers the sub-routes too, ./analyze included — that one spends money per
  // press, so it wants a narrower permission of its own (inbox.ai_analysis in
  // the plan) listed above this line. Which roles should hold it is a question
  // for whoever runs the CS team; inventing the mapping here would be guessing
  // at someone else's workflow.
  { prefix: "/api/admin/inbox", permission: "inbox.manage" },
  { prefix: "/api/admin/canned-responses", permission: "inbox.manage" },
  { prefix: "/api/admin/customers", permission: "customers.manage" },
  { prefix: "/api/admin/reviews", permission: "reviews.manage" },

  // Points: reading a customer's balance is part of answering them; moving
  // it, and changing what a tier is worth, are not.
  { prefix: "/api/admin/points/adjust", permission: "points.manage" },
  // What the tiers are is reference for anyone answering a customer; what
  // they are worth is marketing's to set.
  {
    prefix: "/api/admin/points/tiers",
    permission: "points.view",
    methods: READ,
  },
  { prefix: "/api/admin/points/tiers", permission: "points.manage" },
  { prefix: "/api/admin/points/customers", permission: "points.view" },

  // Flash sale: fulfillment watches the queue to pack against it, marketing
  // runs the campaigns. Same paths, split by method.
  {
    prefix: "/api/admin/flash-sale",
    permission: "flash_sale.view",
    methods: READ,
  },
  { prefix: "/api/admin/flash-sale", permission: "flash_sale.manage" },

  // Staff sale: the employee shop. Reading is for HR and fulfillment —
  // who verified, what was bought, which orders still owe a refund. Writing
  // sets staff prices and spending caps, which is the shop's money.
  {
    prefix: "/api/admin/staff-sale",
    permission: "staff_sale.view",
    methods: READ,
  },
  { prefix: "/api/admin/staff-sale", permission: "staff_sale.manage" },

  { prefix: "/api/admin/free-gifts", permission: "free_gifts.manage" },
  // The questions offered under the AI field on the home page. Writing the
  // lines a shopper is nudged towards is the same job as drafting the
  // knowledge base, so it answers to the same permission rather than to a
  // new one nobody has been granted yet.
  { prefix: "/api/admin/chat-suggestions", permission: "kb.draft" },
  {
    prefix: "/api/admin/subscription-sets",
    permission: "subscription_sets.manage",
  },
  {
    prefix: "/api/admin/subscription-products",
    permission: "subscription_products.manage",
  },
  { prefix: "/api/admin/line-rich-menu", permission: "line_rich_menu.manage" },
  { prefix: "/api/admin/tracking-sync", permission: "tracking_sync.manage" },
  // Reading past signals is part of planning content; only marketing (and
  // owner/admin via '*') can trigger a sync, since it calls an external API
  // on every keyword and could be run into the ground if anyone could fire it.
  {
    prefix: "/api/admin/brand-insights",
    permission: "brand_signals.view",
    methods: READ,
  },
  { prefix: "/api/admin/brand-insights", permission: "brand_signals.manage" },
  {
    prefix: "/api/admin/brand-signals",
    permission: "brand_signals.view",
    methods: READ,
  },
  { prefix: "/api/admin/brand-signals", permission: "brand_signals.manage" },

  // Wiring the shop up to Shopify's webhooks — setup, not daily work.
  {
    prefix: "/api/admin/register-catalogue-webhooks",
    permission: "system.setup",
  },

  // Brand profiles (Customize Page, phase 5). Reading is part of editing a
  // page; saving is publishing, because a profile has no draft — the hero
  // picture and story appear on the brand's live page the moment they save.
  { prefix: "/api/admin/brands", permission: "pages.edit", methods: READ },
  { prefix: "/api/admin/brands", permission: "pages.publish" },

  // Asking for a review is an editing act, not a publishing one — the point
  // of the request is that the person making it cannot publish. Deciding on
  // the request stays on the pages endpoint, where pages.publish is required.
  { prefix: "/api/admin/page-review", permission: "pages.edit" },

  // Parking a brand profile to look at it is editing, not publishing — and
  // the person who cannot publish is the one who most needs to see it first.
  { prefix: "/api/admin/brand-profile-draft", permission: "pages.edit" },
];

/** The rule covering this request, or null when nothing covers it. */
export function ruleFor(pathname: string, method: string): RouteRule | null {
  const upper = method.toUpperCase();
  for (const rule of ADMIN_ROUTE_RULES) {
    if (pathname !== rule.prefix && !pathname.startsWith(`${rule.prefix}/`))
      continue;
    if (rule.methods && !rule.methods.includes(upper)) continue;
    return rule;
  }
  return null;
}

export function isPublicAdminRoute(pathname: string): boolean {
  return PUBLIC_ADMIN_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Every permission this map can ask for — used by the admin panel to hide
 * menu items a role cannot open, and by the test that keeps this file and
 * role_permissions from drifting apart.
 */
export const ALL_ROUTE_PERMISSIONS = [
  ...new Set(
    ADMIN_ROUTE_RULES.map((r) => r.permission).filter((p): p is string =>
      Boolean(p),
    ),
  ),
];
