// Load test for the flash-sale queue: many shoppers hitting fs_join at the
// same instant on one small stock, then the grants and expiries that follow.
//
// It runs against the real database through PostgREST (the same path the app
// takes), because the whole point is the row locking and the CHECK
// constraints, which only exist there. Everything it creates is tagged
// LOADTEST and deleted at the end; the campaign is is_demo and never opens on
// the storefront.
//
// Usage: node scripts/flash-sale-load-test.mjs [shoppers] [stock]
//        CONCURRENCY=100 node scripts/flash-sale-load-test.mjs 3000 200
//
// Measured on 18 Sep 2026 from a laptop (so the numbers are network-bound,
// not database-bound): 3000 shoppers on 200 units — 217 joins/s, p50 371ms,
// p95 1.0s, every position unique, exactly 200 reserved, nobody holding two
// places, and the sweep handing all 200 freed slots to the next in line in
// 358ms.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const URL_BASE = `${env.SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const SHOPPERS = Number(process.argv[2] ?? 300);
const STOCK = Number(process.argv[3] ?? 50);
const TAG = `LOADTEST-${Date.now()}`;
const SLUG = "loadtest-product";
// Requests in flight. Past this the laptop's own socket queue is what is being
// measured, not the database.
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 60);

/** Run tasks with a fixed number in flight, preserving order of results. */
async function pooled(items, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await task(items[i], i);
      }
    })
  );
  return results;
}

// This machine's connection to Supabase drops a request now and then; one
// retry keeps a dropped socket from being reported as a queue failure.
async function fetchRetry(url, init, attempt = 0) {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (attempt >= 2) throw err;
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    return fetchRetry(url, init, attempt + 1);
  }
}

async function rest(path, init = {}) {
  const res = await fetchRetry(`${URL_BASE}/${path}`, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const rpc = (fn, body) => rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(body) });

/**
 * Every row, not the first page. PostgREST caps a response at 1000 rows, and
 * a check that silently looks at a third of the queue is worse than no check:
 * the 3000-shopper run "passed" on positions it had never seen.
 */
async function restAll(path) {
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const batch = await rest(path, { headers: { Range: `${from}-${from + page - 1}` } });
    rows.push(...batch);
    if (batch.length < page) return rows;
  }
}

const pct = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
};

async function timed(fn) {
  const started = performance.now();
  try {
    return { ok: true, value: await fn(), ms: performance.now() - started };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200), ms: performance.now() - started };
  }
}

