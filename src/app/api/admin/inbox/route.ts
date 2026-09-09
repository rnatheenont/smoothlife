import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { isTranscriptDump } from "@/lib/inbox-transcript";

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
  staff_read_at: string | null;
};

export type InboxListItem = InboxListRow & {
  customerName: string | null;
  preview: string | null;
  /** Customer messages since staff last opened the thread. */
  unread: number;
  /** Whether Smoothie handed this over, or the customer is just chatting. */
  origin: "escalation" | "chat";
  /** Higher sorts first. See the comment on scoreOf. */
  priority: number;
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
    const users = await supabaseRest<{ id: string; display_name: string | null }[]>(
      `users?id=in.(${userIds.map((id) => pgValue(id)).join(",")})&select=id,display_name`
    );
    for (const u of users) {
      names.set(u.id, u.display_name || "");
    }
  }

  const previews = new Map<string, string>();
  const latest = await supabaseRest<
    { conversation_id: string; content: string; created_at: string; sender_type: string }[]
  >(
    `conversation_messages?conversation_id=in.(${conversations.map((c) => pgValue(c.id)).join(",")})` +
      `&is_draft=eq.false&select=conversation_id,content,created_at,sender_type&order=created_at.desc&limit=400`
  );
  for (const m of latest) {
    // Ordered newest-first, so the first one seen per thread is the latest.
    // Pasted transcripts are skipped: they all open with the same greeting, so
    // every case in the list read identically and none of them said what it
    // was about.
    if (isTranscriptDump(m.content)) continue;
    if (!previews.has(m.conversation_id)) previews.set(m.conversation_id, m.content.slice(0, 120));
  }

  // Unread, per thread: what the customer has said since staff last opened it.
  const unread = new Map<string, number>();
  for (const m of latest) {
    if (m.sender_type !== "customer") continue;
    const conv = conversations.find((c) => c.id === m.conversation_id);
    if (!conv) continue;
    if (conv.staff_read_at && m.created_at <= conv.staff_read_at) continue;
    unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
  }

  const items = conversations.map<InboxListItem>((c) => {
    const n = unread.get(c.id) ?? 0;
    // A conversation Smoothie handed over was, by definition, something she
    // could not answer — that is a different thing from someone chatting to
    // the bot, and the two should not look alike in a list.
    const origin: "escalation" | "chat" = c.subject ? "escalation" : "chat";
    return {
      ...c,
      customerName: (c.user_id && names.get(c.user_id)) || null,
      preview: previews.get(c.id) ?? null,
      unread: n,
      origin,
      priority: scoreOf(c, n, origin),
    };
  });

  // Sorted by what needs a person soonest rather than by what moved last: a
  // thread the bot is happily handling would otherwise sit above a customer
  // who has been waiting since this morning.
  items.sort((a, b) => b.priority - a.priority || b.last_message_at.localeCompare(a.last_message_at));

  const counts = {
    waiting_human: conversations.filter((c) => c.status === "waiting_human").length,
    assigned: conversations.filter((c) => c.status === "assigned").length,
    ai_handling: conversations.filter((c) => c.status === "ai_handling").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
    unread: items.reduce((sum, i) => sum + i.unread, 0),
  };

  return NextResponse.json({ ok: true, conversations: items, counts });
}

/**
 * How loudly a conversation is asking for a person.
 *
 * Waiting longest matters most: a queued case nobody has picked up is the one
 * failure mode this inbox exists to prevent. Everything else is a nudge — an
 * unanswered customer message, a handover rather than idle chat — so that two
 * threads in the same state still order sensibly between themselves.
 */
function scoreOf(c: InboxListRow, unread: number, origin: "escalation" | "chat"): number {
  if (c.status === "resolved") return -1;
  const waitingHours = (Date.now() - new Date(c.last_message_at).getTime()) / 3_600_000;
  return (
    (c.status === "waiting_human" ? 1000 : 0) +
    (c.status === "assigned" ? 500 : 0) +
    (origin === "escalation" ? 100 : 0) +
    (c.urgency === "high" ? 200 : 0) +
    Math.min(unread, 10) * 20 +
    (unread > 0 ? Math.min(waitingHours, 48) : 0)
  );
}
