import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import {
  PRODUCT_CONTENT_COLUMNS,
  type ProductContentOverride,
} from "@/lib/product-content";

// Every override that exists, so the list screen can mark each of the 998
// products as written/draft/untouched without a round trip per row.
export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export async function GET() {
  if (!supabaseConfigured())
    return NextResponse.json(
      { ok: false, error: "ระบบยังไม่พร้อมใช้งาน" },
      { status: 503 },
    );
  const rows = await supabaseRest<ProductContentOverride[]>(
    `product_content_overrides?select=${PRODUCT_CONTENT_COLUMNS}&limit=2000`,
  ).catch((): ProductContentOverride[] => []);

  // Names come back as a small map rather than stamped onto every row: a
  // handful of people have written all of these, and repeating a name six
  // hundred times would be most of the response.
  const ids = [
    ...new Set(
      rows.map((r) => r.updated_by).filter((v): v is string => Boolean(v)),
    ),
  ];
  const editors: Record<string, string> = {};
  if (ids.length > 0) {
    const users = await supabaseRest<AdminUser[]>(
      `admin_users?id=in.(${ids.join(",")})&select=id,display_name,email`,
    ).catch((): AdminUser[] => []);
    for (const u of users) {
      // The email is the fallback the users screen itself falls back to, and a
      // row whose author has since been deleted keeps its id rather than
      // silently reading as nobody.
      editors[u.id] = u.display_name?.trim() || u.email || u.id;
    }
  }

  return NextResponse.json({ ok: true, overrides: rows, editors });
}
