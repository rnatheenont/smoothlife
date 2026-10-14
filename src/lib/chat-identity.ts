"use client";

// Who this browser is to the chat, and how much of the conversation it has
// seen.
//
// Small, and deliberately away from use-chat-session: the launcher bubble
// needs these to show an unread badge, and the session hook they used to
// live in pulls in the whole conversation — the streaming reader, the image
// store, the markdown rendering. That is a lot of code for a number on a
// bubble, and until someone opens the chat it is a lot of code for nothing.

const CHAT_SEEN_KEY = "sl_chat_seen_at";
const ANON_ID_KEY = "sl_chat_anon_id";

export function readChatSeen(): string | null {
  try {
    return localStorage.getItem(CHAT_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markChatSeen(latestAt: string | null | undefined) {
  try {
    localStorage.setItem(CHAT_SEEN_KEY, latestAt || new Date().toISOString());
  } catch {}
}

export function countUnread(
  messages: { role: string; created_at?: string }[],
  latestAt: string | null | undefined
): number {
  const seen = readChatSeen();
  if (!seen) {
    // First time this device has checked: the history so far is not news.
    if (latestAt) markChatSeen(latestAt);
    return 0;
  }
  const seenAt = Date.parse(seen);
  return messages.filter((m) => m.role === "assistant" && m.created_at && Date.parse(m.created_at) > seenAt).length;
}

/**
 * A stable per-device id for guests so their chat history and rate-limit
 * tracking can be restored without requiring login — never sent for
 * logged-in users, who are identified by their real session instead.
 */
export function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}
