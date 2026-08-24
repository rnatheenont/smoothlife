// In-memory sliding-window limiter — no new infra (no Redis/Upstash, no
// Supabase migration) needed to ship this. It isn't a perfectly accurate
// distributed limiter (each warm serverless instance keeps its own map,
// so a determined attacker spread across many cold starts could exceed
// this), but it stops the exact gap the audit found: a script hammering
// one endpoint from one place with zero friction. Good enough as a first
// layer; a shared store (Upstash/Redis) would be the real fix if abuse is
// actually observed in production.
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

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
