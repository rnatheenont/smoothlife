import { brands, houseBrands, otherBrands } from "@/data/brands";

// The brand list the shop filters show, as the two strings they draw.
//
// data/brands.ts counts how many products each brand has, so importing it
// imports the catalogue — and the filter sheet is a client component. It
// needs a slug and a name; the numbers beside each row come from
// filterCounts, which is already worked out on the server.

export type BrandOption = { slug: string; name: string };

const option = (b: { slug: string; name: string }): BrandOption => ({ slug: b.slug, name: b.name });

export function brandOptions(): { house: BrandOption[]; other: BrandOption[] } {
  return { house: houseBrands.map(option), other: otherBrands.map(option) };
}

/** Slug to name, for showing what a chosen filter says. */
export function brandNames(): Record<string, string> {
  return Object.fromEntries(brands.map((b) => [b.slug, b.name]));
}
