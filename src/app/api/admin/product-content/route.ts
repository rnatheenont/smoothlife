import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { PRODUCT_CONTENT_COLUMNS, type ProductContentOverride } from "@/lib/product-content";

// Every override that exists, so the list screen can mark each of the 998
// products as written/draft/untouched without a round trip per row.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const rows = await supabaseRest<ProductContentOverride[]>(
    `product_content_overrides?select=${PRODUCT_CONTENT_COLUMNS}&limit=2000`
  ).catch((): ProductContentOverride[] => []);
  return NextResponse.json({ ok: true, overrides: rows });
}
