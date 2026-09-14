// Server-only: the front photos members choose to keep for before/after
// comparison. Stored only after a separate consent at save time, in a
// private bucket, shown back only to their owner through signed URLs that
// expire in minutes, and removed when the scan is deleted.

const BUCKET = "skin-scan-photos";
const SIGNED_URL_TTL_SECONDS = 600;
export const MAX_PHOTO_BYTES = 1_500_000;

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

/** Uploads one JPEG under the member's folder and returns its path. */
export async function uploadScanPhoto(userId: string, bytes: Uint8Array): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const res = await fetch(`${storageBase()}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "image/jpeg", "x-upsert": "false" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`scan photo upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return path;
}

/** Signed URLs for several paths at once; missing or failed ones come back null. */
export async function signScanPhotos(paths: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (paths.length === 0) return out;
  try {
    const res = await fetch(`${storageBase()}/object/sign/${BUCKET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS, paths }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { path: string; signedURL: string | null }[];
    for (const item of data) out[item.path] = item.signedURL ? `${storageBase()}${item.signedURL}` : null;
  } catch {
    for (const p of paths) out[p] = null;
  }
  return out;
}

export async function removeScanPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await fetch(`${storageBase()}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => {});
}
