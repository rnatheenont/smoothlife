import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { editorLink, notifyReview, reviewMessage } from "@/lib/pages/review";
import type { PageKind } from "@/lib/pages/types";

// "This page is ready — someone please look at it."
//
// Its own route rather than another action on the page endpoint, for one
// reason that decides it: every POST to /api/admin/pages requires
// pages.publish, and the whole point of asking for a review is that the
// person asking cannot publish. Nesting it there would have meant only the
// people who can publish could ask to publish.
//
// So this route asks for pages.edit instead (see admin-route-permissions),
// and does exactly one thing: mark the page as waiting and tell the team.

const KINDS: PageKind[] = ["home", "page", "campaign", "brand"];

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { kind?: string; slug?: string; note?: string } | null;
  const kind = KINDS.find((k) => k === body?.kind);
  if (!kind || !body?.slug) {
    return NextResponse.json({ ok: false, error: "ไม่รู้ว่าขออนุมัติหน้าไหน" }, { status: 400 });
  }

  const [page] = await supabaseRest<{ id: string; title: string; kind: string; slug: string }[]>(
    `pages?select=id,title,kind,slug&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(body.slug)}&limit=1`
  );
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });

  const actor = getAdminSession(token)?.userId ?? "shared-login";
  const note = (body.note ?? "").slice(0, 500) || null;

  await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      review_state: "requested",
      review_note: note,
      review_by: actor,
      review_at: new Date().toISOString(),
      // The previous decision is cleared: a page that was sent back and has
      // since been changed is waiting again, and leaving the old "ขอให้แก้"
      // beside it reads as still rejected.
      review_decided_by: null,
      review_decided_at: null,
      review_reply: null,
    }),
  });

  try {
    await supabaseRest("admin_audit_log", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        action: "page.review.request",
        actor,
        target: page.id,
        detail: `ขออนุมัติเผยแพร่${note ? ` · ${note}` : ""}`,
      }),
    });
  } catch (err) {
    console.error("[page-review] could not write the audit entry", err);
  }

  // Reported rather than hidden: if the ping did not go, the person who asked
  // needs to know to go and tap somebody on the shoulder themselves.
  const notified = await notifyReview(
    reviewMessage.requested(page.title, actor, note ?? "", editorLink(page.kind, page.slug))
  );
  return NextResponse.json({ ok: true, notified });
}
