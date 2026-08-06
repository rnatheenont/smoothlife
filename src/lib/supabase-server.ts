// Server-only access to the Supabase Postgres REST API (PostgREST) using the
// service role key. This bypasses RLS, so it must never be imported from
// client components — only from Next.js Route Handlers / server code. RLS on
// these tables intentionally has no anon/authenticated policies (see the
// "fix_points_balance_view_security" migration): all access goes through
// these trusted server routes instead of directly from the browser. Only
// ever import this from Route Handlers (src/app/api/**/route.ts), never
// from a "use client" component.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

export async function supabaseRest<T>(
  path: string,
  init: RequestInit & { returning?: boolean } = {}
): Promise<T> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(init.returning !== false ? { Prefer: "return=representation" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase REST ${res.status}: ${text}`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}
