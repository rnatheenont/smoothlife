import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import {
  verifyAdminToken,
  getAdminSession,
  ADMIN_COOKIE,
} from "@/lib/admin-auth";
import {
  getStarterBlocks,
  sanitiseStarter,
  starterBlocks,
} from "@/lib/product-content";

// The skeleton every product with no write-up yet opens with.
//
// Under /api/admin/product-content so the existing product_content.view /
// .manage rules already cover it. `starter` is a static segment beside
// [variantId]; a variant id is a Shopify GID, so nothing real can collide
// with the word.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" },
    { status: 401 },
  );
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))
    return unauthorized();
  const blocks = await getStarterBlocks();
  return NextResponse.json({
    ok: true,
    blocks,
    // So the editor can offer "put it back" without hardcoding the list twice.
    builtIn: starterBlocks(),
  });
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))
    return unauthorized();
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ระบบยังไม่พร้อมใช้งาน" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.blocks)) {
    return NextResponse.json(
      { ok: false, error: "ข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  // Rebuilt from scratch rather than saved as sent — see sanitiseStarter.
  const blocks = sanitiseStarter(body.blocks);
  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);

  await supabaseRest("product_content_starter?on_conflict=id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: true,
      blocks,
      updated_by: session?.userId ?? null,
      updated_at: new Date().toISOString(),
    }),
  });

  // Nothing to revalidate: the starter is only ever read by this console, and
  // only when an admin opens a product that has no content. No page caches it.
  return NextResponse.json({ ok: true, blocks });
}
