/* eslint-disable */
// One-off audit: lists every variant whose inventoryPolicy is CONTINUE
// (Shopify will keep selling it past zero stock) instead of DENY (Shopify
// itself refuses to oversell it). Run this once to see whether the "regular
// checkout can't oversell" assumption actually holds for every product —
// findings here are a Shopify Admin settings fix (Products > select
// product > variant > "Continue selling when out of stock"), not code.
//
//   node scripts/check-inventory-policy.js
//
// Needs the same Admin API credentials as scripts/fetch-products.js's
// sibling Admin calls: SHOPIFY_ADMIN_CLIENT_ID / SHOPIFY_ADMIN_CLIENT_SECRET
// (see .env.example), plus NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN. Requires real
// network access to Shopify — cannot run from a sandboxed/offline shell.

const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    // .env.local values are sometimes wrapped in quotes — strip them like
    // dotenv/Next.js would, otherwise e.g. the shop domain ends up as the
    // literal string `"smoothlifethailand.myshopify.com"`, quotes and all.
    const value = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    process.env[m[1]] = value;
  }
}
loadEnvLocal();

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_ADMIN_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
const API_VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || "2025-10";

async function getAccessToken() {
  const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function adminGraphql(token, query, variables) {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

const QUERY = `
  query Variants($first: Int!, $after: String) {
    productVariants(first: $first, after: $after) {
      edges {
        node {
          id
          title
          inventoryPolicy
          inventoryQuantity
          product { title status }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function main() {
  if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) {
    console.error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_CLIENT_ID / SHOPIFY_ADMIN_CLIENT_SECRET");
    process.exit(1);
  }
  const token = await getAccessToken();

  const risky = [];
  let total = 0;
  let after = null;
  for (let page = 1; page <= 200; page++) {
    const data = await adminGraphql(token, QUERY, { first: 100, after });
    const edges = data.productVariants.edges;
    total += edges.length;
    for (const { node: v } of edges) {
      if (v.inventoryPolicy === "CONTINUE") {
        risky.push({
          product: v.product.title,
          status: v.product.status,
          variant: v.title,
          qty: v.inventoryQuantity,
        });
      }
    }
    process.stdout.write(`  page ${page}: ${edges.length} variants (${total} total so far)\n`);
    if (!data.productVariants.pageInfo.hasNextPage) break;
    after = data.productVariants.pageInfo.endCursor;
  }

  console.log(`\nChecked ${total} variants total.`);
  if (risky.length === 0) {
    console.log("✅ None are set to CONTINUE — every variant already denies overselling.");
    return;
  }
  console.log(`⚠️  ${risky.length} variant(s) set to CONTINUE (Shopify will sell these past zero stock):\n`);
  for (const r of risky) {
    console.log(`  - [${r.status}] ${r.product} — ${r.variant} (qty: ${r.qty})`);
  }
  console.log(
    "\nFix in Shopify Admin: Products > (each product above) > variant > uncheck \"Continue selling when out of stock\"."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
