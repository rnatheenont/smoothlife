import { supabaseRest, pgValue } from "@/lib/supabase-server";

// Photos sent to a member of staff.
//
// This is the exception to the rule stated in chat-image-store.ts, not a
// reversal of it. While the AI is answering, a photo goes to the model and is
// never stored anywhere but the customer's own device. This path exists only
// once a person has taken the conversation and asked for a photo they would
// otherwise be unable to see — and the customer is asked again, separately,
// before the first one is uploaded.
//
// Everything the second consent promises has to be kept by something here:
// a private bucket, short-lived signed URLs, deletion when the case closes,
// and a sweep for cases nobody closed.

const BUCKET = "chat-attachments";
const SIGNED_URL_TTL_SECONDS = 300;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_RETENTION_DAYS = 30;

function storageBase() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL not set");
  return `${url.replace(/\/$/, "")}/storage/v1`;
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return key;
}

/** Uploads one photo and returns its path. Never returns a public URL — there isn't one. */
export async function uploadAttachment(opts: {
  conversationId: string;
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<string> {
  // Foldered by conversation so closing a case can delete its photos without
  // needing to have tracked each one.
  const path = `${opts.conversationId}/${crypto.randomUUID()}.jpg`;
  const res = await fetch(`${storageBase()}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": opts.contentType,
      "x-upsert": "false",
    },
    body: opts.bytes,
  });
  if (!res.ok) {
    throw new Error(`storage upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return path;
}

/**
 * A URL that works for a few minutes and then doesn't.
 *
 * The bucket is private, so this is the only way to see a photo — which means
 * a link copied out of the admin screen stops working rather than becoming a
 * permanent public address for someone's damaged-product photo.
 */
export async function signedAttachmentUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${storageBase()}/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string };
    if (!data.signedURL) return null;
    return `${storageBase()}${data.signedURL}`;
  } catch {
    return null;
  }
}

async function removePaths(paths: string[]): Promise<number> {
  if (paths.length === 0) return 0;
  const res = await fetch(`${storageBase()}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  return res.ok ? paths.length : 0;
}

/** Called when a case is closed — the moment the consent text says photos go. */
export async function deleteAttachmentsForConversation(conversationId: string): Promise<number> {
  const rows = await supabaseRest<{ id: string; attachment_path: string }[]>(
    `conversation_messages?conversation_id=eq.${pgValue(conversationId)}` +
      `&attachment_path=not.is.null&select=id,attachment_path`
  ).catch(() => []);
  if (rows.length === 0) return 0;

  const removed = await removePaths(rows.map((r) => r.attachment_path));

  // The row stays — the thread should still show that a photo was sent, and
  // when it stopped being available. Only the file goes.
  await Promise.all(
    rows.map((r) =>
      supabaseRest(`conversation_messages?id=eq.${pgValue(r.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ attachment_path: null }),
      }).catch(() => {})
    )
  );
  return removed;
}

/**
 * The backstop for cases nobody closes.
 *
 * Without this, "deleted within 30 days at the latest" would be true only of
 * conversations someone remembered to tidy up, which is not what the customer
 * was told.
 */
export async function purgeExpiredAttachments(): Promise<number> {
  const cutoff = new Date(Date.now() - ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseRest<{ id: string; attachment_path: string }[]>(
    `conversation_messages?attachment_path=not.is.null&created_at=lt.${pgValue(cutoff)}` +
      `&select=id,attachment_path&limit=500`
  ).catch(() => []);
  if (rows.length === 0) return 0;

  const removed = await removePaths(rows.map((r) => r.attachment_path));
  await Promise.all(
    rows.map((r) =>
      supabaseRest(`conversation_messages?id=eq.${pgValue(r.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ attachment_path: null }),
      }).catch(() => {})
    )
  );
  return removed;
}
