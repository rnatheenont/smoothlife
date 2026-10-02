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
}): Promise<{ url: string; path: string }> {
  const ext = ALLOWED_TYPES[opts.contentType];
  if (!ext) throw new Error(`unsupported content type: ${opts.contentType}`);
  const path = `${opts.folder}/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${storageBase()}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": opts.contentType,
      "x-upsert": "false",
      // A year. The name is a uuid, so a given URL can never point at
      // different bytes — and these are served at full size with no image
      // optimiser in front of them (next.config sets images.unoptimized),
      // which makes the browser cache the only thing between a product page
      // and a fresh download of every photograph.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: opts.bytes,
  });
  if (!res.ok) {
    throw new Error(`storage upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  // The path comes back too: a caller that replaces an image needs to know
  // which object to delete later, and a URL is a poor handle for that.
  return { url: `${storageBase()}/storage/v1/object/public/${BUCKET}/${path}`, path };
}

// ---------------------------------------------------------------------------
// Video, which cannot come through here at all.
//
// A route handler on Vercel may receive a request body of about 4.5 MB. A
// thirty-second product clip is many times that, so a video uploaded the way
// the pictures are would fail — and fail at the platform, before any of our
// code could say why in Thai.
//
// So the browser sends the file straight to Supabase Storage instead. This
// asks Storage for a one-shot upload ticket (the service key never leaves the
// server), hands the browser the address and the token, and the bytes go
// nowhere near us. The ticket is good for one upload to one path.

export const VIDEO_BUCKET = "product-videos";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  // What an iPhone produces. The bucket accepts it and Safari plays it; other
  // browsers may not, which the editor says out loud rather than leaving the
  // admin to discover on a customer's Android.
  "video/quicktime": "mov",
};

export function videoExtension(contentType: string): string | null {
  return VIDEO_TYPES[contentType] ?? null;
}

/**
 * A ticket the browser can upload one video with.
 *
 * `url` is where the file will live once the upload finishes — stored now so
 * the editor has a handle on it either way, and an upload that never completes
 * simply leaves a URL that 404s and a row that was never saved.
 */
export async function createVideoUploadTicket(opts: {
  folder: string;
  contentType: string;
}): Promise<{ uploadUrl: string; path: string; url: string }> {
  const ext = videoExtension(opts.contentType);
  if (!ext) throw new Error(`unsupported content type: ${opts.contentType}`);
  const path = `${opts.folder}/${crypto.randomUUID()}.${ext}`;

  const res = await fetch(
    `${storageBase()}/storage/v1/object/upload/sign/${VIDEO_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 600 }),
    },
  );
  if (!res.ok) {
    throw new Error(`signed upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as { url?: string; token?: string };
  // Storage authorises this upload by the token in the query string, not by a
  // header — a PUT that carries it as a bearer token is refused. It is baked
  // into the address here so the browser has one thing to use and one way to
  // use it.
  const token = body.token || new URL(body.url ?? "", storageBase()).searchParams.get("token");
  if (!token) throw new Error("signed upload returned no token");

  return {
    uploadUrl:
      `${storageBase()}/storage/v1/object/upload/sign/${VIDEO_BUCKET}/${path}` +
      `?token=${encodeURIComponent(token)}`,
    path,
    url: `${storageBase()}/storage/v1/object/public/${VIDEO_BUCKET}/${path}`,
  };
}
