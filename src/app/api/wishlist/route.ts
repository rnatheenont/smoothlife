import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

// Server copy of a logged-in customer's wishlist, so it survives across
// devices — guests keep using localStorage only (see WishlistProvider).
export async function GET(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) return NextResponse.json({ slugs: [] });
  const rows = await supabaseRest<{ product_slug: string }[]>(
    `wishlist_items?user_id=eq.${uid}&select=product_slug`
  );
  return NextResponse.json({ slugs: rows.map((r) => r.product_slug) });
}

export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const slugs: string[] = Array.isArray(body?.slugs)
    ? body.slugs.filter((s: unknown) => typeof s === "string")
    : [];
  if (!slugs.length) return NextResponse.json({ ok: false }, { status: 400 });
  await supabaseRest("wishlist_items?on_conflict=user_id,product_slug", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    returning: false,
    body: JSON.stringify(slugs.map((slug) => ({ user_id: uid, product_slug: slug }))),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) return NextResponse.json({ ok: false }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  await supabaseRest(`wishlist_items?user_id=eq.${uid}&product_slug=eq.${encodeURIComponent(slug)}`, {
    method: "DELETE",
    returning: false,
  });
  return NextResponse.json({ ok: true });
}
