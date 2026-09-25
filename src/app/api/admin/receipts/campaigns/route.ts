import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { DEFAULT_CONTENT } from "@/lib/receipt-campaign-content";
import { listCampaigns } from "@/lib/receipt-campaign-keys";

// Starting a new receipt campaign.
//
// A campaign is a row: a key, a name, and a schedule. Everything else — the
// customer's page, its API, the review queue, the draw — already reads the key
// out of the URL, so there is nothing to copy and nothing to deploy.
//
// The key is the public link, which makes it the one field that cannot be
// changed later without breaking whatever has already been printed on a
// poster. So it is validated hard, checked for collisions, and shown as the
// URL it will become rather than described.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const DAY = 24 * 60 * 60 * 1000;

type SettingsRow = {
  campaign_key: string;
  opens_at: string | null;
  closes_at: string | null;
  published: boolean | null;
};
type TallyRow = { campaign_key: string; status: string; user_id: string };

/**
 * Every campaign with enough of its state to choose between them.
 *
 * The console used to open straight into one and offer the rest in a dropdown,
 * which is the wrong shape once there is more than one: "which campaign needs
 * me right now" is answered by the queue lengths, and a dropdown shows none of
 * them. So the list carries the counts and the schedule, and opening one is a
 * decision made with them in view.
 */
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const campaigns = await listCampaigns();
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, campaigns });

  const [settings, rows] = await Promise.all([
    supabaseRest<SettingsRow[]>(`receipt_campaign_settings?select=campaign_key,opens_at,closes_at,published`).catch(
      () => [] as SettingsRow[]
    ),
    supabaseRest<TallyRow[]>(`receipt_campaign_entries?select=campaign_key,status,user_id&limit=20000`).catch(
      () => [] as TallyRow[]
    ),
  ]);

  const schedule = new Map(settings.map((r) => [r.campaign_key, r]));
  const tally = new Map<string, { pending: number; approved: number; total: number; entrants: Set<string> }>();
  for (const row of rows) {
    const t =
      tally.get(row.campaign_key) ?? { pending: 0, approved: 0, total: 0, entrants: new Set<string>() };
    t.total += 1;
    if (row.status === "pending_review") t.pending += 1;
    if (row.status === "approved") {
      t.approved += 1;
      t.entrants.add(row.user_id);
    }
    tally.set(row.campaign_key, t);
  }

  return NextResponse.json({
    ok: true,
    campaigns: campaigns.map((c) => {
      const t = tally.get(c.key);
      const s = schedule.get(c.key);
      return {
        ...c,
        // A campaign with no settings row at all is the first one, which has
        // been live since before any of this was configurable.
        published: s?.published !== false,
        opensAt: s?.opens_at ?? null,
        closesAt: s?.closes_at ?? null,
        pending: t?.pending ?? 0,
        approved: t?.approved ?? 0,
        total: t?.total ?? 0,
        entrants: t?.entrants.size ?? 0,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const key = String(body?.key ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim().slice(0, 120);

  if (!KEY_RE.test(key)) {
    return NextResponse.json(
      { ok: false, error: "ลิงก์ใช้ได้เฉพาะ a-z, 0-9 และ - ความยาว 2–64 ตัว และขึ้นต้นด้วยตัวอักษรหรือตัวเลข" },
      { status: 400 }
    );
  }
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "กรุณาตั้งชื่อกิจกรรม" }, { status: 400 });
  }

  const [existing] = await supabaseRest<{ campaign_key: string }[]>(
    `receipt_campaign_settings?campaign_key=eq.${pgValue(key)}&select=campaign_key&limit=1`
  ).catch(() => []);
  if (existing) {
    return NextResponse.json({ ok: false, error: "ลิงก์นี้ถูกใช้ไปแล้ว กรุณาใช้ลิงก์อื่น" }, { status: 409 });
  }

  // A month of collecting, a week to decide, two days to claim. A starting
  // point to edit, not a guess at what the marketing team wants — but a
  // campaign that opens today and closes tomorrow would be a worse one.
  const now = Date.now();
  const opens = new Date(now);
  const closes = new Date(now + 30 * DAY);
  const announce = new Date(now + 37 * DAY);
  const confirm = new Date(now + 39 * DAY);

  await supabaseRest("receipt_campaign_settings", {
    method: "POST",
    returning: false,
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      campaign_key: key,
      eyebrow: name,
      title: DEFAULT_CONTENT.title,
      intro: DEFAULT_CONTENT.intro,
      opens_at: opens.toISOString(),
      closes_at: closes.toISOString(),
      announce_at: announce.toISOString(),
      confirm_deadline: confirm.toISOString(),
      steps: DEFAULT_CONTENT.steps,
      terms: DEFAULT_CONTENT.terms,
      // Dark until somebody says otherwise: the dates and the wording above
      // are placeholders, and a link that works from this second is how a
      // half-written promotion gets found.
      published: false,
      updated_at: new Date().toISOString(),
      updated_by: getAdminSession(token)?.userId ?? null,
    }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "receipt.campaign.create",
      target: key,
      detail: { name, opensAt: opens.toISOString(), closesAt: closes.toISOString() },
    }),
  }).catch((err) => console.error("[admin/receipts/campaigns] audit write failed", err));

  return NextResponse.json({ ok: true, key, name, campaigns: await listCampaigns() });
}

