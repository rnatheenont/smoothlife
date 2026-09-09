// Reads packed orders out of the warehouse system by logging into its web UI.
//
// This exists because sokochan's API module is configured but not served from
// the host we can reach (`api.ApiModule` is an invalid alias there), and no
// API host was discoverable — so until sokochan hands over a base URL, the
// only machine-readable copy of "which parcel number went on which order" is
// the HTML of their order screen.
//
// It is a scraper, and scrapers rot. Two consequences are designed for rather
// than hoped away: every failure is recorded so the sync cannot go quiet
// without anyone noticing, and the credentials are read from the environment
// so the password never appears in this repository.

const BASE = "https://shg.sokochan.com/index.php";

export function sokoConfigured() {
  return Boolean(process.env.SOKO_USERNAME && process.env.SOKO_PASSWORD);
}

export class SokoError extends Error {}

/** Collects Set-Cookie into the single header value fetch will send back. */
function jarFrom(res: Response, existing = ""): string {
  // getSetCookie is the correct API but is not in every runtime; the single
  // combined header is the fallback, and losing the cookie entirely would
  // surface as a clear "no session" error rather than a silent empty run.
  const raw = res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
  const pairs = new Map<string, string>();
  for (const c of existing.split("; ").filter(Boolean)) {
    const i = c.indexOf("=");
    if (i > 0) pairs.set(c.slice(0, i), c.slice(i + 1));
  }
  for (const line of raw) {
    const first = line.split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) pairs.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
  }
  return [...pairs].map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * Signs in and returns the session cookie.
 *
 * A successful login redirects; a failed one returns the form again with an
 * error. Detecting success by "did we get a session and stop being shown the
 * login form" rather than by status code, because the app answers 200 either
 * way.
 */
