// Talks to the Shopify Storefront API. Store domain + token are configurable
// via env vars only — never hardcode a store here, so switching from the
// sandbox store to the production store is just an env var change.
const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || "2025-10";

export const shopifyConfigured = Boolean(DOMAIN && TOKEN);

async function storefrontFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!DOMAIN || !TOKEN) {
    throw new Error(
      "Shopify Storefront API not configured — set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN"
    );
  }
  const res = await fetch(`https://${DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error("Shopify Storefront API error: " + JSON.stringify(json.errors));
  }
  return json.data as T;
}

export type ShopifyMoney = { amount: string; currencyCode: string };

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: { handle: string; title: string };
    image?: { url: string } | null;
    price: ShopifyMoney;
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: ShopifyMoney; totalAmount: ShopifyMoney };
  discountCodes: { code: string; applicable: boolean }[];
  lines: { edges: { node: ShopifyCartLine }[] };
};

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  discountCodes { code applicable }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            product { handle title }
            image { url }
            price { amount currencyCode }
          }
        }
      }
    }
  }
`;

export type CartDeliveryAddressInput = {
  address1: string;
  address2?: string;
  city?: string;
  provinceCode?: string;
  zip: string;
  countryCode: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export async function cartCreate(
  lines: { merchandiseId: string; quantity: number }[],
  discountCode?: string | null,
  buyerEmail?: string | null,
  deliveryAddress?: CartDeliveryAddressInput | null,
  buyerPhone?: string | null,
  attributes?: { key: string; value: string }[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartCreate: { cart: ShopifyCart; userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }`,
    {
      input: {
        lines,
        discountCodes: discountCode ? [discountCode] : undefined,
        // Shopify's checkout has no dedicated tax-invoice field, so a
        // requested tax invoice rides along as cart attributes — they carry
        // through to the order's note attributes in Shopify Admin for the
        // accounting team to actually issue the invoice from.
        attributes: attributes && attributes.length > 0 ? attributes : undefined,
        // Pre-fills + tags the Shopify checkout with the signed-in member's
        // email/phone so the orders/paid webhook can attribute points back
        // to this account, and so the Contact field at checkout isn't left
        // blank for phone-only accounts (no email on file).
        buyerIdentity:
          buyerEmail || buyerPhone
            ? { email: buyerEmail || undefined, phone: buyerPhone || undefined }
            : undefined,
        // Pre-fills (but doesn't force) the delivery address at Shopify's
        // hosted checkout with the member's saved shipping address, so they
        // don't have to retype it there. `selected: true` makes it the
        // default rather than just an option; `oneTimeUse` keeps it from
        // being saved to the buyer's Shopify-side address book, since it's
        // already saved in our own address book.
        delivery: deliveryAddress
          ? { addresses: [{ address: { deliveryAddress }, selected: true, oneTimeUse: true }] }
          : undefined,
      },
    }
  );
  if (data.cartCreate.userErrors.length) {
    throw new Error(data.cartCreate.userErrors.map((e) => e.message).join(", "));
  }
  return data.cartCreate.cart;
}

export async function cartGet(cartId: string): Promise<ShopifyCart | null> {
  const data = await storefrontFetch<{ cart: ShopifyCart | null }>(
    `query CartGet($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
    { id: cartId }
  );
  return data.cart;
}

export async function cartLinesAdd(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartLinesAdd: { cart: ShopifyCart; userErrors: { message: string }[] };
  }>(
    `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`,
    { cartId, lines }
  );
  if (data.cartLinesAdd.userErrors.length) {
    throw new Error(data.cartLinesAdd.userErrors.map((e) => e.message).join(", "));
  }
  return data.cartLinesAdd.cart;
}

export async function cartLinesUpdate(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartLinesUpdate: { cart: ShopifyCart; userErrors: { message: string }[] };
  }>(
    `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`,
    { cartId, lines }
  );
  if (data.cartLinesUpdate.userErrors.length) {
    throw new Error(data.cartLinesUpdate.userErrors.map((e) => e.message).join(", "));
  }
  return data.cartLinesUpdate.cart;
}

export async function cartLinesRemove(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartLinesRemove: { cart: ShopifyCart; userErrors: { message: string }[] };
  }>(
    `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`,
    { cartId, lineIds }
  );
  if (data.cartLinesRemove.userErrors.length) {
    throw new Error(data.cartLinesRemove.userErrors.map((e) => e.message).join(", "));
  }
  return data.cartLinesRemove.cart;
}

export async function cartDiscountCodesUpdate(cartId: string, codes: string[]): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartDiscountCodesUpdate: { cart: ShopifyCart; userErrors: { message: string }[] };
  }>(
    `mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart { ${CART_FIELDS} }
        userErrors { message }
      }
    }`,
    { cartId, discountCodes: codes }
  );
  if (data.cartDiscountCodesUpdate.userErrors.length) {
    throw new Error(data.cartDiscountCodesUpdate.userErrors.map((e) => e.message).join(", "));
  }
  return data.cartDiscountCodesUpdate.cart;
}
