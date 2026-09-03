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

// Serverless functions reuse fetch's keep-alive connection pool across
// invocations; Supabase (or an intermediate proxy) periodically closes idle
// pooled connections from its side, so the *next* request to grab that
// connection fails at the socket layer before any bytes come back — real
// production evidence: "fetch failed" / "other side closed" / "socket
// disconnected before secure TLS connection was established", never an
// actual HTTP error response. This silently dropped chat replies, points
// credits, etc. with no trace beyond a server-side console.error. A single
// immediate retry gets a fresh connection and reliably succeeds — safe here
// because these are connection-level failures (zero response bytes read),
// meaning the request never actually reached Supabase the first time.
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    console.error("[supabase] fetch failed, retrying once", err);
    return fetch(url, init);
  }
}

// PostgREST filters are plain query-string parameters, and supabaseRest sends
// them with the service-role key — so a value carrying a bare `&` stops being
// a value and becomes another filter. `?id=eq.${x}&user_id=eq.${uid}` with
// x = "1&or=(id.not.is.null)" reads every row in the table, ownership check and
// all. Wrap anything that came from a request in this before interpolating it;
// values that came from a verified session or a previous database read are
// already trustworthy, but wrapping those too costs nothing.
export function pgValue(value: string): string {
  return encodeURIComponent(value);
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
  // This is a live DB client — Next.js's fetch layer will otherwise cache a
  // GET Route Handler's response (and never refetch) whenever the handler
  // itself doesn't touch any dynamic API (cookies/headers/searchParams),
  // silently serving stale data forever within that server process. Opt out
  // unconditionally so every supabaseRest call is always live.
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase REST ${res.status}: ${text}`);
  }
  if (res.status === 204) return null as T;
  // PostgREST also sends an empty body on 201 when no `return=representation`
  // Prefer header is set (i.e. whenever callers pass `returning: false`) —
  // res.json() throws on that empty string, so parse manually and treat
  // empty as null instead of assuming only 204 responses are bodyless.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
