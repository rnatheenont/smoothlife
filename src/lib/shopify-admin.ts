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

export type ShopifyCustomerMatch = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

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
      customers: { edges: { node: { id: string; firstName: string | null; lastName: string | null; phone: string | null } }[] };
    }>(
      `query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          edges { node { id firstName lastName phone } }
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
      customers: { edges: { node: { id: string; firstName: string | null; lastName: string | null; phone: string | null } }[] };
    }>(
      `query FindCustomerByPhone($query: String!) {
        customers(first: 1, query: $query) {
          edges { node { id firstName lastName phone } }
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
