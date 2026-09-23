// Fetching what a customer actually sent.
//
// A LINE image message carries no image: the event has a messageId, and the
// bytes live behind a separate content API that only the channel's own token
// opens. This is the piece that lets Smoothie answer "ใช้ตัวนี้ยังไง" asked
// with a photo of the box instead of a product name.
//
// Nothing here writes the photo anywhere. It is fetched, handed to the model
// for that one answer, and dropped — the same promise the web panel's consent
// copy makes ("temporary analysis only"), kept by construction rather than by
// a deletion job.

const DATA_API = "https://api-data.line.me/v2/bot";
const TOKEN = process.env.LINE_MESSAGING_ACCESS_TOKEN?.trim();

/**
 * The chat pipeline refuses a base64 payload over ~6 MB, which is about 4.5 MB
 * of image, and a photo straight off a phone camera is routinely larger than
 * that. Rather than fail the question, anything bigger is re-fetched as LINE's
 * own preview — smaller, and still easily enough to read a label, a box or a
 * blemish.
 */
const MAX_FULL_BYTES = 3.5 * 1024 * 1024;

export type LineImage = { base64: string; mediaType: "image/jpeg" | "image/png" };

async function fetchContent(path: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const res = await fetch(`${DATA_API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) {
    console.error(`[line-content] ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  return { bytes: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "" };
}

/** The photo behind a message id, ready for the model — or null if it can't be had. */
export async function fetchLineImage(messageId: string): Promise<LineImage | null> {
  if (!TOKEN || !messageId) return null;
  try {
    let content = await fetchContent(`/message/${messageId}/content`);
    if (!content) return null;

    if (content.bytes.byteLength > MAX_FULL_BYTES) {
      const preview = await fetchContent(`/message/${messageId}/content/preview`);
      // A missing preview is not a reason to give up — the full image may
      // still be inside the pipeline's limit even when it is over ours.
      if (preview) content = preview;
    }
    if (content.bytes.byteLength > 6_000_000) return null;

    const mediaType = content.type.includes("png") ? "image/png" : "image/jpeg";
    return { base64: Buffer.from(content.bytes).toString("base64"), mediaType };
  } catch (err) {
    console.error("[line-content] fetch failed", err);
    return null;
  }
}
