import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { DEFAULT_CONTENT, loadCampaignContent, type CampaignStep, storeUrlOf, accentOf } from "@/lib/receipt-campaign-content";
import { DEFAULT_RULES } from "@/lib/receipt-campaign";
import { products } from "@/data/products";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";

// Reading and writing the campaign's own words.
//
// Dates are the part with teeth: the window here is what decides whether an
// order counts, so a typo in it is not a cosmetic mistake. It is validated on
// the way in and written down in the audit log on the way through.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which campaign this console is looking at; the first one when unstated. */
const campaignOf = (req: NextRequest) => campaignKeyFrom(req.nextUrl.searchParams.get("campaign"));

function guard(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  return null;
}

export async function GET(req: NextRequest) {
  const CAMPAIGN = campaignOf(req);
  const stop = guard(req);
  if (stop) return stop;
  // The catalogue's Dentiste products, so naming the keychain sets is picking
  // from a list rather than typing a slug and hoping.
  const catalogue = products
    .filter((product) => /dentiste/i.test(product.brand))
    .map((product) => ({ slug: product.slug, name: product.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    ok: true,
    content: await loadCampaignContent(CAMPAIGN),
    defaults: { ...DEFAULT_CONTENT, rules: DEFAULT_RULES },
    catalogue,
  });
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A date the form sent as an ISO string, or nothing — never a silent 1970. */
function when(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function PUT(req: NextRequest) {
  const CAMPAIGN = campaignOf(req);
  const stop = guard(req);
  if (stop) return stop;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const opensAt = when(body.opensAt);
  const closesAt = when(body.closesAt);
  if (!opensAt || !closesAt) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุวันเปิดและวันปิดรับใบเสร็จ" }, { status: 400 });
  }
  if (Date.parse(closesAt) <= Date.parse(opensAt)) {
    return NextResponse.json({ ok: false, error: "วันปิดรับต้องอยู่หลังวันเปิดรับ" }, { status: 400 });
  }

  const steps: CampaignStep[] = Array.isArray(body.steps)
    ? body.steps
        .map((s: unknown) => {
          const step = s as { title?: unknown; body?: unknown };
          return { title: text(step?.title, 80), body: text(step?.body, 300) };
        })
        .filter((s: CampaignStep) => s.title)
        .slice(0, 6)
    : [];

  const terms: string[] = Array.isArray(body.terms)
    ? body.terms.map((t: unknown) => text(t, 500)).filter(Boolean).slice(0, 30)
    : [];

  // The arithmetic. Bounded rather than trusted: these numbers decide who wins
  // ฿55,000, and a threshold of zero would hand an entry to every ฿0 order in
  // the shop's history.
  const rules = (body.rules ?? {}) as Record<string, unknown>;
  const money = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : fallback;
  };
  const generalThreshold = money(rules.generalThreshold, DEFAULT_RULES.generalThreshold);
  const keychainPrice = money(rules.keychainPrice, DEFAULT_RULES.keychainPrice);
  const keychainEntriesRaw = Number(rules.keychainEntries);
  const keychainEntries =
    Number.isInteger(keychainEntriesRaw) && keychainEntriesRaw >= 0 && keychainEntriesRaw <= 100
      ? keychainEntriesRaw
      : DEFAULT_RULES.keychainEntries;
  const rounding =
    rules.rounding === "round" || rules.rounding === "ceil" || rules.rounding === "floor"
      ? rules.rounding
      : DEFAULT_RULES.rounding;
  const knownSlugs = new Set(products.map((product) => product.slug));
  const keychainSlugs = Array.isArray(rules.keychainSlugs)
    ? [...new Set(rules.keychainSlugs.filter((v): v is string => typeof v === "string" && knownSlugs.has(v)))].slice(0, 50)
    : [];

  const row = {
    campaign_key: CAMPAIGN,
    general_threshold: generalThreshold,
    keychain_price: keychainPrice,
    keychain_entries: keychainEntries,
    tiered: rules.tiered === true,
    stacks: rules.stacks !== false,
    rounding,
    keychain_slugs: keychainSlugs,
    eyebrow: text(body.eyebrow, 120),
    title: text(body.title, 200),
    intro: text(body.intro, 600),
    opens_at: opensAt,
    closes_at: closesAt,
    announce_at: when(body.announceAt),
    confirm_deadline: when(body.confirmDeadline),
    steps,
    terms,
    // Only ever a page of the live shop; a typo falls back to what the
    // campaign already had rather than sending customers off-site.
    store_url: storeUrlOf(text(body.storeUrl, 300), DEFAULT_CONTENT.storeUrl),
    accent_color: accentOf(text(body.accent, 7), DEFAULT_CONTENT.accent),
    updated_at: new Date().toISOString(),
    updated_by: getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)?.userId ?? null,
  };

  try {
    await supabaseRest(`receipt_campaign_settings?on_conflict=campaign_key`, {
      method: "POST",
      returning: false,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row),
    });
  } catch (err) {
    console.error("[admin/receipts/settings] save failed", err);
    // The table is created by a migration that may not have been run yet, and
    // "it silently did nothing" is the worst way for that to show up.
    return NextResponse.json(
      { ok: false, error: "บันทึกไม่สำเร็จ — ตาราง receipt_campaign_settings อาจยังไม่ถูกสร้าง" },
      { status: 500 }
    );
  }

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "receipt.settings",
      target: CAMPAIGN,
      // The window decides who is eligible, so the change to it is the part
      // worth being able to read back later.
      // The rules in full, every time. Six months from now "why did this
      // receipt earn two" is answerable only if what the rules were that day
      // is written down beside the change that made them so.
      detail: {
        opensAt,
        closesAt,
        announceAt: row.announce_at,
        terms: terms.length,
        steps: steps.length,
        rules: { generalThreshold, keychainPrice, keychainEntries, tiered: row.tiered, stacks: row.stacks, rounding, keychainSlugs },
      },
    }),
  }).catch((err) => console.error("[admin/receipts/settings] audit write failed", err));

  return NextResponse.json({ ok: true, content: await loadCampaignContent(CAMPAIGN) });
}
