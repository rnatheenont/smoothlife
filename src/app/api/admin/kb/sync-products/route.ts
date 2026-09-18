import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { lastProductSyncAt, syncProductArticles } from "@/lib/kb-products";

// Admin: pull the catalogue into the knowledge base by hand. The daily cron
// does the same thing (api/cron/kb-sync-products) — this is for right after
// someone edits a product and wants the assistant to know now.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  return NextResponse.json({ ok: true, lastSyncAt: await lastProductSyncAt() });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { offset?: number } | null;
  const offset = Number.isInteger(body?.offset) && (body?.offset ?? 0) >= 0 ? (body!.offset as number) : 0;
  try {
    const result = await syncProductArticles(offset);
    return NextResponse.json({ ok: true, ...result, lastSyncAt: await lastProductSyncAt() });
  } catch (err) {
    console.error("[kb] product sync failed", err);
    return NextResponse.json({ ok: false, error: "ซิงก์ข้อมูลสินค้าไม่สำเร็จ" }, { status: 500 });
  }
}