async function login(): Promise<string> {
  const username = process.env.SOKO_USERNAME as string;
  const password = process.env.SOKO_PASSWORD as string;

  const first = await fetchSoko(`${BASE}?r=site/login`, { redirect: "manual" });
  let jar = jarFrom(first);

  const body = new URLSearchParams({
    "LoginForm[username]": username,
    "LoginForm[password]": password,
    "LoginForm[rememberMe]": "0",
    yt0: "Login",
  });

  const res = await fetchSoko(`${BASE}?r=site/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar },
    body,
  });
  jar = jarFrom(res, jar);

  const html = res.status >= 300 && res.status < 400 ? "" : await res.text();
  if (/LoginForm\[password\]/.test(html)) {
    throw new SokoError("เข้าสู่ระบบ soko ไม่สำเร็จ — ตรวจสอบ SOKO_USERNAME / SOKO_PASSWORD");
  }
  if (!jar) throw new SokoError("เข้าสู่ระบบ soko แล้วแต่ไม่ได้ session cookie");
  return jar;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

const STORE = "SmoothLife Shopify";

// soko shows ten rows a page. Five covers a busy day with room to spare;
// every page is one cheap request, unlike the per-order View reads.
const LIST_PAGES = 5;

// soko answers in its own time and the cron function is killed at 60s. Doing
// five list pages and a dozen order pages one after another blew straight
// through that — the 15:00 run died with a Vercel timeout and wrote nothing,
// which is the silent failure this whole scraper is supposed to avoid. A few
// at a time is enough to fit and stays polite: this runs five times a day.
const CONCURRENCY = 4;

// One soko request that never answers used to take the whole function with it:
// the 60s Vercel allows would run out mid-request, the process was killed, and
// the run produced neither a result nor a log row. A per-request ceiling turns
// that into one skipped page instead of a dead run.
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchSoko(url: string, init: RequestInit = {}): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export type SokoParcel = {
  /** The Shopify order this belongs to, e.g. "#4161". */
  orderRef: string;
  /** soko's own reference, e.g. "#4161_F" for a second box on that order. */
  parcelRef: string;
  trackingNumber: string;
};

/**
 * The tracking number lives only on the per-order View page, not the list.
 *
 * The store is re-checked here even though the list was already filtered by
 * it. Order numbers are per-store and collide across brands — #4203 exists in
 * several — so a row that slipped through would put one brand's parcel number
 * onto another brand's order.
 */
async function trackingFromView(url: string, jar: string): Promise<SokoParcel | null> {
  const res = await fetchSoko(url, { headers: { Cookie: jar } });
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, "\n");
  if (!text.includes(STORE)) return null;
  // The suffix matters and used to be thrown away. When a Shopify order ships
  // in two boxes soko files the second as "#4161_F" — same order, its own
  // parcel and its own number. Capturing only the digits made that look like
  // a second, contradictory number for #4161, which the sync (rightly, on the
  // information it had) refused to write.
  const order = text.match(/Order#\s*\n+\s*(#?\d+[A-Za-z_]*)/);
  const tracking = text.match(/Tracking No\.?\s*\n+\s*([A-Za-z0-9-]{6,})/);
  if (!order || !tracking) return null;
  const parcelRef = decode(order[1]);
  const orderRef = parcelRef.match(/#?\d+/)?.[0] ?? parcelRef;
  return { orderRef, parcelRef, trackingNumber: decode(tracking[1]) };
}

/**
 * Orders for the Shopify store that carry a parcel number.
 *
 * Walks several list pages rather than trusting the first. soko paginates at
 * ten rows and does not order the list newest-first, so reading page one only
 * meant the run saw the same ten orders every time — the sync log shows the
 * identical set on four consecutive runs, all "already-set", while #4207 sat
 * packed with a number and never appeared once. A run that finds nothing new
 * for days looks exactly like a quiet warehouse, which is what made it survive.
 *
 * Scoped to this one store so a mistake here can never reach into the other
 * brands sharing the same warehouse account.
 */
export type SokoDiagnostics = {
  listBytes: number;
  sawLoginForm: boolean;
  orderNumbersOnPage: number;
  viewLinks: number;
  /** How many list pages were walked, and what they yielded in total. */
  pagesScanned: number;
  candidates: number;
  skipped: number;
  /** True when the deadline cut the order reads short. */
  ranOutOfTime?: boolean;
  /** Every list page attempt, so a blind run says what it hit rather than 0. */
  pageAttempts?: { page: number; ms: number; status?: number; bytes?: number; outcome: string; detail?: string }[];
  /** Rows belonging to our store — the number that actually gets processed. */
  storeRows: number;
  /** First visible words of the page, so an unexpected one identifies itself. */
  sample: string;
};

/** One list page as it went: kept even when it failed, which is the point. */
type PageAttempt = {
  page: number;
  ms: number;
  status?: number;
  bytes?: number;
  outcome: "ok" | "timeout" | "error" | "deadline";
  detail?: string;
  html?: string;
};

/** Set by the last fetchPackedOrders call, so an empty run can be explained. */
export let lastDiagnostics: SokoDiagnostics | null = null;

export async function fetchPackedOrders(
  limit = 15,
  skipRefs: Set<string> = new Set(),
  /**
   * Stop opening order pages once this much time has passed.
   *
   * Vercel kills the function at 60s and returns an HTML error page, so a run
   * that overruns produces no result and no log row at all — indistinguishable
   * from a quiet warehouse, which is the exact failure this whole thing is
   * built to make visible. Better to come back with eight orders and say so
   * than with a 504.
   */
  deadlineMs = 40_000
): Promise<SokoParcel[]> {
  const startedAt = Date.now();
  if (!sokoConfigured()) throw new SokoError("ยังไม่ได้ตั้งค่า SOKO_USERNAME / SOKO_PASSWORD");
  const jar = await login();

  // Free-text search rather than the store dropdown or a status filter.
  //
  // The dropdown's values are scoped per user — passing the admin's returned
  // nothing for the API account while an unfiltered query returned ten rows,
  // all of them other brands. Search matches the store column whoever is
  // logged in.
  //
  // Status is deliberately not filtered either. Orders packed this morning
  // were already "Shipped by KND" by the afternoon, so a once-a-day run that
  // only looked at Packed would miss almost everything. Rows without a
  // tracking number are skipped when their View page is read, which costs a
  // request and removes a whole class of timing bug.
  const candidates: { ref: string | null; href: string }[] = [];
  let pagesScanned = 0;
  let firstPage = "";

  const attempts = await mapLimit(
    Array.from({ length: LIST_PAGES }, (_, i) => i + 1),
    async (page): Promise<PageAttempt> => {
      const params = new URLSearchParams({
        r: "order/index",
        "Merchantorders[m_id]": "2",
        "Merchantorders[search_txt]": STORE,
        Merchantorders_page: String(page),
      });
      // Checked here too, not only before the order pages: on a slow day the
      // list alone can eat the budget, and a page fetched at second 59 is a
      // page nobody gets to use.
      if (Date.now() - startedAt > deadlineMs) return { page, ms: 0, outcome: "deadline" };
      const at = Date.now();
      try {
        const listRes = await fetchSoko(`${BASE}?${params}`, { headers: { Cookie: jar } });
        const html = await listRes.text();
        return { page, ms: Date.now() - at, status: listRes.status, bytes: html.length, outcome: "ok", html };
      } catch (err) {
        // A page that times out costs its ten rows, not the run — but what
        // went wrong is kept, because five of these is not a quiet warehouse.
        const aborted = (err as { name?: string })?.name === "AbortError";
        return {
          page,
          ms: Date.now() - at,
          outcome: aborted ? "timeout" : "error",
          detail: aborted ? `เกิน ${REQUEST_TIMEOUT_MS / 1000} วินาที` : String((err as Error)?.message ?? err).slice(0, 120),
        };
      }
    }
  );

  for (const attempt of attempts) {
    const list = attempt.html;
    if (!list) continue;
    pagesScanned++;
    if (!firstPage) firstPage = list;
    if (/LoginForm\[password\]/.test(list)) break;

    // Row by row, so the store can be matched on the same row as the link.
    // Matched with the slash both encoded and not: soko writes `r=order/view`
    // plainly, and an earlier version only looked for `%2F`, which found
    // nothing at all and made a working login look like an empty warehouse.
    let rowsOnPage = 0;
    for (const row of list.split(/<tr[\s>]/i)) {
      if (!row.includes(STORE)) continue;
      rowsOnPage++;
      const href = row.match(/href="([^"]*r=order(?:%2F|\/)view[^"]*)"/i);
      if (!href) continue;
      // Only used to skip work, so a wrong guess costs one extra request
      // rather than a missed parcel — the View page stays the authority.
      const ref = row.match(/#\d{3,}[A-Za-z_]*/);
      candidates.push({ ref: ref ? ref[0] : null, href: decode(href[1]) });
    }
    if (rowsOnPage === 0) break;
  }

  // Recorded before anything can throw: "logged in fine, found nothing" and
  // "cannot see this page at all" produce the same empty result otherwise,
  // and telling them apart is most of debugging a scraper.
  const seen = new Set<string>();
  const fresh = candidates.filter((c) => {
    if (seen.has(c.href)) return false;
    seen.add(c.href);
    return !(c.ref && skipRefs.has(c.ref));
  });

  lastDiagnostics = {
    listBytes: firstPage.length,
    sawLoginForm: /LoginForm\[password\]/.test(firstPage),
    orderNumbersOnPage: (firstPage.match(/#\d{4}/g) || []).length,
    viewLinks: (firstPage.match(/r=order(?:%2F|\/)view/gi) || []).length,
    storeRows: firstPage.split(/<tr[\s>]/i).filter((r) => r.includes(STORE)).length,
    pagesScanned,
    pageAttempts: attempts.map(({ html: _html, ...rest }) => rest),
    candidates: seen.size,
    skipped: seen.size - fresh.length,
    // URLs stripped: the sample is for identifying the page, and query
    // strings in a log are how session ids end up somewhere they shouldn't.
    sample: firstPage
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/g, "[url]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400),
  };

  if (lastDiagnostics.sawLoginForm) throw new SokoError("session soko หมดอายุระหว่างดึงข้อมูล");

  // Zero readable pages is not an empty warehouse — it is a blind run, and it
  // used to be logged as "ไม่มีเลขใหม่" because both come back with nothing.
  // Once that mistake costs a day of parcels it is worth an exception.
  if (pagesScanned === 0) {
    const why = attempts
      .map((a) => `หน้า ${a.page}: ${a.outcome === "ok" ? `ว่าง (${a.status})` : a.outcome}${a.detail ? ` ${a.detail}` : ""}`)
      .join(" · ");
    throw new SokoError(`อ่านหน้ารายการ soko ไม่ได้เลยสักหน้า — ${why}`);
  }

  const unique = fresh.map((c) => c.href).slice(0, limit);
  if (unique.length === 0) return [];

  let ranOutOfTime = false;
  const rows = await mapLimit(unique, async (href) => {
    if (Date.now() - startedAt > deadlineMs) {
      ranOutOfTime = true;
      return null;
    }
    const url = href.startsWith("http") ? href : `https://shg.sokochan.com/${href.replace(/^\//, "")}`;
    try {
      return await trackingFromView(url, jar);
    } catch {
      // One unreadable order must not lose the rest of the batch.
      return null;
    }
  });
  if (lastDiagnostics) lastDiagnostics.ranOutOfTime = ranOutOfTime;
  // An order that is packed but has no number yet is normal, not an error.
  return rows.filter((r): r is SokoParcel => r !== null);
}
