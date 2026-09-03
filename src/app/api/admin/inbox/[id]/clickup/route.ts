import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { clickUpConfigured, createClickUpTask } from "@/lib/clickup";
import { ConversationRow } from "@/lib/conversations";

// "ส่งต่อเป็นเคส" (plan §7.4): turns a conversation into a tracked ClickUp task
// carrying the full transcript and who the customer is, then remembers the
// link so the inbox can show the case rather than offering to create a second
// one.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!clickUpConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า ClickUp (CLICKUP_API_TOKEN / CLICKUP_LIST_ID)" },
      { status: 503 }
    );
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const [conversation] = await supabaseRest<(ConversationRow & { clickup_task_url: string | null })[]>(
    `conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`
  );
  if (!conversation) return NextResponse.json({ ok: false, error: "ไม่พบบทสนทนานี้" }, { status: 404 });

  // Two staff looking at the same waiting case is the normal way this gets
  // clicked twice; the second click should open the existing task, not file a
  // duplicate complaint.
  if (conversation.clickup_task_url) {
    return NextResponse.json({ ok: true, url: conversation.clickup_task_url, alreadyExisted: true });
  }

  const messages = await supabaseRest<{ sender_type: string; content: string; created_at: string }[]>(
    `conversation_messages?conversation_id=eq.${pgValue(params.id)}&is_draft=eq.false` +
      `&select=sender_type,content,created_at&order=created_at.asc&limit=100`
  );

  let customerLine = `ช่องทาง: ${conversation.channel} · id: ${conversation.channel_user_id}`;
  if (conversation.user_id) {
    const uid = pgValue(conversation.user_id);
    const [user] = await supabaseRest<{ first_name: string | null; last_name: string | null; phone: string | null }[]>(
      `users?id=eq.${uid}&select=first_name,last_name,phone&limit=1`
    ).catch(() => []);
    const [email] = await supabaseRest<{ provider_uid: string }[]>(
      `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid&limit=1`
    ).catch(() => []);
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
    // Whoever picks this task up needs to be able to reach the customer
    // without coming back to ask the inbox for their phone number.
    customerLine =
      `ลูกค้า: ${name || "ไม่ระบุชื่อ"}` +
      (email?.provider_uid ? ` · ${email.provider_uid}` : "") +
      (user?.phone ? ` · ${user.phone}` : "") +
      `\nช่องทาง: ${conversation.channel}`;
  }

  const transcript = messages
    .map((m) => {
      const who = m.sender_type === "customer" ? "ลูกค้า" : m.sender_type === "staff" ? "ทีมงาน" : "น้อง Smoothie";
      return `[${new Date(m.created_at).toLocaleString("th-TH")}] ${who}: ${m.content}`;
    })
    .join("\n");

  const origin = req.nextUrl.origin;
  const description =
    `${customerLine}\n\n` +
    `เปิดในกล่องข้อความ: ${origin}/admin/inbox\n\n` +
    `--- บทสนทนา ---\n${transcript || "(ยังไม่มีข้อความ)"}`;

  try {
    const task = await createClickUpTask({
      name: conversation.subject || `เคสจากแชท (${conversation.channel})`,
      description,
      priority: conversation.urgency === "urgent" ? 1 : 3,
    });

    await supabaseRest(`conversations?id=eq.${pgValue(conversation.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ clickup_task_id: task.id, clickup_task_url: task.url }),
    });

    return NextResponse.json({ ok: true, url: task.url });
  } catch (err) {
    console.error("[admin/inbox/clickup] task creation failed", err);
    return NextResponse.json(
      { ok: false, error: "สร้างเคสใน ClickUp ไม่สำเร็จ กรุณาลองใหม่" },
      { status: 502 }
    );
  }
}
