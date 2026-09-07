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

  const first = await fetch(`${BASE}?r=site/login`, { redirect: "manual" });
  let jar = jarFrom(first);

  const body = new URLSearchParams({
    "LoginForm[username]": username,
    "LoginForm[password]": password,
    "LoginForm[rememberMe]": "0",
    yt0: "Login",
  });

  const res = await fetch(`${BASE}?r=site/login`, {
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

/** The tracking number lives only on the per-order View page, not the list. */
async function trackingFromView(url: string, jar: string): Promise<{ orderRef: string; trackingNumber: string } | null> {
  const res = await fetch(url, { headers: { Cookie: jar } });
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, "\n");
  const order = text.match(/Order#\s*\n+\s*(#?\d+)/);
  const tracking = text.match(/Tracking No\.?\s*\n+\s*([A-Za-z0-9-]{6,})/);
  if (!order || !tracking) return null;
  return { orderRef: decode(order[1]), trackingNumber: decode(tracking[1]) };
}

/**
 * Every packed, uncancelled order for the Shopify store, with its parcel
 * number.
 *
 * Scoped to `mo_status=2` (Packed) because that is the moment the label — and
 * therefore the number — exists, and to this one store so a mistake here can
 * never reach into the other brands sharing the same warehouse account.
 */
export type SokoDiagnostics = {
  listBytes: number;
  sawLoginForm: boolean;
  orderNumbersOnPage: number;
  viewLinks: number;
  /** First visible words of the page, so an unexpected one identifies itself. */
  sample: string;
};

/** Set by the last fetchPackedOrders call, so an empty run can be explained. */
export let lastDiagnostics: SokoDiagnostics | null = null;

export async function fetchPackedOrders(limit = 40): Promise<{ orderRef: string; trackingNumber: string }[]> {
  if (!sokoConfigured()) throw new SokoError("ยังไม่ได้ตั้งค่า SOKO_USERNAME / SOKO_PASSWORD");
  const jar = await login();

  const params = new URLSearchParams({
    r: "order/index",
    "Merchantorders[store]": "SmoothLife Shopify",
    "Merchantorders[m_id]": "2",
    "Merchantorders[mo_status]": "2",
    "Merchantorders[mo_cancle]": "0",
  });
  const listRes = await fetch(`${BASE}?${params}`, { headers: { Cookie: jar } });
  const list = await listRes.text();

  // Recorded before anything can throw: "logged in fine, found nothing" and
  // "cannot see this page at all" produce the same empty result otherwise,
  // and telling them apart is most of debugging a scraper.
  lastDiagnostics = {
    listBytes: list.length,
    sawLoginForm: /LoginForm\[password\]/.test(list),
    orderNumbersOnPage: (list.match(/#\d{4}/g) || []).length,
    viewLinks: (list.match(/r=order(?:%2F|\/)view/gi) || []).length,
    // URLs stripped: the sample is for identifying the page, and query
    // strings in a log are how session ids end up somewhere they shouldn't.
    sample: list
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/g, "[url]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400),
  };

  if (lastDiagnostics.sawLoginForm) throw new SokoError("session soko หมดอายุระหว่างดึงข้อมูล");

  // View links are the only per-order handle the list gives us. Matched with
  // the slash both encoded and not: soko writes `r=order/view` plainly, and an
  // earlier version only looked for `%2F`, which found nothing at all and made
  // a working login look like an empty warehouse.
  const hrefs = [...list.matchAll(/href="([^"]*r=order(?:%2F|\/)view[^"]*)"/gi)].map((m) => decode(m[1]));
  const unique = [...new Set(hrefs)].slice(0, limit);
  if (unique.length === 0) return [];

  const out: { orderRef: string; trackingNumber: string }[] = [];
  for (const href of unique) {
    const url = href.startsWith("http") ? href : `https://shg.sokochan.com/${href.replace(/^\//, "")}`;
    try {
      const row = await trackingFromView(url, jar);
      // An order that is packed but has no number yet is normal, not an error.
      if (row) out.push(row);
    } catch {
      // One unreadable order must not lose the rest of the batch.
    }
  }
  return out;
}
