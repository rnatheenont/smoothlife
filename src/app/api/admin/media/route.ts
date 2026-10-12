import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { uploadPublicImage, deletePublicImage } from "@/lib/public-uploads";
import type { MediaAsset } from "@/lib/media";

// The picture library behind the editor's image fields.
//
// The browser does the resizing and sends the finished sizes; this stores
// them and records what they are. That split is not arbitrary — a route
// handler on Vercel receives about 4.5MB of request body, and a photograph
// straight off a phone is often more than that, so a server that resized
// would reject the picture before it could resize it.

export const runtime = "nodejs";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const assets = await supabaseRest<MediaAsset[]>(
    "media_assets?select=*&order=created_at.desc&limit=200"
  );
  return NextResponse.json({ ok: true, assets });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | { alt?: string; width?: number; height?: number; sizes?: { width: number; dataUrl: string }[] }
    | null;

  const sizes = body?.sizes ?? [];
  if (sizes.length === 0) return NextResponse.json({ ok: false, error: "ไม่มีรูปส่งมา" }, { status: 400 });

  try {
    const sources: Record<string, string> = {};
    let largestPath = "";
    let largestUrl = "";
    let largestBytes = 0;

    // Largest first, so the biggest one is what the row's own path points at
    // and a later delete removes the object the row is named after.
    for (const size of [...sizes].sort((a, b) => b.width - a.width)) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(size.dataUrl);
      if (!match) {
        return NextResponse.json({ ok: false, error: "รูปแบบรูปไม่ถูกต้อง" }, { status: 400 });
      }
      const bytes = Buffer.from(match[2], "base64");
      const { url, path } = await uploadPublicImage({
        folder: "pages",
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        contentType: match[1],
      });
      sources[String(size.width)] = url;
      if (!largestPath) {
        largestPath = path;
        largestUrl = url;
        largestBytes = bytes.byteLength;
      }
    }

    const [asset] = await supabaseRest<MediaAsset[]>("media_assets", {
      method: "POST",
      body: JSON.stringify({
        folder: "pages",
        path: largestPath,
        sources,
        url: largestUrl,
        width: body?.width ?? null,
        height: body?.height ?? null,
        bytes: largestBytes,
        mime: "image/jpeg",
        alt: (body?.alt ?? "").slice(0, 200),
        uploaded_by: getAdminSession(token)?.userId ?? "shared-login",
      }),
    });

    return NextResponse.json({ ok: true, asset });
  } catch (err) {
    console.error("[media] upload failed", err);
    return NextResponse.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { id?: string; alt?: string } | null;
  if (!body?.id) return NextResponse.json({ ok: false, error: "ไม่ได้ระบุรูป" }, { status: 400 });

  await supabaseRest(`media_assets?id=eq.${pgValue(body.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ alt: (body.alt ?? "").slice(0, 200) }),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "ไม่ได้ระบุรูป" }, { status: 400 });

  const [asset] = await supabaseRest<MediaAsset[]>(`media_assets?select=*&id=eq.${pgValue(id)}&limit=1`);
  if (!asset) return NextResponse.json({ ok: false, error: "ไม่พบรูปนี้" }, { status: 404 });

  // The row goes first. A file left in storage costs a few kilobytes; a row
  // pointing at a file that is gone puts a broken picture on a live page.
  await supabaseRest(`media_assets?id=eq.${pgValue(id)}`, { method: "DELETE", returning: false });
  for (const url of Object.values(asset.sources ?? {})) {
    const path = url.split("/blog-images/")[1];
    if (path) await deletePublicImage(path).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
