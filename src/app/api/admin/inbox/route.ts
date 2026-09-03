import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Conversation list for the unified inbox. One list for every channel — web
// today, LINE and Facebook once their adapters land — so staff never have to
// remember which of three tools a customer used.

export type InboxListRow = {
  id: string;
  channel: string;
  channel_user_id: string;
  user_id: string | null;
  status: string;
  urgency: string;
  subject: string | null;
  last_message_at: string;
  created_at: string;
};

export type InboxListItem = InboxListRow & {
  customerName: string | null;
  preview: string | null;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, conversations: [] });

  const status = req.nextUrl.searchParams.get("status");
  const statusFilter =
    status && status !== "all" ? `&status=eq.${pgValue(status)}` : "";

  const conversations = await supabaseRest<InboxListRow[]>(
    `conversations?select=*${statusFilter}&order=last_message_at.desc&limit=100`
  );
  if (conversations.length === 0) return NextResponse.json({ ok: true, conversations: [] });

  // Two extra round trips for the whole page rather than one per row — the
  // list is the screen staff keep open all day, so an N+1 here would be felt.
  const userIds = [...new Set(conversations.map((c) => c.user_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (userIds.length) {
    const users = await supabaseRest<{ id: string; first_name: string | null; last_name: string | null }[]>(
      `users?id=in.(${userIds.map((id) => pgValue(id)).join(",")})&select=id,first_name,last_name`
    );
    for (const u of users) {
      names.set(u.id, [u.first_name, u.last_name].filter(Boolean).join(" ") || "");
    }
  }

  const previews = new Map<string, string>();
  const latest = await supabaseRest<{ conversation_id: string; content: string; created_at: string }[]>(
    `conversation_messages?conversation_id=in.(${conversations.map((c) => pgValue(c.id)).join(",")})` +
      `&is_draft=eq.false&select=conversation_id,content,created_at&order=created_at.desc&limit=400`
  );
  for (const m of latest) {
    // Ordered newest-first, so the first one seen per thread is the latest.
    if (!previews.has(m.conversation_id)) previews.set(m.conversation_id, m.content.slice(0, 120));
  }

  return NextResponse.json({
    ok: true,
    conversations: conversations.map<InboxListItem>((c) => ({
      ...c,
      customerName: (c.user_id && names.get(c.user_id)) || null,
      preview: previews.get(c.id) ?? null,
    })),
  });
}