/** Turning a campaign's page on or off. */
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const key = String(body?.key ?? "").trim().toLowerCase();
  const published = body?.published === true;
  if (!KEY_RE.test(key)) return NextResponse.json({ ok: false, error: "ไม่พบกิจกรรมนี้" }, { status: 400 });

  // Upsert rather than patch: the first campaign predates the settings table
  // and may have no row to turn off.
  await supabaseRest(`receipt_campaign_settings?on_conflict=campaign_key`, {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      campaign_key: key,
      published,
      updated_at: new Date().toISOString(),
      updated_by: getAdminSession(token)?.userId ?? null,
    }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({ action: published ? "receipt.campaign.publish" : "receipt.campaign.unpublish", target: key }),
  }).catch((err) => console.error("[admin/receipts/campaigns] audit write failed", err));

  return NextResponse.json({ ok: true, key, published });
}

/**
 * Deleting a campaign.
 *
 * Only one nobody has entered. A campaign with receipts in it is a record of
 * what customers were promised and what they sent — the row is the evidence,
 * and there is no version of "tidy up the console" worth losing it for. Those
 * get unpublished instead, which is what the caller is told.
 */
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const key = String(req.nextUrl.searchParams.get("campaign") ?? "").trim().toLowerCase();
  if (!KEY_RE.test(key)) return NextResponse.json({ ok: false, error: "ไม่พบกิจกรรมนี้" }, { status: 400 });

  const [entry] = await supabaseRest<{ id: string }[]>(
    `receipt_campaign_entries?campaign_key=eq.${pgValue(key)}&select=id&limit=1`
  ).catch(() => []);
  if (entry) {
    return NextResponse.json(
      { ok: false, error: "กิจกรรมนี้มีใบเสร็จของลูกค้าอยู่แล้ว ลบไม่ได้ — ปิดเผยแพร่แทนได้" },
      { status: 409 }
    );
  }

  const [winner] = await supabaseRest<{ id: string }[]>(
    `receipt_campaign_winners?campaign_key=eq.${pgValue(key)}&select=id&limit=1`
  ).catch(() => []);
  if (winner) {
    return NextResponse.json(
      { ok: false, error: "กิจกรรมนี้มีผลรางวัลบันทึกไว้แล้ว ลบไม่ได้ — ปิดเผยแพร่แทนได้" },
      { status: 409 }
    );
  }

  await supabaseRest(`receipt_campaign_settings?campaign_key=eq.${pgValue(key)}`, {
    method: "DELETE",
    returning: false,
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({ action: "receipt.campaign.delete", target: key }),
  }).catch((err) => console.error("[admin/receipts/campaigns] audit write failed", err));

  return NextResponse.json({ ok: true, key });
}
