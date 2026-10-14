import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// Finding a library picture's other sizes from the one URL a section stores.
//
// A section stores a single URL, because that is what an image field is and
// what a picture pasted from somewhere else looks like too. The other widths
// are looked up here, by that URL, so a section whose picture did not come
// from the library still works — it simply has nothing extra to offer the
// browser.

export async function mediaSourcesFor(url: string): Promise<Record<string, string> | null> {
  return (await mediaAssetFor(url))?.sources ?? null;
}

/**
 * The other widths, and the shape of the picture.
 *
 * The shape is what lets a section reserve the right amount of room before
 * the file arrives: an <img> with width and height attributes has an aspect
 * ratio the browser can use, and the rest of the page stops jumping down
 * when the picture lands.
 */
export async function mediaAssetFor(
  url: string
): Promise<{ sources: Record<string, string> | null; width: number | null; height: number | null } | null> {
  if (!supabaseConfigured() || !url) return null;
  try {
    const [row] = await supabaseRest<{ sources: Record<string, string>; width: number | null; height: number | null }[]>(
      `media_assets?select=sources,width,height&url=eq.${encodeURIComponent(url)}&limit=1`
    );
    return row ? { sources: row.sources ?? null, width: row.width, height: row.height } : null;
  } catch (err) {
    // A picture that renders at one size is a smaller problem than a section
    // that fails to render at all.
    console.error("[media] could not read the other sizes", err);
    return null;
  }
}
