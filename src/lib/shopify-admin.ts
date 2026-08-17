// Server-only Shopify Admin API access via the client credentials grant.
// Needs a *separate* custom-app credential pair with Admin scopes (unlike
// the Storefront token, which is public-safe) — see SHOPIFY_ADMIN_CLIENT_ID
// / SHOPIFY_ADMIN_CLIENT_SECRET in .env.example. Never import from a "use
// client" component.
const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_ADMIN_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
const API_VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || "2025-10";

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

// Verified-purchase check for the review-points feature: did this customer
// actually pay for this product? Reuses getCustomerOrders with a larger
// limit than the chat assistant needs, since here we're scanning full order
// history rather than just the most recent few. Best-effort like the rest
// of this file — any lookup failure just means "can't verify," not a crash.
export async function hasPaidOrderForProduct(shopifyCustomerId: string, productSlug: string): Promise<boolean> {
  const orders = await getCustomerOrders(shopifyCustomerId, 100);
  if (!orders) return false;
  return orders.some(
    (order) => order.financialStatus === "PAID" && order.items.some((item) => item.slug === productSlug)
  );
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
// "1000 points = ฿100 off".
export async function createAmountDiscountCode(opts: {
  title: string;
  code: string;
  amount: number; // THB, applied once to the whole order
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