async function main() {
  console.log(`\n▶ flash-sale load test — ${SHOPPERS} shoppers, ${STOCK} in stock, tag ${TAG}\n`);

  // 1. A campaign that is open right now, and a crowd of shoppers.
  const campaignId = await rpc("fs_create_campaign", {
    p: {
      title: `${TAG} campaign`,
      mode: "single",
      kind: "regular",
      product_slugs: [SLUG],
      stock_per_product: STOCK,
      reservation_window_minutes: 1,
      max_requeue_per_customer: 1,
      starts_at: new Date(Date.now() - 60_000).toISOString(),
      ends_at: new Date(Date.now() + 3600_000).toISOString(),
      products: [{ slug: SLUG, variant_id: null, sale_price: null }],
    },
  });
  await rest(`flash_sale_campaigns?id=eq.${campaignId}`, { method: "PATCH", body: JSON.stringify({ is_demo: true }) });

  const users = await rest("users?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(Array.from({ length: SHOPPERS }, (_, i) => ({ display_name: `${TAG} shopper ${i + 1}` }))),
  });
  console.log(`  campaign ${campaignId} · ${users.length} shoppers created`);

  // 2. Everyone joins at once.
  const joinStart = performance.now();
  const joins = await pooled(users, (u) => timed(() => rpc("fs_join", { p_campaign: campaignId, p_product: SLUG, p_user: u.id })));
  const joinWall = performance.now() - joinStart;

  const okJoins = joins.filter((j) => j.ok);
  const failed = joins.filter((j) => !j.ok);
  const latencies = okJoins.map((j) => j.ms);
  console.log(`\n  JOIN  ${okJoins.length}/${SHOPPERS} ok in ${(joinWall / 1000).toFixed(1)}s` +
    `  ·  ${(okJoins.length / (joinWall / 1000)).toFixed(0)}/s` +
    `  ·  p50 ${pct(latencies, 50).toFixed(0)}ms  p95 ${pct(latencies, 95).toFixed(0)}ms  max ${Math.max(...latencies).toFixed(0)}ms`);
  if (failed.length) console.log(`  ${failed.length} errors, first: ${failed[0].error}`);

  // 3. Second wave: the same people try again. A second *active* place is the
  //    thing that must never happen — re-joining after your own reservation
  //    expired is allowed on purpose (max_requeue_per_customer), and on a long
  //    run the early reservations do expire mid-test.
  const dupes = await pooled(users.slice(0, 50), (u) =>
    timed(() => rpc("fs_join", { p_campaign: campaignId, p_product: SLUG, p_user: u.id }))
  );
  const dupeAccepted = dupes.filter((d) => d.ok && d.value?.ok === true).length;

  // 4. What the database ended up holding.
  const [sale] = await rest(`flash_sales?campaign_id=eq.${campaignId}&select=id,total_stock,reserved_count,sold_count,next_position`);
  const statuses = await restAll(`flash_sale_queue?campaign_id=eq.${campaignId}&select=status`);
  const counts = statuses.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  const positions = await restAll(`flash_sale_queue?campaign_id=eq.${campaignId}&select=position`);
  const uniquePositions = new Set(positions.map((p) => p.position)).size;

  // The promise is one *active* entry per person, whatever else is in history.
  const active = await restAll(
    `flash_sale_queue?campaign_id=eq.${campaignId}&status=in.(waiting,reserved,paid)&select=user_id`
  );
  const activeByUser = active.reduce((acc, r) => ({ ...acc, [r.user_id]: (acc[r.user_id] ?? 0) + 1 }), {});
  const doubleBooked = Object.values(activeByUser).filter((n) => n > 1).length;

  console.log(`\n  STATE reserved=${sale.reserved_count} sold=${sale.sold_count} of ${sale.total_stock}` +
    `  ·  queue ${JSON.stringify(counts)}  ·  positions ${uniquePositions}/${positions.length} unique` +
    `  ·  re-joins accepted after expiry: ${dupeAccepted}  ·  double-booked: ${doubleBooked}`);

  // 5. Expiry hand-off: reservations run out after a minute, and the sweep
  //    must pass every freed slot to the next in line.
  await rest(`flash_sale_queue?campaign_id=eq.${campaignId}&status=eq.reserved`, {
    method: "PATCH",
    body: JSON.stringify({ expires_at: new Date(Date.now() - 1000).toISOString() }),
  });
  const sweep = await timed(() => rpc("fs_sweep", {}));
  const afterSweep = await restAll(`flash_sale_queue?campaign_id=eq.${campaignId}&select=status`);
  const afterCounts = afterSweep.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  const [saleAfter] = await rest(`flash_sales?campaign_id=eq.${campaignId}&select=reserved_count,sold_count`);
  console.log(`  SWEEP ${sweep.ms.toFixed(0)}ms  ·  queue ${JSON.stringify(afterCounts)}  ·  reserved=${saleAfter.reserved_count}`);

  // 6. Reading the page while all of that happens.
  const readers = users.slice(0, Math.min(100, users.length));
  const reads = await Promise.all(
    readers.map((u) => timed(() => rpc("fs_status", { p_campaign: campaignId, p_user: u.id })))
  );
  const readMs = reads.filter((r) => r.ok).map((r) => r.ms);
  console.log(`  STATUS ${readMs.length}/${readers.length} ok  ·  p50 ${pct(readMs, 50).toFixed(0)}ms  p95 ${pct(readMs, 95).toFixed(0)}ms`);

  // 7. Verdict.
  const overSold = sale.reserved_count + sale.sold_count > sale.total_stock;
  const problems = [
    overSold && `OVERSOLD: reserved+sold ${sale.reserved_count + sale.sold_count} > stock ${sale.total_stock}`,
    uniquePositions !== positions.length && `duplicate queue positions (${positions.length - uniquePositions})`,
    doubleBooked > 0 && `${doubleBooked} people hold two active places at once`,
    failed.length > 0 && `${failed.length} join calls errored`,
    statuses.length !== SHOPPERS && `queue holds ${statuses.length} rows for ${SHOPPERS} shoppers`,
  ].filter(Boolean);

  console.log(problems.length === 0 ? "\n✅ PASS — no oversell, no duplicate positions, one place per person\n" : `\n❌ ${problems.join("\n❌ ")}\n`);

  // 8. Clean up: queue first (the campaign is ON DELETE RESTRICT behind it).
  await rest(`flash_sale_queue?campaign_id=eq.${campaignId}`, { method: "DELETE" });
  await rest(`flash_sales?campaign_id=eq.${campaignId}`, { method: "DELETE" });
  await rest(`flash_sale_campaigns?id=eq.${campaignId}`, { method: "DELETE" });
  await rest(`users?display_name=like.${TAG}*`, { method: "DELETE" });

  const leftovers = await rest(`users?display_name=like.${TAG}*&select=id`);
  const campaignLeft = await rest(`flash_sale_campaigns?id=eq.${campaignId}&select=id`);
  console.log(`  cleanup: ${leftovers.length} test users left, ${campaignLeft.length} campaigns left\n`);
}

main().catch((err) => {
  console.error("\n💥", err);
  process.exit(1);
});
