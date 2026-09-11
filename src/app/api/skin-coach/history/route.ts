import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { AGE_RANGES, ANGLES, MAIN_CONCERNS, SKIN_TYPES, confidenceFor } from "@/lib/skin-coach";

// Skin Coach history — numbers only, never photos (the consent page promises
// that), written only when the member presses "บันทึกผล", deletable any time.

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
};

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

export async function GET(req: NextRequest) {
  const uid = uidFrom(req);
  if (!uid || !supabaseConfigured()) return unauthorized();
  const scans = await supabaseRest<SkinScanRow[]>(
    `skin_scans?user_id=eq.${uid}&order=scanned_at.desc&limit=${HISTORY_LIMIT}` +
      `&select=id,scanned_at,angles,confidence,skin_age,age_range,skin_type,main_concern,metrics`
  );
  return NextResponse.json({ ok: true, scans });
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

  const [row] = await supabaseRest<SkinScanRow[]>("skin_scans", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      angles,
      confidence: confidenceFor(angles.length).level,
      skin_age: skinAge,
      age_range: oneOf(body?.ageRange, AGE_RANGES.map((r) => r.key)),
      skin_type: oneOf(body?.skinType, SKIN_TYPES.map((t) => t.key)),
      main_concern: oneOf(body?.mainConcern, MAIN_CONCERNS.map((c) => c.key)),
      metrics,
    }),
  });
  return NextResponse.json({ ok: true, scan: row });
}

export async function DELETE(req: NextRequest) {
  const uid = uidFrom(req);
  if (!uid || !supabaseConfigured()) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (!all && !(id && /^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
  // Scoped to the signed-in member either way — an id from someone else's
  // history matches nothing.
  await supabaseRest(`skin_scans?user_id=eq.${uid}${all ? "" : `&id=eq.${id}`}`, {
    method: "DELETE",
    returning: false,
  });
  return NextResponse.json({ ok: true });
}
