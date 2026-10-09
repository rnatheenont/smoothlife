// The [[slug]] marker, turned into something a customer can read.
//
// Staff insert it from the product picker in the inbox, and the web chat
// renders it as a card with a photo and an add-to-cart button. Every other
// channel was sending the marker itself: a customer on LINE received the
// literal text "[[smooth-e-physical-white-extra-fluid-spf50-pa]]", which is
// the slug of the product being recommended and no help at all.
//
// Nothing is imported here on purpose. The thing a slug resolves to differs
// by channel — the catalogue for web and LINE, marketplace_item_map for a
// Shopee or TikTok shop, where the same product has that shop's own item id —
// so the caller passes a resolver instead of this file reaching for one. It
// also means the rules can be unit-tested without a database or a build.

/** What a slug turned out to be. `url` is omitted when the channel forbids
 *  links, or when there is nowhere to send the customer. */
export type ResolvedProduct = { name: string; url?: string };

export type MarkerOptions = {
  /** Shopee and TikTok ban links outright; web and LINE allow them. */
  allowsLinks: boolean;
  resolve: (slug: string) => ResolvedProduct | null;
};

/** Exactly two brackets each side — what the picker writes and what the web
 *  renderer looks for. A single [bracket] is ordinary punctuation, and a slug
 *  is ASCII, so Thai inside brackets is prose staff typed, not a marker. */
const MARKER = /\[\[([a-z0-9][a-z0-9-]*)\]\]/gi;

/** The same marker with the horizontal whitespace hugging it, so dropping one
 *  does not leave the gap it used to sit in. */
const MARKER_IN_LINE = /([ \t]*)\[\[([a-z0-9][a-z0-9-]*)\]\]([ \t]*)/gi;

/** The slugs a draft mentions, in order, without repeats. */
export function productMarkersIn(text: string): string[] {
  return [...new Set([...text.matchAll(MARKER)].map((m) => m[1].toLowerCase()))];
}

/**
 * Replaces every marker with the product's name — and its link, where the
 * channel allows one.
 *
 * A slug nothing matches is dropped rather than left in place: a marker that
 * reached the customer is the bug this function exists to fix, and passing an
 * unknown one through would be that bug with extra steps.
 */
export function renderProductMarkers(text: string, opts: MarkerOptions): string {
  return (
    text
      .replace(MARKER_IN_LINE, (_whole, before: string, slug: string, after: string) => {
        const found = opts.resolve(slug.toLowerCase());
        if (found) {
          const rendered = opts.allowsLinks && found.url ? `${found.name}\n${found.url}` : found.name;
          return `${before}${rendered}${after}`;
        }
        // Dropped. "แนะนำ [[x]] ค่ะ" must not become "แนะนำ  ค่ะ" — the two
        // spaces that were holding the marker up collapse into the one space
        // the sentence needs.
        return before && after ? " " : "";
      })
      // A marker alone on its line leaves the line behind when it goes, and
      // three blank lines in a row is how a careful reply starts looking
      // careless.
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
