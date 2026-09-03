import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";

// The inbox's write side. Every channel — web today, LINE and Facebook later —
// funnels through these two functions, so adding a channel is an adapter that
// calls openConversation/appendMessage rather than a second inbox with its own
// storage and its own half of the truth.

export type ConversationChannel = "web" | "line" | "facebook";
export type ConversationStatus = "ai_handling" | "waiting_human" | "assigned" | "resolved";

export type ConversationRow = {
  id: string;
  channel: ConversationChannel;
  channel_user_id: string;
  user_id: string | null;
  status: ConversationStatus;
  assigned_staff_id: string | null;
  urgency: "normal" | "urgent";
  subject: string | null;
  last_message_at: string;
  created_at: string;
};

/**
 * Finds this person's still-open conversation on this channel, or starts one.
 *
 * "Open" deliberately excludes resolved: a customer coming back a week after a
 * closed case is starting a new conversation, not reviving an old one, and
 * stapling the two together would bury the new question under old history.
 */
export async function openConversation(opts: {
  channel: ConversationChannel;
  channelUserId: string;
  userId?: string | null;
  subject?: string;
  urgency?: "normal" | "urgent";
  status?: ConversationStatus;
}): Promise<ConversationRow | null> {
  if (!supabaseConfigured()) return null;

  const [existing] = await supabaseRest<ConversationRow[]>(
    `conversations?channel=eq.${pgValue(opts.channel)}&channel_user_id=eq.${pgValue(opts.channelUserId)}` +
      `&status=neq.resolved&select=*&order=last_message_at.desc&limit=1`
  );
  if (existing) {
    // A known user id arriving later (customer logged in mid-chat) is worth
    // backfilling — it's what turns an anonymous thread into one with order
    // history and a tier beside it.
    const patch: Record<string, unknown> = { last_message_at: new Date().toISOString() };
    if (opts.userId && !existing.user_id) patch.user_id = opts.userId;
    if (opts.status) patch.status = opts.status;
    if (opts.urgency) patch.urgency = opts.urgency;
    const [updated] = await supabaseRest<ConversationRow[]>(`conversations?id=eq.${pgValue(existing.id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return updated ?? existing;
  }

  const [created] = await supabaseRest<ConversationRow[]>("conversations", {
    method: "POST",
    body: JSON.stringify({
      channel: opts.channel,
      channel_user_id: opts.channelUserId,
      user_id: opts.userId ?? null,
      status: opts.status ?? "ai_handling",
      urgency: opts.urgency ?? "normal",
      subject: opts.subject ?? null,
    }),
  });
  return created ?? null;
}

export async function appendMessage(opts: {
  conversationId: string;
  senderType: "customer" | "ai" | "staff";
  content: string;
  senderStaffId?: string | null;
  isDraft?: boolean;
}): Promise<void> {
  if (!supabaseConfigured()) return;
  await supabaseRest("conversation_messages", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      conversation_id: opts.conversationId,
      sender_type: opts.senderType,
      content: opts.content.slice(0, 8000),
      sender_staff_id: opts.senderStaffId ?? null,
      is_draft: opts.isDraft ?? false,
    }),
  });
  // Drafts are staff-side scratch work; letting one bump the thread would
  // reorder the inbox for something the customer never saw.
  if (!opts.isDraft) {
    await supabaseRest(`conversations?id=eq.${pgValue(opts.conversationId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ last_message_at: new Date().toISOString() }),
    });
  }
}
