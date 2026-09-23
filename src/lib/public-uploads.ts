// Images meant to be seen by every visitor — a campaign banner, unlike a
// customer's chat photo (chat-attachments.ts), which is private and
// short-lived by design. Same storage API, opposite promise: this one is
// permanent and public the moment it's uploaded, so nothing here does
// signed URLs or a deletion sweep.

const BUCKET = "blog-images";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function storageBase() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL not set");
  return url.replace(/\/$/, "");
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return key;
}

/** The host a public Supabase Storage URL comes back on — added to the
 *  banner-image allowlist (flash-sale-campaigns.ts) so an upload through this
 *  file is immediately usable there without hardcoding the project's ref. */
export function publicStorageHost(): string | null {
  try {
    return new URL(storageBase()).hostname;
  } catch {
    return null;
  }
}

/** Uploads one image to the public bucket and returns its permanent URL. */
export async function uploadPublicImage(opts: {
  folder: string;
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<string> {
  const ext = ALLOWED_TYPES[opts.contentType];
  if (!ext) throw new Error(`unsupported content type: ${opts.contentType}`);
  const path = `${opts.folder}/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${storageBase()}/storage/v1/object/${BUCKET}/${path}`, {
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
  return `${storageBase()}/storage/v1/object/public/${BUCKET}/${path}`;
}
