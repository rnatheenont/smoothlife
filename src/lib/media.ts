// The picture library, as both sides see it.

/** The widths the browser produces before uploading. Three, so a phone is
 *  not made to download a banner drawn for a desktop — the section offers
 *  all three and lets the browser choose with srcset. */
export const MEDIA_WIDTHS = [480, 1024, 1600] as const;

export type MediaAsset = {
  id: string;
  folder: string;
  path: string;
  /** width -> url, e.g. { "480": "https://…", "1024": "…" } */
  sources: Record<string, string>;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string;
  alt: string;
  uploaded_by: string | null;
  created_at: string;
};

/**
 * A srcset for an asset's stored widths.
 *
 * This is what three sizes are for. next/image would ignore them — the
 * project sets images.unoptimized because Vercel's optimiser ran out of
 * quota — so the saving only arrives if the markup offers the browser the
 * choice itself.
 */
export function srcSetFor(sources: Record<string, string> | undefined): string | undefined {
  if (!sources) return undefined;
  const parts = Object.entries(sources)
    .map(([width, url]) => [Number(width), url] as const)
    .filter(([width, url]) => Number.isFinite(width) && Boolean(url))
    .sort((a, b) => a[0] - b[0])
    .map(([width, url]) => `${url} ${width}w`);
  return parts.length > 1 ? parts.join(", ") : undefined;
}

/** The largest stored URL — the one to use when there is no srcset. */
export function largestSource(sources: Record<string, string> | undefined, fallback: string): string {
  if (!sources) return fallback;
  const entries = Object.entries(sources)
    .map(([width, url]) => [Number(width), url] as const)
    .filter(([width, url]) => Number.isFinite(width) && Boolean(url))
    .sort((a, b) => b[0] - a[0]);
  return entries[0]?.[1] ?? fallback;
}
