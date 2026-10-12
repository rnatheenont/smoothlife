import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { products } from "@/data/products";
import { guessSubcategory, subcategoryLabel } from "@/lib/subcategories";

// The stored half of the subcategory feature. The rules themselves live in
// src/lib/subcategories.ts and import nothing, so they stay unit-testable;
// this file is where a guess meets what a person decided about it.
//
// Why a table rather than a field on the product: the catalogue snapshot is
// regenerated from Shopify on every deploy (scripts/fetch-products.js), so
// anything written into it is erased by the next build. A row keyed by slug
// survives that, and survives a product being renamed in Shopify too.

export type SubcategoryRow = {
  product_slug: string;
  category: string;
  subcategory: string | null;
  source: "auto" | "manual";
  confirmed_at: string | null;
  confirmed_by: string | null;
};

/** A product, its guess, and whatever a person has said about it. */
export type ProductShelf = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  /** What the rules think, which may be null. */
  guess: string | null;
  /** What is stored, once someone has decided. Null until then. */
  decided: string | null;
  decidedLabel: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

async function storedRows(category?: string): Promise<SubcategoryRow[]> {
  if (!supabaseConfigured()) return [];
  const where = category ? `category=eq.${pgValue(category)}&` : "";
  try {
    return await supabaseRest<SubcategoryRow[]>(`product_subcategories?${where}select=*&limit=2000`);
  } catch (err) {
    // Fails soft: a storefront that cannot read this should show the shop
    // without subcategory chips, not an error page.
    console.error("[product-subcategories] could not read", err);
    return [];
  }
}

/**
 * Every in-stock product in a category, with its guess and its decision.
 *
 * Sorted so the work comes first: the ones nobody has looked at, with the
 * ones the rules could not guess at the very top — those are the only rows
 * that genuinely need a human, and burying them under 400 confirmed rows is
 * how a review queue stops being worked.
 */
export async function shelvesFor(category: string): Promise<ProductShelf[]> {
  const rows = await storedRows(category);
  const byProduct = new Map(rows.map((r) => [r.product_slug, r]));

  const items = products
    .filter((p) => p.inStock && p.category === category)
    .map((p): ProductShelf => {
      const row = byProduct.get(p.slug);
      const guess = guessSubcategory(p);
      const decided = row ? row.subcategory : null;
      return {
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        category: p.category,
        image: p.image,
        guess,
        decided,
        decidedLabel: decided ? (subcategoryLabel(category, decided) ?? decided) : null,
        confirmed: Boolean(row?.confirmed_at),
        confirmedAt: row?.confirmed_at ?? null,
        confirmedBy: row?.confirmed_by ?? null,
      };
    });

  const rank = (s: ProductShelf) => (s.confirmed ? 2 : s.guess ? 1 : 0);
  return items.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "th"));
}

/**
 * The shelf a product is actually on, for the storefront.
 *
 * Only confirmed rows count. An unreviewed guess is good enough to put in
 * front of staff and not good enough to put in front of a customer — the
 * whole point of the review step is that the rules are wrong often enough to
 * matter, and a shopper who opens "กันแดด" and finds a lip balm has been
 * told something false by the shop.
 */
export async function confirmedShelves(category: string): Promise<Map<string, string>> {
  const rows = await storedRows(category);
  const out = new Map<string, string>();
  for (const row of rows) {
    if (row.confirmed_at && row.subcategory) out.set(row.product_slug, row.subcategory);
  }
  return out;
}

/** Records a decision. `subcategory: null` means "belongs on no shelf". */
export async function setShelf(opts: {
  slug: string;
  category: string;
  subcategory: string | null;
  by: string;
}): Promise<void> {
  if (!supabaseConfigured()) throw new Error("supabase not configured");
  await supabaseRest("product_subcategories?on_conflict=product_slug", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      product_slug: opts.slug,
      category: opts.category,
      subcategory: opts.subcategory,
      source: "manual",
      confirmed_at: new Date().toISOString(),
      confirmed_by: opts.by,
      updated_at: new Date().toISOString(),
    }),
  });
}

/**
 * Writes the guess for every product in a category that nobody has decided
 * on yet — as a *confirmed* row, because the person pressing the button is
 * saying "these are right". Rows already decided are left alone, so this can
 * be pressed twice without undoing anyone's work.
 */
export async function confirmAllGuesses(category: string, by: string): Promise<number> {
  const shelves = await shelvesFor(category);
  const pending = shelves.filter((s) => !s.confirmed && s.guess);
  if (pending.length === 0) return 0;
  await supabaseRest("product_subcategories?on_conflict=product_slug", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(
      pending.map((s) => ({
        product_slug: s.slug,
        category,
        subcategory: s.guess,
        source: "auto",
        confirmed_at: new Date().toISOString(),
        confirmed_by: by,
        updated_at: new Date().toISOString(),
      }))
    ),
  });
  return pending.length;
}
