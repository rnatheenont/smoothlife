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
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.smoothlife.com";

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
