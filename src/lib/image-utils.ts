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
