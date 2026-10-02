import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import {
  PRODUCT_CONTENT_COLUMNS,
  productContentTag,
  isBlockComplete,
  parseVideoUrl,
  type ContentBlock,
  type ProductContentOverride,
} from "@/lib/product-content";
import { publicStorageHost } from "@/lib/public-uploads";

// One product's content override. `variantId` is a Shopify GID
// (gid://shopify/ProductVariant/...), which contains slashes — the caller
// must encodeURIComponent it to put it in a URL path segment; Next.js hands
// it back decoded in `params`.
export const dynamic = "force-dynamic";

/** Where a picture in a content block may come from: our own storefront,
 *  Shopify's CDN, or the bucket /api/admin/product-content/upload-image writes
 *  to. Same list, same reason as the flash-sale banner (flash-sale-campaigns.ts):
 *  this ends up in an <img> on a live product page, so a pasted link to
 *  somewhere nobody controls is refused out loud rather than saved and left to
 *  break later. */
const IMAGE_HOSTS = [
  "cdn.shopify.com",
  "www.smoothlife.com",
  "smoothlife.com",
  publicStorageHost(),
].filter((h): h is string => Boolean(h));

function parseImageUrl(value: unknown, field: string): string | { error: string } {
  if (typeof value !== "string" || !value.trim()) return "";
  const raw = value.trim().slice(0, 1000);
  if (raw.startsWith("/")) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: `${field}ไม่ถูกต้อง` };
  }
  if (url.protocol !== "https:" || !IMAGE_HOSTS.includes(url.hostname)) {
    return {
      error: `${field}ต้องเป็นลิงก์จาก Shopify, smoothlife.com หรืออัปโหลดเข้าระบบ`,
    };
  }
  return url.toString();
}

function parseBlocks(value: unknown): ContentBlock[] | { error: string } {
  if (!Array.isArray(value)) return { error: "ข้อมูลเนื้อหาไม่ถูกต้อง" };
  if (value.length > 40) return { error: "ใส่ได้ไม่เกิน 40 บล็อกต่อสินค้า" };
  const blocks: ContentBlock[] = [];
  for (const raw of value) {
    const b = (raw ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const strArr = (v: unknown, max: number) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, max)).slice(0, 50) : [];
    const hasVerifiedSource = Boolean(b.hasVerifiedSource);

    switch (b.type) {
      case "paragraph":
      case "image_text": {
        const block = {
          type: b.type,
          headingTh: str(b.headingTh, 200) || undefined,
          headingEn: str(b.headingEn, 200) || undefined,
          bodyTh: str(b.bodyTh, 5000),
          bodyEn: str(b.bodyEn, 5000),
          hasVerifiedSource,
          ...(b.type === "image_text" ? { imageUrl: str(b.imageUrl, 1000) } : {}),
        } as ContentBlock;
        blocks.push(block);
        break;
      }
      case "bullet_list":
      case "ingredients":
      case "who_for":
      case "how_to_use": {
        const block = {
          type: b.type,
          ...(b.type === "bullet_list"
            ? { headingTh: str(b.headingTh, 200) || undefined, headingEn: str(b.headingEn, 200) || undefined }
            : {}),
          itemsTh: strArr(b.itemsTh, 300),
          itemsEn: strArr(b.itemsEn, 300),
          hasVerifiedSource,
        } as ContentBlock;
        blocks.push(block);
        break;
      }
      case "image": {
        const imageUrl = parseImageUrl(b.imageUrl, "ลิงก์รูปภาพ");
        if (typeof imageUrl !== "string") return imageUrl;
        blocks.push({
          type: "image",
          imageUrl,
          captionTh: str(b.captionTh, 300) || undefined,
          captionEn: str(b.captionEn, 300) || undefined,
          hasVerifiedSource,
        } as ContentBlock);
        break;
      }
      case "video": {
        const videoUrl = str(b.videoUrl, 1000);
        // Stored only once it is a link we know how to play — see
        // parseVideoUrl. An unplayable link saved now is an empty frame on the
        // product page later, with nothing in the editor to say why.
        if (videoUrl && !parseVideoUrl(videoUrl)) {
          return {
            error:
              "ลิงก์วิดีโอไม่รองรับ — ใช้ได้กับ YouTube, Facebook, TikTok, Instagram, Vimeo หรือไฟล์ .mp4 จาก Shopify / smoothlife.com",
          };
        }
        const posterUrl = parseImageUrl(b.posterUrl, "ลิงก์รูปปกวิดีโอ");
        if (typeof posterUrl !== "string") return posterUrl;
        blocks.push({
          type: "video",
          videoUrl,
          posterUrl: posterUrl || undefined,
          captionTh: str(b.captionTh, 300) || undefined,
          captionEn: str(b.captionEn, 300) || undefined,
          hasVerifiedSource,
        } as ContentBlock);
        break;
      }
      case "spec_table": {
        const rawRows = Array.isArray(b.rows) ? b.rows : [];
        const rows = rawRows.slice(0, 30).map((r) => {
          const row = (r ?? {}) as Record<string, unknown>;
          return {
            labelTh: str(row.labelTh, 100),
            labelEn: str(row.labelEn, 100),
            valueTh: str(row.valueTh, 300),
            valueEn: str(row.valueEn, 300),
          };
        });
        blocks.push({ type: "spec_table", rows, hasVerifiedSource } as ContentBlock);
        break;
      }
      default:
        return { error: `ประเภทบล็อกไม่ถูกต้อง: ${String(b.type)}` };
    }
  }
  return blocks;
}

export async function GET(_req: NextRequest, props: { params: Promise<{ variantId: string }> }) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { variantId } = await props.params;
  const [row] = await supabaseRest<ProductContentOverride[]>(
    `product_content_overrides?variant_id=eq.${pgValue(variantId)}&select=${PRODUCT_CONTENT_COLUMNS}&limit=1`
  ).catch((): ProductContentOverride[] => []);
  return NextResponse.json({ ok: true, override: row ?? null });
}

export async function PUT(req: NextRequest, props: { params: Promise<{ variantId: string }> }) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { variantId } = await props.params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const parsed = parseBlocks(body.blocks);
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  // Publishing requires every block to actually have both languages filled
  // in — a half-written block going live reads as a broken page, not a draft
  // in progress, which is the one thing `published` exists to prevent.
  const published = Boolean(body.published);
  if (published) {
    const incomplete = parsed.find((b) => !isBlockComplete(b));
    if (incomplete) {
      return NextResponse.json(
        { ok: false, error: "มีบล็อกที่ยังเขียนไม่ครบทั้งไทย-อังกฤษ กรุณาเติมให้ครบก่อนเผยแพร่" },
        { status: 400 }
      );
    }
  }

  const sku = typeof body.sku === "string" ? body.sku.trim().slice(0, 100) || null : null;
  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 200) || null : null;

  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  const row = {
    variant_id: variantId,
    sku,
    slug,
    blocks: parsed,
    published,
    updated_by: session?.userId ?? null,
    updated_at: new Date().toISOString(),
  };

  await supabaseRest("product_content_overrides?on_conflict=variant_id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });

  // Visible on the live product page immediately, not at the top of the next
  // hour's cache window.
  revalidateTag(productContentTag(variantId), { expire: 0 });

  return NextResponse.json({ ok: true });
}
