// Resizes an image file/blob in the browser before it ever leaves the device.
// Two sizes are produced:
//  - "upload": bigger, sent once to the analysis API, never stored anywhere.
//  - "thumb": tiny, kept in localStorage so day-to-day progress persists
//    without stuffing full-resolution photos into the browser's storage.

export type ResizedImage = {
  dataUrl: string; // data:image/jpeg;base64,....
  base64: string; // just the base64 payload, no prefix
  mediaType: "image/jpeg";
};

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function drawResized(file: Blob, maxDim: number, quality: number): Promise<ResizedImage> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1] || "";
  return { dataUrl, base64, mediaType: "image/jpeg" };
}

// ~1024px, good enough for the model to see skin detail without a huge payload.
export function resizeForUpload(file: Blob): Promise<ResizedImage> {
  return drawResized(file, 1024, 0.85);
}

// ~160px, small enough that 7 days of thumbnails comfortably fit in localStorage.
export function resizeForThumbnail(file: Blob): Promise<ResizedImage> {
  return drawResized(file, 160, 0.7);
}

// ~320px, stored as the account avatar (a plain text column, so keep it small).
export function resizeForAvatar(file: Blob): Promise<ResizedImage> {
  return drawResized(file, 320, 0.82);
}

// ---------------------------------------------------------------------------
// Product photography, on its way to our own storage.
//
// Different job from the three above: those produce a data URL for an API
// payload or for localStorage, this produces a file to upload and then serve
// to shoppers for years. next.config.mjs sets images.unoptimized, so whatever
// is uploaded is exactly what every visitor downloads — there is no resizing
// step later to save us from a 6 MB phone photo. Shopify's own CDN links are
// requested at ?width=700 and land around 145 KB; 1200px of WebP at 0.8 is
// the same order of magnitude while still being sharp on a retina PDP.
//
// It also keeps the shop from ever hitting Vercel's 4.5 MB request body limit,
// which the upload route's own 5 MB check sits just above and would therefore
// never get to explain.

const PRODUCT_MAX_DIM = 1200;
const PRODUCT_QUALITY = 0.8;

let webpSupport: boolean | null = null;

/** Safari only learned to *write* WebP in 14; reading it is older. */
function supportsWebp(): boolean {
  if (webpSupport === null) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSupport;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      type,
      quality,
    );
  });
}

/**
 * Shrink one chosen photograph to something worth serving.
 *
 * `createImageBitmap` with `imageOrientation: "from-image"` is what applies
 * the EXIF rotation a phone camera writes; without it a portrait photo taken
 * on a phone uploads sideways. Falls back to an <img>, which browsers also
 * orient by default but which cannot be relied on in older Safari.
 *
 * Transparency survives: a PNG becomes WebP (which has an alpha channel) and
 * only degrades to a white-matted JPEG if the browser cannot write WebP at
 * all — otherwise a transparent logo would come back with a black box.
 */
export async function resizeProductImage(file: File): Promise<File> {
  const transparent = file.type === "image/png" || file.type === "image/webp";
  const webp = supportsWebp();
  const type = webp ? "image/webp" : transparent ? "image/png" : "image/jpeg";

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await loadImage(file);
  }

  const scale = Math.min(1, PRODUCT_MAX_DIM / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  if (type === "image/jpeg") {
    // JPEG has no alpha; without this every transparent pixel turns black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source) source.close();

  const blob = await toBlob(canvas, type, PRODUCT_QUALITY);
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return new File([blob], `image.${ext}`, { type });
}
