import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import {
  AGE_RANGES,
  ANGLES,
  CONCERNS,
  SCAN_BONUS_EVERY_DAYS,
  SCAN_BONUS_MIN_ANGLES,
  SCAN_BONUS_POINTS,
  SKIN_TYPES,
  confidenceFor,
} from "@/lib/skin-coach";
import { CONCERN_KEYS, normaliseConcern, skinHealth, type ConcernResults } from "@/lib/skin-analysis";
import { MAX_PHOTO_BYTES, removeScanPhotos, signScanPhotos, uploadScanPhoto } from "@/lib/skin-scan-photos";

// Skin Coach history, written only when the member presses "บันทึกผล" and
// deletable any time. Numbers always; the front photo only when they also
// tick the separate before/after consent at save — stored privately, shown
// back only to them through expiring links, removed with the scan.

export type SkinScanRow = {
  id: string;
  scanned_at: string;
  angles: string[];
  confidence: string;
  skin_age: number;
  age_range: string | null;
  skin_type: string | null;
  main_concern: string | null;
  metrics: { acne: number; pores: number; darkSpots: number; wrinkles: number };
  concerns: ConcernResults | null;
  skin_health: number | null;
  /** Signed, short-lived; null when no photo was kept. Never the storage path. */
  photo_url: string | null;
};

type StoredRow = Omit<SkinScanRow, "photo_url"> & { photo_path: string | null };

const SELECT = "id,scanned_at,angles,confidence,skin_age,age_range,skin_type,main_concern,metrics,concerns,skin_health,photo_path";

async function withPhotoUrls(rows: StoredRow[]): Promise<SkinScanRow[]> {
  const signed = await signScanPhotos(rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p)));
  return rows.map(({ photo_path, ...rest }) => ({ ...rest, photo_url: photo_path ? signed[photo_path] ?? null : null }));
}

const HISTORY_LIMIT = 12;

function uidFrom(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
}

function score(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : NaN;
  return n >= 0 && n <= 100 ? Math.round(n) : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Known keys from a list, comma-joined for the text column; null when none. */
function someOf(value: unknown, allowed: readonly string[], max = 5): string | null {
  if (!Array.isArray(value)) return null;
  const keys = Array.from(new Set(value.filter((v): v is string => typeof v === "string" && allowed.includes(v)))).slice(0, max);
  return keys.length ? keys.join(",") : null;
}

// The account page's full history — enough to scroll back through a year of
// monthly scans. The Skin Coach page itself only needs the recent ones.
const ACCOUNT_HISTORY_LIMIT = 60;

export async function GET(req: NextRequest) {
  const uid = uidFrom(req);
  if (!uid || !supabaseConfigured()) return unauthorized();

  // One scan and the one saved before it, for its own page in the account.
  const id = req.nextUrl.searchParams.get("id");
  if (id !== null) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    const [row] = await supabaseRest<StoredRow[]>(`skin_scans?user_id=eq.${uid}&id=eq.${id}&limit=1&select=${SELECT}`);
    if (!row) return NextResponse.json({ ok: false, error: "ไม่พบผลสแกนนี้" }, { status: 404 });
    const before = await supabaseRest<StoredRow[]>(
      `skin_scans?user_id=eq.${uid}&scanned_at=lt.${encodeURIComponent(row.scanned_at)}&order=scanned_at.desc&limit=1&select=${SELECT}`
    );
    const [scan, previous] = await withPhotoUrls([row, ...before]);
    return NextResponse.json({ ok: true, scan, previous: previous ?? null });
  }

  const limit = req.nextUrl.searchParams.get("all") === "1" ? ACCOUNT_HISTORY_LIMIT : HISTORY_LIMIT;
  const rows = await supabaseRest<StoredRow[]>(
    `skin_scans?user_id=eq.${uid}&order=scanned_at.desc&limit=${limit}&select=${SELECT}`
  );
  return NextResponse.json({ ok: true, scans: await withPhotoUrls(rows) });
}

