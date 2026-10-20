import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { parseTopicInput, type TopicInput } from "../route";

// One topic: edit it, or take it out of the list.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // The slug in the path wins: renaming one would orphan every answer filed
  // under it, so it is not something this endpoint does.
  const parsed = parseTopicInput({ ...body, slug: decodeURIComponent(slug) });
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const [topic] = await supabaseRest<TopicInput[]>(`faq_topics?slug=eq.${pgValue(parsed.topic.slug)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(parsed.topic),
  });
  if (!topic) return NextResponse.json({ ok: false, error: "ไม่พบหัวข้อนี้" }, { status: 404 });

  revalidateTag("kb-public", { expire: 0 });
  return NextResponse.json({ ok: true, topic });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const slug = decodeURIComponent((await params).slug);

  // An answer filed under this topic keeps a reference to a row that would no
  // longer exist, so the answers are counted first and the delete is refused
  // while any remain. Turning the topic off is the way to hide it; that keeps
  // the filing intact and is reversible.
  const inUse = await supabaseRest<{ id: string }[]>(
    `kb_articles?or=(topic.eq.${pgValue(slug)},concerns.cs.{${slug}})&select=id&limit=1`
  ).catch((): { id: string }[] => []);

  if (inUse.length > 0) {
    return NextResponse.json(
      { ok: false, error: "ยังมีคำถามที่อยู่ในหัวข้อนี้ — ย้ายคำถามออกก่อน หรือปิดการแสดงผลแทนการลบ" },
      { status: 409 }
    );
  }

  await supabaseRest(`faq_topics?slug=eq.${pgValue(slug)}`, { method: "DELETE", returning: false });

  revalidateTag("kb-public", { expire: 0 });
  return NextResponse.json({ ok: true });
}
