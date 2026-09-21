import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import {
  DESCRIPTION_MAX,
  SEO_COLUMNS,
  SEO_PAGE_TYPES,
  TITLE_MAX,
  seoTag,
  type SeoOverride,
  type SeoPageType,
} from "@/lib/seo-overrides";

// Reads and writes the overrides the /admin/seo screen edits. The permission
// gate in proxy.ts has already decided whether this caller may be here.
export const dynamic = "force-dynamic";

// Derived rather than listed again: a new kind of page added to
// SEO_PAGE_TYPES is immediately saveable, instead of silently failing here.
const TYPES: SeoPageType[] = SEO_PAGE_TYPES.map((t) => t.key);

function isType(v: unknown): v is SeoPageType {
  return typeof v === "string" && TYPES.includes(v as SeoPageType);
}

/** Every override of one kind, so the screen can mark which items are edited. */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const type = req.nextUrl.searchParams.get("page_type");
  const filter = isType(type) ? `page_type=eq.${pgValue(type)}&` : "";
  const rows = await supabaseRest<SeoOverride[]>(`seo_overrides?${filter}select=${SEO_COLUMNS}&limit=2000`).catch(
    (): SeoOverride[] => []
  );
  return NextResponse.json({ ok: true, overrides: rows });
}

/**
 * Save one page's title and description.
 *
 * Blank means "no override" rather than "an empty title": clearing the field
 * has to put the generated default back, otherwise a page could be left with
 * no title at all and no obvious way to undo it.
 */
export async function PUT(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const pageType = body?.page_type;
  const pageKey = typeof body?.page_key === "string" ? body.page_key.trim() : "";
  if (!isType(pageType) || !pageKey) {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const title = typeof body?.meta_title === "string" ? body.meta_title.trim() : "";
  const description = typeof body?.meta_description === "string" ? body.meta_description.trim() : "";
  if (title.length > 200 || description.length > 400) {
    return NextResponse.json({ ok: false, error: "ข้อความยาวเกินไป" }, { status: 400 });
  }

  // The picture a shared link shows. Accepted only as an absolute https URL
  // — the value is handed to LINE and Facebook to fetch, so an http one gets
  // blocked as mixed content and a relative one resolves against their
  // domain, not ours. Both fail silently in the preview, which is the one
  // place nobody thinks to check.
  const rawImage = typeof body?.og_image === "string" ? body.og_image.trim() : "";
  let ogImage: string | null = null;
  if (rawImage) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(rawImage);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.protocol !== "https:") {
      return NextResponse.json(
        { ok: false, error: "ลิงก์รูปต้องเป็น URL แบบเต็มที่ขึ้นต้นด้วย https://" },
        { status: 400 }
      );
    }
    if (rawImage.length > 1000) {
      return NextResponse.json({ ok: false, error: "ลิงก์รูปยาวเกินไป" }, { status: 400 });
    }
    ogImage = rawImage;
  }

  const keywords = Array.isArray(body?.keywords)
    ? [
        ...new Set(
          body.keywords
            .filter((k: unknown): k is string => typeof k === "string")
            .map((k: string) => k.trim())
            .filter(Boolean)
            .map((k: string) => k.slice(0, 80))
        ),
      ].slice(0, 20)
    : [];

  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  const row = {
    page_type: pageType,
    page_key: pageKey,
    meta_title: title || null,
    meta_description: description || null,
    og_image: ogImage,
    keywords,
    updated_by: session?.userId ?? null,
    updated_at: new Date().toISOString(),
  };

  await supabaseRest("seo_overrides?on_conflict=page_type,page_key", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });

  // The storefront caches this lookup for an hour; an edit should be visible
  // now, not at the top of the next one.
  revalidateTag(seoTag(pageType, pageKey), { expire: 0 });

  return NextResponse.json({
    ok: true,
    warning:
      title.length > TITLE_MAX || description.length > DESCRIPTION_MAX
        ? `บันทึกแล้ว แต่ Google มักตัดหัวข้อที่ยาวเกิน ${TITLE_MAX} ตัวอักษร และคำอธิบายที่ยาวเกิน ${DESCRIPTION_MAX}`
        : null,
  });
}