export async function POST(req: NextRequest) {
  const uid = uidFrom(req);
  if (!uid || !supabaseConfigured()) return unauthorized();
  const body = await req.json().catch(() => ({}));

  const metrics = {
    acne: score(body?.metrics?.acne),
    pores: score(body?.metrics?.pores),
    darkSpots: score(body?.metrics?.darkSpots),
    wrinkles: score(body?.metrics?.wrinkles),
  };
  const skinAge = typeof body?.skinAge === "number" ? Math.round(body.skinAge) : NaN;
  if (Object.values(metrics).some((v) => v === null) || !(skinAge >= 10 && skinAge <= 100)) {
    return NextResponse.json({ ok: false, error: "ผลสแกนไม่ครบ บันทึกไม่ได้" }, { status: 400 });
  }

  const angleKeys = ANGLES.map((a) => a.key) as readonly string[];
  const angles: string[] = Array.isArray(body?.angles)
    ? Array.from(new Set<string>(body.angles.filter((a: unknown) => typeof a === "string" && angleKeys.includes(a))))
    : [];
  if (!angles.includes("front")) angles.unshift("front");

  // The twelve concerns, re-checked here rather than trusted as sent.
  let concerns: ConcernResults | null = null;
  if (body?.concerns12 && typeof body.concerns12 === "object") {
    const parsed = {} as ConcernResults;
    let complete = true;
    for (const key of CONCERN_KEYS) {
      const c = normaliseConcern(key, body.concerns12[key]);
      if (!c) {
        complete = false;
        break;
      }
      parsed[key] = { ...c, note: "" }; // notes stay on the device; the numbers are what's compared
    }
    if (complete) concerns = parsed;
  }

  // The photo: only with its own consent, only a JPEG, only a sensible size.
  let photoBytes: Uint8Array | null = null;
  if (body?.photoConsent === true && typeof body?.photo === "string") {
    const b64 = body.photo.replace(/^data:image\/jpeg;base64,/, "");
    const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
    const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpeg && bytes.length <= MAX_PHOTO_BYTES) photoBytes = bytes;
  }

  // A double tap, or "save" pressed again on the same result, returns the
  // row already saved rather than a second identical one (and no second bonus).
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const [recent] = await supabaseRest<StoredRow[]>(
    `skin_scans?user_id=eq.${uid}&scanned_at=gte.${since}&skin_age=eq.${skinAge}&order=scanned_at.desc&limit=1&select=${SELECT}`
  );
  if (
    recent &&
    recent.metrics.acne === metrics.acne &&
    recent.metrics.pores === metrics.pores &&
    recent.metrics.darkSpots === metrics.darkSpots &&
    recent.metrics.wrinkles === metrics.wrinkles
  ) {
    const [scan] = await withPhotoUrls([recent]);
    return NextResponse.json({ ok: true, scan, bonusPoints: 0, duplicate: true });
  }

  let photoPath: string | null = null;
  if (photoBytes) {
    try {
      photoPath = await uploadScanPhoto(uid, photoBytes);
    } catch (err) {
      // The numbers still save; the comparison photo is the optional part.
      console.error("[skin-coach history] photo upload", err);
    }
  }

  const [stored] = await supabaseRest<StoredRow[]>(`skin_scans?select=${SELECT}`, {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      angles,
      confidence: confidenceFor(angles.length).level,
      skin_age: skinAge,
      age_range: oneOf(body?.ageRange, AGE_RANGES.map((r) => r.key)),
      skin_type: someOf(body?.skinTypes, SKIN_TYPES.map((t) => t.key)),
      main_concern: someOf(body?.concerns, CONCERNS.map((c) => c.key)),
      metrics,
      concerns,
      skin_health: concerns ? skinHealth(concerns) : null,
      photo_path: photoPath,
      photo_consent_at: photoPath ? new Date().toISOString() : null,
    }),
  });
  const [row] = await withPhotoUrls([stored]);
  // The fuller-scan thank-you: three or more angles, once per cycle. The
  // angle list is what the page sent, so the cycle limit is what keeps this
  // from being farmed by saving the same result repeatedly.
  let bonusPoints = 0;
  if (angles.length >= SCAN_BONUS_MIN_ANGLES) {
    const since = new Date(Date.now() - SCAN_BONUS_EVERY_DAYS * 86_400_000).toISOString();
    const recent = await supabaseRest<{ id: string }[]>(
      `points_ledger?user_id=eq.${uid}&reason=eq.skin_scan_bonus&created_at=gte.${since}&select=id&limit=1`
    );
    if (recent.length === 0) {
      await supabaseRest("points_ledger", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          user_id: uid,
          delta: SCAN_BONUS_POINTS,
          reason: "skin_scan_bonus",
          metadata: { scanId: row.id, angles: angles.length },
        }),
      });
      bonusPoints = SCAN_BONUS_POINTS;
    }
  }

  return NextResponse.json({ ok: true, scan: row, bonusPoints });
}

export async function DELETE(req: NextRequest) {
  const uid = uidFrom(req);
  if (!uid || !supabaseConfigured()) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (!all && !(id && /^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
  const photosOnly = req.nextUrl.searchParams.get("photos") === "1";
  // Scoped to the signed-in member either way — an id from someone else's
  // history matches nothing.
  const scope = `skin_scans?user_id=eq.${uid}${all ? "" : `&id=eq.${id}`}`;
  const withPhotos = await supabaseRest<{ photo_path: string | null }[]>(`${scope}&photo_path=not.is.null&select=photo_path`);
  await removeScanPhotos(withPhotos.map((r) => r.photo_path!).filter(Boolean));
  if (photosOnly) {
    // Withdraw the before/after consent: photos go, the numbers stay.
    await supabaseRest(`${scope}&photo_path=not.is.null`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ photo_path: null, photo_consent_at: null }),
    });
  } else {
    await supabaseRest(scope, { method: "DELETE", returning: false });
  }
  return NextResponse.json({ ok: true });
}
