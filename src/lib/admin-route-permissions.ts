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
  { prefix: "/api/admin/receipts", permission: "receipts.view", methods: READ },
  { prefix: "/api/admin/receipts", permission: "receipts.manage" },
  { prefix: "/api/admin/checkout-transactions/reconcile", permission: "checkout.view", methods: READ },
  { prefix: "/api/admin/checkout-transactions/reconcile", permission: "checkout.refund" },
  { prefix: "/api/admin/checkout-transactions/refund", permission: "checkout.refund" },
  { prefix: "/api/admin/checkout-transactions/mark-refunded", permission: "checkout.refund" },
  { prefix: "/api/admin/checkout-transactions", permission: "checkout.view" },
  // Issuing a gift card creates money out of nothing.
  { prefix: "/api/admin/gift-cards", permission: "gift_cards.manage" },
  // Recomputes every customer's points at once.
  { prefix: "/api/admin/loyalty/recalculate", permission: "loyalty.recalculate" },

  // Knowledge base. Drafting and publishing are deliberately different: an
  // answer promoted from a real chat, or a correction filed against a wrong
  // one, lands as a draft that a person publishes — so support can do both
  // without being able to put words in the assistant's mouth.
  { prefix: "/api/admin/kb/promote", permission: "kb.draft" },
  { prefix: "/api/admin/kb/logs", permission: "kb.draft" },
  // Reading the base is part of drafting for it; changing what it says is
  // not — support can look up what the assistant is allowed to answer
  // without being able to rewrite it.
  { prefix: "/api/admin/kb/articles", permission: "kb.draft", methods: READ },
  { prefix: "/api/admin/kb/articles", permission: "kb.publish" },
  { prefix: "/api/admin/kb/reindex", permission: "kb.publish" },
  { prefix: "/api/admin/kb/seed", permission: "kb.publish" },
  { prefix: "/api/admin/kb/sync-products", permission: "kb.publish" },

  // Page titles and descriptions, and the assistant that drafts them.
  { prefix: "/api/admin/seo", permission: "seo.manage" },

  { prefix: "/api/admin/inbox", permission: "inbox.manage" },
  { prefix: "/api/admin/canned-responses", permission: "inbox.manage" },
  { prefix: "/api/admin/customers", permission: "customers.manage" },
  { prefix: "/api/admin/reviews", permission: "reviews.manage" },

  // Points: reading a customer's balance is part of answering them; moving
  // it, and changing what a tier is worth, are not.
  { prefix: "/api/admin/points/adjust", permission: "points.manage" },
  // What the tiers are is reference for anyone answering a customer; what
  // they are worth is marketing's to set.
  { prefix: "/api/admin/points/tiers", permission: "points.view", methods: READ },
  { prefix: "/api/admin/points/tiers", permission: "points.manage" },
  { prefix: "/api/admin/points/customers", permission: "points.view" },

  // Flash sale: fulfillment watches the queue to pack against it, marketing
  // runs the campaigns. Same paths, split by method.
  { prefix: "/api/admin/flash-sale", permission: "flash_sale.view", methods: READ },
  { prefix: "/api/admin/flash-sale", permission: "flash_sale.manage" },

  { prefix: "/api/admin/free-gifts", permission: "free_gifts.manage" },
  { prefix: "/api/admin/subscription-sets", permission: "subscription_sets.manage" },
  { prefix: "/api/admin/subscription-products", permission: "subscription_products.manage" },
  { prefix: "/api/admin/line-rich-menu", permission: "line_rich_menu.manage" },
  { prefix: "/api/admin/tracking-sync", permission: "tracking_sync.manage" },
  // Reading past signals is part of planning content; only marketing (and
  // owner/admin via '*') can trigger a sync, since it calls an external API
  // on every keyword and could be run into the ground if anyone could fire it.
  { prefix: "/api/admin/brand-insights", permission: "brand_signals.view", methods: READ },
  { prefix: "/api/admin/brand-insights", permission: "brand_signals.manage" },
  { prefix: "/api/admin/brand-signals", permission: "brand_signals.view", methods: READ },
  { prefix: "/api/admin/brand-signals", permission: "brand_signals.manage" },

  // Wiring the shop up to Shopify's webhooks — setup, not daily work.
  { prefix: "/api/admin/register-catalogue-webhooks", permission: "system.setup" },
];

/** The rule covering this request, or null when nothing covers it. */
export function ruleFor(pathname: string, method: string): RouteRule | null {
  const upper = method.toUpperCase();
  for (const rule of ADMIN_ROUTE_RULES) {
    if (pathname !== rule.prefix && !pathname.startsWith(`${rule.prefix}/`)) continue;
    if (rule.methods && !rule.methods.includes(upper)) continue;
    return rule;
  }
  return null;
}

export function isPublicAdminRoute(pathname: string): boolean {
  return PUBLIC_ADMIN_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Every permission this map can ask for — used by the admin panel to hide
 * menu items a role cannot open, and by the test that keeps this file and
 * role_permissions from drifting apart.
 */
export const ALL_ROUTE_PERMISSIONS = [
  ...new Set(ADMIN_ROUTE_RULES.map((r) => r.permission).filter((p): p is string => Boolean(p))),
];
