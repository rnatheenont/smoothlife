import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured } from "@/lib/supabase-server";
import { subcategoriesOf } from "@/lib/subcategories";
import { confirmAllGuesses, setShelf, shelvesFor } from "@/lib/product-subcategories";

// The review queue behind /admin/products/subcategories.
//
// Reads give staff every in-stock product in a category with the rules'
// guess beside it; writes record what a person decided. Only decisions reach
// the storefront — see confirmedShelves().

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const category = req.nextUrl.searchParams.get("category") ?? "";
  const shelves = subcategoriesOf(category);
  if (shelves.length === 0) {
    return NextResponse.json({ ok: false, error: "ไม่รู้จักหมวดหมู่นี้" }, { status: 400 });
  }

  const items = await shelvesFor(category);
  return NextResponse.json({
    ok: true,
    shelves: shelves.map((s) => ({ slug: s.slug, nameTh: s.nameTh })),
    items,
    summary: {
      total: items.length,
      confirmed: items.filter((i) => i.confirmed).length,
      guessed: items.filter((i) => !i.confirmed && i.guess).length,
      unguessed: items.filter((i) => !i.confirmed && !i.guess).length,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | { action?: string; category?: string; slug?: string; subcategory?: string | null }
    | null;
  if (!body?.category) return NextResponse.json({ ok: false, error: "ไม่ได้ระบุหมวดหมู่" }, { status: 400 });

  const shelves = subcategoriesOf(body.category);
  if (shelves.length === 0) {
    return NextResponse.json({ ok: false, error: "ไม่รู้จักหมวดหมู่นี้" }, { status: 400 });
  }
  // A legacy shared-password session has no "who" to record, which is worth
  // storing as such rather than inventing a name for.
  const by = getAdminSession(token)?.userId ?? "shared-login";

  if (body.action === "confirm-all") {
    const n = await confirmAllGuesses(body.category, by);
    return NextResponse.json({ ok: true, confirmed: n });
  }

  if (!body.slug) return NextResponse.json({ ok: false, error: "ไม่ได้ระบุสินค้า" }, { status: 400 });

  // null is allowed and meaningful — "no shelf" — but a slug that is not one
  // of this category's shelves is a bug on the way in, not a new shelf.
  const subcategory = body.subcategory ?? null;
  if (subcategory !== null && !shelves.some((s) => s.slug === subcategory)) {
    return NextResponse.json(
      { ok: false, error: `"${subcategory}" ไม่ใช่หมวดย่อยของหมวดนี้` },
      { status: 400 }
    );
  }

  await setShelf({ slug: body.slug, category: body.category, subcategory, by });
  return NextResponse.json({ ok: true });
}
