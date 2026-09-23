// Server-only: push a message to one person through the LINE Official
// Account (Messaging API). Dormant until LINE_MESSAGING_ACCESS_TOKEN is set —
// this project has LINE *Login* channels only so far (see line-rich-menu.ts).
//
// The recipient id is the LINE userId stored as a `line` auth identity at
// login. It matches the OA's userId only when the Login channel and the OA's
// Messaging API channel sit under the same LINE provider, and the person
// must have added the OA as a friend; otherwise LINE answers 400 and the
// push is skipped. Every push counts against the OA's monthly message quota.

const TOKEN = process.env.LINE_MESSAGING_ACCESS_TOKEN?.trim();
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
import { SITE_URL as SITE } from "@/lib/site-url";

export function linePushConfigured() {
  return Boolean(TOKEN);
}

/** A link that opens `path` on the site — inside LINE, already signed in, when LIFF is set up. */
export function lineOpenLink(path: string) {
  return LIFF_ID ? `https://liff.line.me/${LIFF_ID}?to=${encodeURIComponent(path)}` : `${SITE}${path}`;
}

/** Sends one text message. Returns false (never throws) when it didn't go. */
export async function pushLineText(lineUserId: string, text: string): Promise<boolean> {
  if (!TOKEN || !lineUserId) return false;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
    });
    if (!res.ok) console.error(`[line-push] ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.ok;
  } catch (err) {
    console.error("[line-push]", err);
    return false;
  }
}

/**
 * Answers a webhook event on its reply token.
 *
 * Preferred over pushLineText for anything the customer just said something to
 * trigger: a reply is free, while every push is charged against the OA's
 * monthly quota. The token is single-use and expires about a minute after the
 * event, so a slow answer has to fall back to a push — see the webhook.
 */
export async function replyLineText(
  replyToken: string,
  text: string,
  quickReplies: string[] = []
): Promise<boolean> {
  if (!TOKEN || !replyToken) return false;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        replyToken,
        messages: [lineTextMessage(text, quickReplies)],
      }),
    });
    if (!res.ok) console.error(`[line-reply] ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.ok;
  } catch (err) {
    console.error("[line-reply]", err);
    return false;
  }
}

/**
 * One text message, with Smoothie's follow-up options as LINE quick replies.
 *
 * The web panel draws those options as chips under the bubble; LINE's own
 * equivalent is a quick reply bar, so the same marker drives both instead of
 * the options being flattened into the message text as a numbered list nobody
 * can tap. LINE caps labels at 20 characters and the bar at 13 items.
 */
function lineTextMessage(text: string, quickReplies: string[]) {
  const body = text.slice(0, 4900);
  if (!quickReplies.length) return { type: "text", text: body };
  return {
    type: "text",
    text: body,
    quickReply: {
      items: quickReplies.slice(0, 13).map((label) => ({
        type: "action",
        // LINE hard-caps a label at 20 characters and rejects the whole
        // message if one is longer, so an over-long option is cut with an
        // ellipsis rather than silently costing the customer the reply. The
        // text it sends is the full option, not the shortened label.
        action: {
          type: "message",
          label: label.length > 20 ? `${label.slice(0, 19)}…` : label,
          text: label.slice(0, 300),
        },
      })),
    },
  };
}

/**
 * Shows LINE's "typing" dots while the model thinks.
 *
 * Worth the extra call: an AI answer takes a few seconds, and without this the
 * chat looks like nothing happened — which is exactly when people send the
 * same question again. Best-effort; the answer must never wait on it.
 */
export async function startLineLoading(lineUserId: string, seconds = 20): Promise<void> {
  if (!TOKEN || !lineUserId) return;
  try {
    await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${TOKEN}` },
      // LINE only accepts multiples of 5, between 5 and 60.
      body: JSON.stringify({ chatId: lineUserId, loadingSeconds: Math.min(60, Math.max(5, Math.round(seconds / 5) * 5)) }),
    });
  } catch {
    // Deliberately silent: a missing typing indicator is not worth a log line.
  }
}
