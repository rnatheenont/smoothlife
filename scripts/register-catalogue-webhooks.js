/* eslint-disable */
// One-off setup: registers the Shopify webhook subscriptions that
// src/app/api/webhooks/shopify/route.ts already knows how to handle for
// products/create, products/update, products/delete, and
// inventory_levels/update — none of these were actually registered on
// the store as of 2026-09-02 (confirmed via a live webhookSubscriptions
// query), so the near-instant catalogue-rebuild path that code has
// existed for was dead: only the daily 03:00 cron was ever refreshing
// the catalogue. Run once; safe to re-run (Shopify returns a userError
// for a topic/URL pair that's already subscribed, which this reports as
// "already registered" rather than failing).
//
//   node scripts/register-catalogue-webhooks.js
//
// Must run with the SAME app's Admin API credentials that
// SHOPIFY_WEBHOOK_SECRET (checked by verifyHmac() in the webhook route)
// belongs to — otherwise Shopify signs webhook payloads with a different
// app's Client Secret and every delivery 401s. Needs
// SHOPIFY_ADMIN_CLIENT_ID / SHOPIFY_ADMIN_CLIENT_SECRET (see
// .env.example) plus NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN — same pattern as
// scripts/check-inventory-policy.js. Reads .env.local if present, else
// .env.production.local (e.g. after `vercel env pull .env.production.local`).
// Requires real network access to Shopify — cannot run from a
// sandboxed/offline shell.

const fs = require("fs");
const path = require("path");

function loadEnvFile(filename) {
  const envPath = path.join(__dirname, "..", filename);
  if (!fs.existsSync(envPath)) return false;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    const value = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    process.env[m[1]] = value;
  }
  return true;
}
loadEnvFile(".env.local") || loadEnvFile(".env.production.local");

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_ADMIN_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
const API_VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || "2025-10";
// Must match the live deployed domain — this is where Shopify will POST
// webhook deliveries, verified by verifyHmac() in the app itself.
const CALLBACK_URL = "https://smoothlife.vercel.app/api/webhooks/shopify";

const TOPICS = ["PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE", "INVENTORY_LEVELS_UPDATE"];

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

const LIST_QUERY = `
  query { webhookSubscriptions(first: 50) { edges { node { id topic callbackUrl } } } }
`;

const CREATE_MUTATION = `
  mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $uri: String!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: { uri: $uri, format: JSON }) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

async function main() {
  if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) {
    console.error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_CLIENT_ID / SHOPIFY_ADMIN_CLIENT_SECRET");
    console.error("Run `vercel env pull .env.production.local` first, or set these in .env.local temporarily.");
    process.exit(1);
  }
  const token = await getAccessToken();

  const existing = await adminGraphql(token, LIST_QUERY);
  const existingTopics = new Set(existing.webhookSubscriptions.edges.map((e) => e.node.topic));
  console.log(`Existing webhook subscriptions for this app: ${existingTopics.size ? [...existingTopics].join(", ") : "(none)"}\n`);

  for (const topic of TOPICS) {
    if (existingTopics.has(topic)) {
      console.log(`- ${topic}: already registered, skipping`);
      continue;
    }
    const result = await adminGraphql(token, CREATE_MUTATION, { topic, uri: CALLBACK_URL });
    const { webhookSubscription, userErrors } = result.webhookSubscriptionCreate;
    if (userErrors.length > 0) {
      console.log(`- ${topic}: FAILED — ${userErrors.map((e) => e.message).join("; ")}`);
    } else {
      console.log(`- ${topic}: registered (id ${webhookSubscription.id})`);
    }
  }

  console.log(
    `\nDone. All subscriptions POST to ${CALLBACK_URL}. Next: trigger a real product/inventory edit in Shopify and check Vercel logs for a 200 (not 401) from /api/webhooks/shopify — a 401 means SHOPIFY_WEBHOOK_SECRET doesn't match this app's Client Secret.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
