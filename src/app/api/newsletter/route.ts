import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { openConversation, appendMessage } from "@/lib/conversations";

// The footer's "tell me about promotions" box.
//
// It used to end at a newsletter_subscribers row, and nothing in the console
// ever read that table — so an address went in and nobody saw it. The list is
// still the durable record, but the signup now also opens a case in the inbox,
// which is the screen staff actually work from.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งานครับ" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกอีเมลให้ถูกต้อง" }, { status: 400 });
  }

  // Re-subscribing with the same email is a no-op, not an error.
  await supabaseRest("newsletter_subscribers?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    returning: false,
    body: JSON.stringify({ email }),
  });

  // Best-effort, and deliberately after the row above: the subscription is
  // already safely recorded, so a failure here costs the follow-up, never the
  // signup itself.
  try {
    await handOverToInbox(email);
  } catch (err) {
    console.error("[newsletter] inbox hand-over failed", err);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Put the lead where staff will see it.
 *
 * Its own thread (`newsletter:<email>`) rather than the person's support
 * chat: openConversation reuses any open conversation on the same channel key
 * and takes over its subject and status, so keying this to a site account
 * would retitle a live support case as a newsletter signup.
 *
 * Re-subscribing finds that same thread and only bumps it, so a second signup
 * cannot stack a second case — and once staff resolve it, a later signup
 * correctly opens a fresh one.
 */
async function handOverToInbox(email: string): Promise<void> {
  // Attached to the site account when the address has one, which is what puts
  // their orders and tier beside the thread. Absent for a stranger, which is
  // most of them — the inbox handles a nameless web conversation already.
  const [identity] = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.email&provider_uid=eq.${pgValue(email)}&select=user_id&limit=1`,
  ).catch((): { user_id: string }[] => []);

  const conversation = await openConversation({
    channel: "web",
    channelUserId: `newsletter:${email}`,
    userId: identity?.user_id ?? null,
    status: "waiting_human",
    subject: `สมัครรับข่าวสาร · ${email}`,
  });
  if (!conversation) return;

  await appendMessage({
    conversationId: conversation.id,
    senderType: "customer",
    content:
      `กรอกอีเมล ${email} ไว้ที่ฟุตเตอร์เว็บ เพื่อรับข่าวโปรโมชั่นและสินค้าใหม่\n` +
      `(ลูกค้ายังไม่ได้ถามอะไร — ทักไปแนะนำตัวหรือส่งโปรโมชั่นล่าสุดให้ได้เลย)`,
  });
}
