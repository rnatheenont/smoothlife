import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";

// Two limiters live here.
//
// `isRateLimited` is the original in-memory one: a sliding window kept in each
// serverless instance's own map. It is synchronous, needs no round trip, and is
// still the right tool for the cheap-to-serve auth endpoints where the goal is
// to slow a person down.
//
// `isRateLimitedShared` is the durable one, backed by a table. Reach for it
// whenever exceeding the limit costs real money — the in-memory version's true
// allowance is (limit x number of warm instances) and resets on every cold
// start, which a script notices and a human never does.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);

  // Bound memory growth — sweep stale keys once the map gets large rather
  // than on every call.
  if (hits.size > 5000) {
    for (const [k, timestamps] of hits) {
      if (timestamps.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return recent.length > maxAttempts;
}

/**
 * Sliding window shared across every serverless instance.
 *
 * Counts first and records after, so the caller being rejected doesn't add to
 * its own backlog. Two round trips, which is nothing next to the LLM call this
 * guards.
 *
 * Fails **open** on a database error: a Supabase blip should slow nobody's
 * shopping down, and the in-memory limiter is still in front of the endpoints
 * that matter most.
 */
export async function isRateLimitedShared(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  const since = new Date(Date.now() - windowMs).toISOString();

  try {
    // `limit` caps the read at one more row than the allowance — the exact
    // count past that point is irrelevant and would only grow the response.
    const recent = await supabaseRest<{ id: number }[]>(
      `rate_limit_hits?key=eq.${pgValue(key)}&hit_at=gte.${pgValue(since)}&select=id&limit=${maxAttempts + 1}`
    );
    if (recent.length >= maxAttempts) return true;

    await supabaseRest("rate_limit_hits", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ key }),
    });
    return false;
  } catch {
    return false;
  }
}

/** Housekeeping for the shared limiter's table — call from the daily cron. */
export async function purgeExpiredRateLimitHits(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  if (!supabaseConfigured()) return;
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  try {
    await supabaseRest(`rate_limit_hits?hit_at=lt.${pgValue(cutoff)}`, {
      method: "DELETE",
      returning: false,
    });
  } catch {
    /* housekeeping only — never worth failing the cron over */
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
