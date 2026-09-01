// Server-only Shopify Admin API access via the client credentials grant.
// Needs a *separate* custom-app credential pair with Admin scopes (unlike
// the Storefront token, which is public-safe) — see SHOPIFY_ADMIN_CLIENT_ID
// / SHOPIFY_ADMIN_CLIENT_SECRET in .env.example. Never import from a "use
// client" component.
const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_ADMIN_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
const API_VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || "2025-10";
// The live smoothlife.com storefront itself (Shopify's own theme), not this
// Next.js app's own origin — used to build fallback links to Shopify pages/
// products/collections this app doesn't have its own route for. Same
// constant convention as src/lib/json-ld.ts.
const STOREFRONT_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://www.smoothlife.com";

export function shopifyAdminConfigured() {
  return Boolean(SHOP && CLIENT_ID && CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAdminAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Shopify OAuth token exchange failed: ${res.status}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

async function adminGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await getAdminAccessToken();
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify Admin GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

export type ShopifyCustomerAddress = {
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  country: string | null;
};

export type ShopifyCustomerMatch = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  defaultAddress: ShopifyCustomerAddress | null;
};

const CUSTOMER_FIELDS = `id firstName lastName phone defaultAddress { address1 address2 city province zip country }`;

// Looks up an existing Shopify customer by email so a new local signup can
// link to their real purchase history immediately instead of waiting for
// the first orders/paid webhook to backfill shopify_customer_id. Returns
// null on no match OR on any API error (e.g. the custom app's token doesn't
// have the read_customers scope) — this is a best-effort enhancement, never
// something that should block registration/login.
export async function findShopifyCustomerByEmail(email: string): Promise<ShopifyCustomerMatch | null> {
  if (!shopifyAdminConfigured()) return null;
  try {
    const data = await adminGraphql<{
      customers: { edges: { node: ShopifyCustomerMatch }[] };
    }>(
      `query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          edges { node { ${CUSTOMER_FIELDS} } }
        }
      }`,
      { query: `email:${JSON.stringify(email)}` }
    );
    const node = data.customers.edges[0]?.node;
    return node || null;
  } catch (err) {
    console.error("[shopify-admin] findShopifyCustomerByEmail failed", err);
    return null;
  }
}

// Same idea as findShopifyCustomerByEmail but keyed on phone — used by the
// phone-OTP signup path, which has no email to match on.
export async function findShopifyCustomerByPhone(phone: string): Promise<ShopifyCustomerMatch | null> {
  if (!shopifyAdminConfigured()) return null;
  try {
    const data = await adminGraphql<{
      customers: { edges: { node: ShopifyCustomerMatch }[] };
    }>(
      `query FindCustomerByPhone($query: String!) {
        customers(first: 1, query: $query) {
          edges { node { ${CUSTOMER_FIELDS} } }
        }
      }`,
      { query: `phone:${JSON.stringify(phone)}` }
    );
    const node = data.customers.edges[0]?.node;
    return node || null;
  } catch (err) {
    console.error("[shopify-admin] findShopifyCustomerByPhone failed", err);
    return null;
  }
}

// Turns a theme slide's "shopify://..." link reference into a real URL.
// Collections/products/pages all live on the real Shopify-hosted storefront
// (smoothlife.com), not this app, so they resolve there rather than to a
// local route that doesn't exist.
function resolveBannerLink(ref: unknown): string {
  if (typeof ref !== "string" || !ref) return "/shop";
  const collection = ref.match(/^shopify:\/\/collections\/(.+)$/);
  if (collection) return `${STOREFRONT_ORIGIN}/collections/${collection[1]}`;
  const product = ref.match(/^shopify:\/\/products\/(.+)$/);
  if (product) return `${STOREFRONT_ORIGIN}/products/${product[1]}`;
  const page = ref.match(/^shopify:\/\/pages\/(.+)$/);
  if (page) return `${STOREFRONT_ORIGIN}/pages/${page[1]}`;
  return "/shop";
}

type ThemeSectionBlock = { type: string; disabled?: boolean; settings?: Record<string, unknown> };
type ThemeSectionsFile = {
  sections: Record<string, { type: string; disabled?: boolean; blocks?: Record<string, ThemeSectionBlock> }>;
};

// The live banner slideshow is a theme "app block" edited via the Shopify
// theme customizer, not a fixed section — find it by shape (any enabled
// block whose settings include a slide_1_image), not by section/block id,
// since the id changes whenever someone edits the slideshow in Shopify.
function findSlideshowSettings(file: ThemeSectionsFile): Record<string, unknown> | null {
  for (const section of Object.values(file.sections)) {
    if (section.disabled) continue;
    for (const block of Object.values(section.blocks ?? {})) {
      if (block.disabled) continue;
      if (typeof block.settings?.slide_1_image === "string") return block.settings;
    }
  }
  return null;
}

export type LiveHeroBanner = { slug: string; image: string; href: string };

// Pulls the homepage hero banner straight from the *published* Shopify
// theme (the same slideshow block the team edits on smoothlife.com), so
// this app's hero mirrors it without a code change/redeploy here. Needs the
// custom app behind SHOPIFY_ADMIN_CLIENT_ID to have the read_themes and
// read_files Admin scopes; returns null (caller falls back to the static
// heroBanners list) on any missing scope, structural change, or error.
// Throws on any failure (missing scope, GraphQL error, bad theme shape) —
// getLiveHeroBanners() below is the safe wrapper every real call site uses;
// this raw version exists so the temporary debug route can surface the
// actual reason instead of a silent null.
async function getLiveHeroBannersUnsafe(): Promise<LiveHeroBanner[] | null> {
  const themesData = await adminGraphql<{ themes: { nodes: { id: string; role: string }[] } }>(
    `query { themes(first: 20) { nodes { id role } } }`
  );
  const mainTheme = themesData.themes.nodes.find((t) => t.role === "MAIN");
  if (!mainTheme) return null;

  const fileData = await adminGraphql<{
    theme: { files: { nodes: { body: { content?: string } }[] } } | null;
  }>(
    `query ThemeIndexFile($id: ID!) {
      theme(id: $id) {
        files(filenames: ["templates/index.json"]) {
          nodes { body { ... on OnlineStoreThemeFileBodyText { content } } }
        }
      }
    }`,
    { id: mainTheme.id }
  );
  const raw = fileData.theme?.files.nodes[0]?.body.content;
  if (!raw) return null;
  // Strip Shopify's leading "auto-generated, do not edit" block comment —
  // the file isn't valid JSON until that's removed.
  const parsed: ThemeSectionsFile = JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\//, ""));
  const settings = findSlideshowSettings(parsed);
  if (!settings) return null;

  const slides: { filename: string; href: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    if (settings[`slide_${i}_enabled`] === false) continue;
    const imageRef = settings[`slide_${i}_image`];
    if (typeof imageRef !== "string") continue;
    const match = imageRef.match(/^shopify:\/\/shop_images\/(.+)$/);
    if (!match) continue;
    slides.push({ filename: match[1], href: resolveBannerLink(settings[`slide_${i}_link`]) });
  }
  if (slides.length === 0) return null;

  const aliasQuery = slides
    .map(
      (s, i) =>
        `f${i}: files(first: 1, query: ${JSON.stringify(`filename:${s.filename}`)}) { nodes { ... on MediaImage { image { url } } } }`
    )
    .join("\n");
  const filesData = await adminGraphql<Record<string, { nodes: { image?: { url: string } }[] }>>(
    `query BannerImages { ${aliasQuery} }`
  );

  const banners: LiveHeroBanner[] = [];
  slides.forEach((slide, i) => {
    const url = filesData[`f${i}`]?.nodes[0]?.image?.url;
    if (url) banners.push({ slug: `live-${i}`, image: url, href: slide.href });
  });
  return banners.length > 0 ? banners : null;
}

export async function getLiveHeroBanners(): Promise<LiveHeroBanner[] | null> {
  if (!shopifyAdminConfigured()) return null;
  try {
    return await getLiveHeroBannersUnsafe();
  } catch (err) {
    console.error("[shopify-admin] getLiveHeroBanners failed", err);
    return null;
  }
}

// TEMPORARY — for diagnosing why production falls back to the static
// banners despite valid credentials. Remove this and its route once fixed.
export async function getLiveHeroBannersDebug(): Promise<{
  configured: boolean;
  result?: LiveHeroBanner[] | null;
  error?: string;
}> {
  if (!shopifyAdminConfigured()) return { configured: false };
  try {
    const result = await getLiveHeroBannersUnsafe();
    return { configured: true, result };
  } catch (err) {
    return { configured: true, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

// Creates a brand-new Shopify customer for someone who registered on our
// site but has no existing purchase history there, so Shopify stays the
// complete customer list regardless of where an account originated. Needs
// at least one of email/phone (Shopify requires a way to contact the
// customer). Best-effort like the lookups above: logs and returns null on
// any error (duplicate email/phone, missing scope, etc) rather than
// blocking registration.
export async function createShopifyCustomer(opts: {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<{ id: string } | null> {
  if (!shopifyAdminConfigured()) return null;
  if (!opts.email && !opts.phone) return null;
  try {
    const data = await adminGraphql<{
      customerCreate: { customer: { id: string } | null; userErrors: { field: string[]; message: string }[] };
    }>(
      `mutation CreateCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }`,
      {
        input: {
          ...(opts.email ? { email: opts.email } : {}),
          ...(opts.phone ? { phone: opts.phone } : {}),
          ...(opts.firstName ? { firstName: opts.firstName } : {}),
          ...(opts.lastName ? { lastName: opts.lastName } : {}),
        },
      }
    );
    if (data.customerCreate.userErrors.length) {
      console.error("[shopify-admin] createShopifyCustomer userErrors", data.customerCreate.userErrors);
      return null;
    }
    return data.customerCreate.customer;
  } catch (err) {
    console.error("[shopify-admin] createShopifyCustomer failed", err);
    return null;
  }
}

export type ShopifyOrderSummary = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  total: string;
  currency: string;
  items: { title: string; quantity: number; slug: string | null }[];
  trackingNumbers: string[];
};

// Real recent order history + fulfillment status for a linked Shopify
// customer, used by the chat assistant to answer "where's my order"-style
// questions honestly instead of guessing. Returns null on no match, missing
// scope, or any API error — best-effort, never blocks the chat response.
export async function getCustomerOrders(shopifyCustomerId: string, limit = 5): Promise<ShopifyOrderSummary[] | null> {
  if (!shopifyAdminConfigured()) return null;
  const gid = shopifyCustomerId.startsWith("gid://")
    ? shopifyCustomerId
    : `gid://shopify/Customer/${shopifyCustomerId}`;
  try {
    const data = await adminGraphql<{
      customer: {
        orders: {
          edges: {
            node: {
              id: string;
              name: string;
              createdAt: string;
              displayFinancialStatus: string | null;
              displayFulfillmentStatus: string | null;
              currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
              lineItems: {
                edges: { node: { title: string; quantity: number; product: { handle: string } | null } }[];
              };
              fulfillments: { trackingInfo: { number: string | null }[] }[];
            };
          }[];
        };
      } | null;
    }>(
      `query CustomerOrders($id: ID!, $limit: Int!) {
        customer(id: $id) {
          orders(first: $limit, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                currentTotalPriceSet { shopMoney { amount currencyCode } }
                lineItems(first: 5) { edges { node { title quantity product { handle } } } }
                fulfillments(first: 3) { trackingInfo { number } }
              }
            }
          }
        }
      }`,
      { id: gid, limit }
    );
    const edges = data.customer?.orders.edges || [];
    return edges.map(({ node }) => ({
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      total: node.currentTotalPriceSet.shopMoney.amount,
      currency: node.currentTotalPriceSet.shopMoney.currencyCode,
      items: node.lineItems.edges.map((e) => ({
        title: e.node.title,
        quantity: e.node.quantity,
        slug: e.node.product?.handle || null,
      })),
      trackingNumbers: node.fulfillments.flatMap((f) => f.trackingInfo.map((t) => t.number).filter(Boolean) as string[]),
    }));
  } catch (err) {
    console.error("[shopify-admin] getCustomerOrders failed", err);
    return null;
  }
}

// Fulfillment status for a single order by its numeric (webhook-payload)
// ID. Used as a cron-poll fallback for the referral programme's delivery
// step, in case the "orders/fulfilled" webhook topic never gets subscribed
// in Shopify — see @/lib/referral-cron. Best-effort: any failure just means
// "can't tell yet," not a crash.
export async function getOrderFulfillmentStatus(orderId: string): Promise<{ fulfilled: boolean } | null> {
  if (!shopifyAdminConfigured()) return null;
  const gid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
  try {
    const data = await adminGraphql<{ order: { displayFulfillmentStatus: string } | null }>(
      `query OrderFulfillmentStatus($id: ID!) {
        order(id: $id) { displayFulfillmentStatus }
      }`,
      { id: gid }
    );
    if (!data.order) return null;
    return { fulfilled: data.order.displayFulfillmentStatus === "FULFILLED" };
  } catch (err) {
    console.error("[shopify-admin] getOrderFulfillmentStatus failed", err);
    return null;
  }
}

// Verified-purchase lookup for the review-points feature: did this customer
// actually pay for this product, and which order? Reuses getCustomerOrders
// with a larger limit than the chat assistant needs, since here we're
// scanning full order history rather than just the most recent few.
// Best-effort like the rest of this file — any lookup failure just means
// "can't verify," not a crash.
//
// The 60-day review window is meant to run from delivery (see the loyalty
// plan doc), but this app doesn't fetch fulfillment delivery events —
// order.createdAt (paid date) is used as a conservative stand-in. That
// means the window can start a few days earlier than true delivery; a real
// deliveredAt lookup is a follow-up, not implemented here.
export async function findPaidOrderForProduct(
  shopifyCustomerId: string,
  productSlug: string
): Promise<{ orderId: string; orderName: string; paidAt: string } | null> {
  const orders = await getCustomerOrders(shopifyCustomerId, 100);
  if (!orders) return null;
  const match = orders.find(
    (order) => order.financialStatus === "PAID" && order.items.some((item) => item.slug === productSlug)
  );
  return match ? { orderId: match.id, orderName: match.name, paidAt: match.createdAt } : null;
}

export type VariantAvailability = {
  availableForSale: boolean;
  /** Real Shopify inventory count — null when the store doesn't track/expose it for this variant. */
  inventoryQuantity: number | null;
  /** DENY = Shopify itself refuses to sell past zero stock; CONTINUE = it allows overselling. */
  inventoryPolicy: "DENY" | "CONTINUE" | null;
};

// Live stock check, straight from Shopify — used wherever a decision needs
// the *current* truth rather than the build-time catalogue snapshot (e.g.
// before letting a recurring subscription charge go through). Returns null
// on any failure (unconfigured, bad variant id, API error) — callers must
// treat that as "couldn't verify," not "in stock."
export async function getVariantAvailability(variantId: string): Promise<VariantAvailability | null> {
  if (!shopifyAdminConfigured()) return null;
  try {
    const data = await adminGraphql<{
      productVariant: { availableForSale: boolean; inventoryQuantity: number | null; inventoryPolicy: string } | null;
    }>(
      `query VariantAvailability($id: ID!) {
        productVariant(id: $id) {
          availableForSale
          inventoryQuantity
          inventoryPolicy
        }
      }`,
      { id: variantId }
    );
    const v = data.productVariant;
    if (!v) return null;
    return {
      availableForSale: v.availableForSale,
      inventoryQuantity: v.inventoryQuantity,
      inventoryPolicy: v.inventoryPolicy === "CONTINUE" ? "CONTINUE" : v.inventoryPolicy === "DENY" ? "DENY" : null,
    };
  } catch (err) {
    console.error("[shopify-admin] getVariantAvailability failed", err);
    return null;
  }
}

// Creates a real, single-use percentage discount code redeemable once per
// customer. Returns the code string.
export async function createPercentDiscountCode(opts: {
  title: string;
  code: string;
  percentage: number; // 0-1
  usageLimit?: number;
}): Promise<string> {
  const data = await adminGraphql<{
    discountCodeBasicCreate: { codeDiscountNode: { id: string } | null; userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation CreateDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      basicCodeDiscount: {
        title: opts.title,
        code: opts.code,
        startsAt: new Date().toISOString(),
        usageLimit: opts.usageLimit ?? 1,
        appliesOncePerCustomer: true,
        customerSelection: { all: true },
        customerGets: {
          value: { percentage: opts.percentage },
          items: { all: true },
        },
      },
    }
  );
  if (data.discountCodeBasicCreate.userErrors.length) {
    throw new Error(data.discountCodeBasicCreate.userErrors.map((e) => e.message).join(", "));
  }
  return opts.code;
}

// Same as createPercentDiscountCode but a fixed baht amount off the order
// total instead of a percentage — used for point-redemption tiers like
// "1000 points = ฿100 off", and for referral rewards/welcome discounts.
export async function createAmountDiscountCode(opts: {
  title: string;
  code: string;
  amount: number; // THB, applied once to the whole order
  usageLimit?: number;
  minSubtotal?: number; // THB — enforced by Shopify itself, not just app-side display logic
}): Promise<string> {
  const data = await adminGraphql<{
    discountCodeBasicCreate: { codeDiscountNode: { id: string } | null; userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation CreateDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      basicCodeDiscount: {
        title: opts.title,
        code: opts.code,
        startsAt: new Date().toISOString(),
        usageLimit: opts.usageLimit ?? 1,
        appliesOncePerCustomer: true,
        customerSelection: { all: true },
        minimumRequirement: opts.minSubtotal
          ? { subtotal: { greaterThanOrEqualToSubtotal: String(opts.minSubtotal) } }
          : undefined,
        customerGets: {
          value: { discountAmount: { amount: opts.amount, appliesOnEachItem: false } },
          items: { all: true },
        },
      },
    }
  );
  if (data.discountCodeBasicCreate.userErrors.length) {
    throw new Error(data.discountCodeBasicCreate.userErrors.map((e) => e.message).join(", "));
  }
  return opts.code;
}

// Creates a real, automatic (no customer-facing code) "buy X get Y free"
// discount — the free-gifts framework's enforcement side. Not called
// anywhere yet; run manually (e.g. from a one-off script or directly via
// the Shopify Admin API) when a real BXGY promo is ready to go live, then
// paste the returned discount node id into that promo's shopifyDiscountId
// in src/data/free-gifts.ts for reference. Mutation name/shape confirmed
// against the live Admin API schema (discountAutomaticBxgyCreate /
// DiscountAutomaticBxgyInput) but not exercised end-to-end — validate with
// validate_graphql_codeblocks before first real use.
export async function createBxgyFreeGiftDiscount(opts: {
  title: string;
  buyProductVariantIds: string[];
  buyQuantity: number;
  giftVariantIds: string[];
  giftQuantity: number;
  startsAt?: string;
  endsAt?: string;
}): Promise<string> {
  const data = await adminGraphql<{
    discountAutomaticBxgyCreate: {
      automaticDiscountNode: { id: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    `mutation CreateBxgyDiscount($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
        automaticDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      automaticBxgyDiscount: {
        title: opts.title,
        startsAt: opts.startsAt ?? new Date().toISOString(),
        endsAt: opts.endsAt,
        customerBuys: {
          value: { quantity: opts.buyQuantity },
          items: { products: { productVariantsToAdd: opts.buyProductVariantIds } },
        },
        customerGets: {
          value: { discountOnQuantity: { quantity: opts.giftQuantity, effect: { percentage: 1.0 } } },
          items: { products: { productVariantsToAdd: opts.giftVariantIds } },
        },
      },
    }
  );
  if (data.discountAutomaticBxgyCreate.userErrors.length) {
    throw new Error(data.discountAutomaticBxgyCreate.userErrors.map((e) => e.message).join(", "));
  }
  const id = data.discountAutomaticBxgyCreate.automaticDiscountNode?.id;
  if (!id) throw new Error("Shopify did not return a discount node id");
  return id;
}

// Same idea but for "spend ≥ ฿N, get a specific product free" — an
// order-wide subtotal threshold rather than specific "buy" items. Same
// not-yet-exercised caveat as createBxgyFreeGiftDiscount above.
export async function createSpendThresholdFreeGiftDiscount(opts: {
  title: string;
  minSubtotal: number;
  giftVariantIds: string[];
  giftQuantity: number;
  startsAt?: string;
  endsAt?: string;
}): Promise<string> {
  const data = await adminGraphql<{
    discountAutomaticBasicCreate: {
      automaticDiscountNode: { id: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    `mutation CreateSpendThresholdDiscount($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
      discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
        automaticDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      automaticBasicDiscount: {
        title: opts.title,
        startsAt: opts.startsAt ?? new Date().toISOString(),
        endsAt: opts.endsAt,
        minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: opts.minSubtotal } },
        customerGets: {
          value: { discountOnQuantity: { quantity: opts.giftQuantity, effect: { percentage: 1.0 } } },
          items: { products: { productVariantsToAdd: opts.giftVariantIds } },
        },
      },
    }
  );
  if (data.discountAutomaticBasicCreate.userErrors.length) {
    throw new Error(data.discountAutomaticBasicCreate.userErrors.map((e) => e.message).join(", "));
  }
  const id = data.discountAutomaticBasicCreate.automaticDiscountNode?.id;
  if (!id) throw new Error("Shopify did not return a discount node id");
  return id;
}

// Issues a real, real-money Shopify gift card (GiftCardCreateInput/
// giftCardCreate — schema-verified against the live Admin API this
// session). `customerId` must be an existing Shopify customer GID (the
// caller resolves/creates one via findShopifyCustomerByEmail /
// createShopifyCustomer first) — Shopify requires the recipient to already
// be a customer record, there's no "arbitrary email" issue path. The plain
// code is only ever returned once, at creation time, so callers must
// persist/display it immediately rather than trying to fetch it back later.
export async function issueGiftCard(opts: {
  customerId: string;
  amount: number;
  note?: string;
  expiresOn?: string; // YYYY-MM-DD
}): Promise<{ id: string; code: string; balance: number; currencyCode: string; lastCharacters: string }> {
  const data = await adminGraphql<{
    giftCardCreate: {
      giftCard: { id: string; balance: { amount: string; currencyCode: string }; lastCharacters: string } | null;
      giftCardCode: string | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    `mutation IssueGiftCard($input: GiftCardCreateInput!) {
      giftCardCreate(input: $input) {
        giftCard { id balance { amount currencyCode } lastCharacters }
        giftCardCode
        userErrors { field message }
      }
    }`,
    {
      input: {
        initialValue: opts.amount,
        customerId: opts.customerId,
        note: opts.note,
        expiresOn: opts.expiresOn,
      },
    }
  );
  if (data.giftCardCreate.userErrors.length) {
    throw new Error(data.giftCardCreate.userErrors.map((e) => e.message).join(", "));
  }
  const giftCard = data.giftCardCreate.giftCard;
  const code = data.giftCardCreate.giftCardCode;
  if (!giftCard || !code) throw new Error("Shopify did not return the created gift card");
  return {
    id: giftCard.id,
    code,
    balance: Number(giftCard.balance.amount),
    currencyCode: giftCard.balance.currencyCode,
    lastCharacters: giftCard.lastCharacters,
  };
}

// Emails the gift card (code + balance) to the customer it's assigned to,
// using Shopify's own gift-card notification template — this is what
// actually delivers it, issueGiftCard alone only creates the record.
export async function sendGiftCardNotification(giftCardId: string): Promise<void> {
  const data = await adminGraphql<{
    giftCardSendNotificationToCustomer: { userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation SendGiftCardNotification($id: ID!) {
      giftCardSendNotificationToCustomer(id: $id) {
        giftCard { id }
        userErrors { field message }
      }
    }`,
    { id: giftCardId }
  );
  if (data.giftCardSendNotificationToCustomer.userErrors.length) {
    throw new Error(data.giftCardSendNotificationToCustomer.userErrors.map((e) => e.message).join(", "));
  }
}

export type ShopifyGiftCardSummary = {
  id: string;
  maskedCode: string;
  lastCharacters: string;
  enabled: boolean;
  createdAt: string;
  expiresOn: string | null;
  note: string | null;
  balance: { amount: string; currencyCode: string };
  initialValue: { amount: string; currencyCode: string };
  customer: { firstName: string | null; lastName: string | null; defaultEmailAddress: { emailAddress: string } | null } | null;
};

// Read-only history for the admin panel — Shopify is the only store of
// truth for issued gift cards (no local table), so this is just a thin
// list view over the live data. `maskedCode` only shows the last 4 chars —
// this is expected, Shopify never returns the full code again after
// creation.
export async function listGiftCards(limit = 20): Promise<ShopifyGiftCardSummary[]> {
  const data = await adminGraphql<{ giftCards: { edges: { node: ShopifyGiftCardSummary }[] } }>(
    `query ListGiftCards($first: Int!) {
      giftCards(first: $first, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            maskedCode
            lastCharacters
            enabled
            createdAt
            expiresOn
            note
            balance { amount currencyCode }
            initialValue { amount currencyCode }
            customer { firstName lastName defaultEmailAddress { emailAddress } }
          }
        }
      }
    }`,
    { first: limit }
  );
  return data.giftCards.edges.map((e) => e.node);
}

// Creates the real Shopify order for one billing cycle of a "Subscribe &
// Save" plan, after 2C2P confirms that cycle's charge actually succeeded
// (lib/2c2p.ts) — this is what makes the shipment visible to fulfillment,
// since the charge itself never touches Shopify's own checkout. Marked
// paid immediately via a synthetic SALE/SUCCESS transaction because the
// money already moved at 2C2P; Shopify is just being told about it after
// the fact, not asked to collect it.
// Creates a real, financialStatus: PAID Shopify order backed by an
// already-succeeded 2C2P charge — shared by both the subscription webhook
// (one or more items per billing cycle) and the one-time custom-checkout
// webhook (an arbitrary cart's line items). `price` per line is that
// item's own real per-unit price, so the SALE transaction below (their
// sum) always reconciles with the line items instead of arbitrarily
// assigning the whole charge to one SKU.
export async function createPaidShopifyOrder(opts: {
  customerId?: string;
  email?: string;
  lineItems: { variantId: string; quantity: number; price: number }[];
  currencyCode: string;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    address1: string;
    city: string;
    provinceCode?: string;
    zip: string;
    countryCode: string;
    phone?: string;
  };
  note: string;
  tranRef: string;
}): Promise<{ id: string; name: string }> {
  const totalAmount = opts.lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0).toFixed(2);
  const data = await adminGraphql<{
    orderCreate: { order: { id: string; name: string } | null; userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation CreateSubscriptionCycleOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        order { id name }
        userErrors { field message }
      }
    }`,
    {
      order: {
        email: opts.email,
        customer: opts.customerId ? { toAssociate: { id: opts.customerId } } : undefined,
        financialStatus: "PAID",
        note: opts.note,
        shippingAddress: {
          firstName: opts.shippingAddress.firstName,
          lastName: opts.shippingAddress.lastName,
          address1: opts.shippingAddress.address1,
          city: opts.shippingAddress.city,
          provinceCode: opts.shippingAddress.provinceCode,
          zip: opts.shippingAddress.zip,
          countryCode: opts.shippingAddress.countryCode,
          phone: opts.shippingAddress.phone,
        },
        lineItems: opts.lineItems.map((li) => ({
          variantId: li.variantId,
          quantity: li.quantity,
          priceSet: { shopMoney: { amount: li.price.toFixed(2), currencyCode: opts.currencyCode } },
        })),
        transactions: [
          {
            kind: "SALE",
            status: "SUCCESS",
            gateway: "2C2P",
            amountSet: { shopMoney: { amount: totalAmount, currencyCode: opts.currencyCode } },
            authorizationCode: opts.tranRef,
          },
        ],
      },
      options: { inventoryBehaviour: "DECREMENT_OBEYING_POLICY", sendReceipt: true, sendFulfillmentReceipt: false },
    }
  );
  if (data.orderCreate.userErrors.length) {
    throw new Error(data.orderCreate.userErrors.map((e) => e.message).join(", "));
  }
  if (!data.orderCreate.order) throw new Error("Shopify did not return the created order");
  return data.orderCreate.order;
}

// Creates a monthly shipment order for month 2+ of an already-paid
// subscription term. Unlike createPaidShopifyOrder above, this
// carries NO transaction and a $0 line item — the customer already paid
// the full term lump sum on month 1's order; recording that same money
// again on every subsequent month's order would multiply the reported
// revenue by the term length in Shopify's own sales reports. The order
// still needs to exist (and be marked paid, since it charges $0) so
// warehouse/fulfillment sees it in the normal order queue.
export async function createFulfillmentOnlyOrder(opts: {
  customerId?: string;
  email?: string;
  lineItems: { variantId: string; quantity: number }[];
  currencyCode: string;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    address1: string;
    city: string;
    provinceCode?: string;
    zip: string;
    countryCode: string;
    phone?: string;
  };
  note: string;
}): Promise<{ id: string; name: string }> {
  const data = await adminGraphql<{
    orderCreate: { order: { id: string; name: string } | null; userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation CreateFulfillmentOnlyOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        order { id name }
        userErrors { field message }
      }
    }`,
    {
      order: {
        email: opts.email,
        customer: opts.customerId ? { toAssociate: { id: opts.customerId } } : undefined,
        financialStatus: "PAID",
        note: opts.note,
        shippingAddress: {
          firstName: opts.shippingAddress.firstName,
          lastName: opts.shippingAddress.lastName,
          address1: opts.shippingAddress.address1,
          city: opts.shippingAddress.city,
          provinceCode: opts.shippingAddress.provinceCode,
          zip: opts.shippingAddress.zip,
          countryCode: opts.shippingAddress.countryCode,
          phone: opts.shippingAddress.phone,
        },
        lineItems: opts.lineItems.map((li) => ({
          variantId: li.variantId,
          quantity: li.quantity,
          priceSet: { shopMoney: { amount: "0.00", currencyCode: opts.currencyCode } },
        })),
      },
      options: { inventoryBehaviour: "DECREMENT_OBEYING_POLICY", sendReceipt: false, sendFulfillmentReceipt: false },
    }
  );
  if (data.orderCreate.userErrors.length) {
    throw new Error(data.orderCreate.userErrors.map((e) => e.message).join(", "));
  }
  if (!data.orderCreate.order) throw new Error("Shopify did not return the created order");
  return data.orderCreate.order;
}
