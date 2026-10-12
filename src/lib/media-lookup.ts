import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// Finding a library picture's other sizes from the one URL a section stores.
//
// A section stores a single URL, because that is what an image field is and
// what a picture pasted from somewhere else looks like too. The other widths
// are looked up here, by that URL, so a section whose picture did not come
// from the library still works — it simply has nothing extra to offer the
// browser.

export async function mediaSourcesFor(url: string): Promise<Record<string, string> | null> {
  if (!supabaseConfigured() || !url) return null;
  try {
    const [row] = await supabaseRest<{ sources: Record<string, string> }[]>(
      `media_assets?select=sources&url=eq.${encodeURIComponent(url)}&limit=1`
    );
    return row?.sources ?? null;
  } catch (err) {
    // A picture that renders at one size is a smaller problem than a section
    // that fails to render at all.
    console.error("[media] could not read the other sizes", err);
    return null;
  }
}
