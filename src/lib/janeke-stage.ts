import type { Product } from "@/data/types";
import type { Colourway, StageModel } from "@/components/brand/SuperbrushStage";

// Turns the Janeke shelf into the slides the brand stage shows.
//
// The catalogue has one product per colourway — "Janeke Small Superbrush Blue
// Pastel" is its own row with its own photograph — so the grouping the stage
// needs (a model, with its colours under it) has to be read back out of the
// names. It is read from the slug rather than the Thai title: the slug is what
// the import writes and the one part of a product that does not get retyped.

type ModelSpec = {
  key: string;
  title: string;
  wordmark: string;
  blurb: string;
  /** First match wins, so the narrower slugs are listed first. */
  match: (slug: string) => boolean;
  /** Dropped from the product name to leave the colour behind. */
  strip: RegExp;
};

const MODELS: ModelSpec[] = [
  {
    key: "maculata",
    wordmark: "Maculata",
    title: "Maculata",
    blurb: "ลายพิมพ์เสือดาว สำหรับคนที่อยากให้หวีเป็นของสะสม",
    match: (s) => s.includes("maculata"),
    strip: /\[new\]|janeke|mac|superbrush|maculata/gi,
  },
  {
    key: "premium",
    wordmark: "Premium",
    title: "Premium",
    blurb: "งานชุบเมทัลลิก ทั้งด้ามและซี่หวี",
    match: (s) => s.includes("premium"),
    strip: /\[new\]|janeke|premium|superbrush/gi,
  },
  {
    key: "small",
    wordmark: "Superbrush",
    title: "Small",
    blurb: "ขนาดพกพา ลงกระเป๋าได้ทั้งใบ",
    match: (s) => s.includes("small-superbrush"),
    strip: /\[new\]|janeke|small|superbrush/gi,
  },
  {
    key: "superbrush",
    wordmark: "Superbrush",
    title: "Superbrush",
    blurb: "ซี่หวียืดหยุ่น หวีผมเปียกได้ ไม่ดึงรั้งเส้นผม",
    match: (s) => s.includes("superbrush"),
    strip: /\[new\]|janeke|superbrush/gi,
  },
];

/** The colour words these combs are sold in, as swatch + wash. */
const COLOURS: { test: RegExp; swatch: [string, string]; tint: string; th: string }[] = [
  { test: /lillac\s*fucsia|lilac\s*fuchsia/i, swatch: ["#b39ddb", "#e91e8c"], tint: "#f3e6f7", th: "ไลแลค ฟูเชีย" },
  { test: /orange\s*yellow/i, swatch: ["#ff9800", "#ffd54f"], tint: "#fdf0dc", th: "ส้ม เหลือง" },
  { test: /blue\s*pastel|pastel\s*blue/i, swatch: ["#a7d8f0", "#e3f4fb"], tint: "#e8f6fd", th: "ฟ้าพาสเทล" },
  { test: /pink\s*pastel|pastel\s*pink/i, swatch: ["#f8c8d8", "#fdeaf1"], tint: "#fdeef3", th: "ชมพูพาสเทล" },
  { test: /deep\s*blue/i, swatch: ["#1a3a8f", "#4a6fd0"], tint: "#e4e9f8", th: "น้ำเงินเข้ม" },
  { test: /light\s*blue/i, swatch: ["#7ec8e3", "#d3eefa"], tint: "#e6f5fc", th: "ฟ้าอ่อน" },
  { test: /lillac|lilac/i, swatch: ["#b39ddb", "#ded0f0"], tint: "#f0eafa", th: "ไลแลค" },
  { test: /fucsia|fuchsia|fux/i, swatch: ["#e91e8c", "#f8a9d2"], tint: "#fbe6f2", th: "ฟูเชีย" },
  { test: /purple/i, swatch: ["#7b4fa8", "#c3a6dd"], tint: "#efe8f7", th: "ม่วง" },
  { test: /orange/i, swatch: ["#ff7a2f", "#ffc08a"], tint: "#fdeade", th: "ส้ม" },
  { test: /green/i, swatch: ["#4caf50", "#a9dcab"], tint: "#e8f6e9", th: "เขียว" },
  { test: /pink/i, swatch: ["#f06292", "#f9bcd0"], tint: "#fce9ef", th: "ชมพู" },
  { test: /blue/i, swatch: ["#2196f3", "#a5d6f7"], tint: "#e6f3fd", th: "ฟ้า" },
  { test: /gold/i, swatch: ["#c9a227", "#f0dc8a"], tint: "#faf2dc", th: "ทอง" },
  { test: /silver/i, swatch: ["#9aa3ad", "#dfe4e8", ], tint: "#eef1f3", th: "เงิน" },
  { test: /tse/i, swatch: ["#6d4c41", "#c8a27a"], tint: "#f3ebe4", th: "น้ำตาล" },
];

const DEFAULT_COLOUR = { swatch: ["#111827", "#6b7280"] as [string, string], tint: "#eef1f3", th: "คลาสสิก" };

type Shelf = Pick<Product, "slug" | "name" | "price" | "image" | "inStock"> & {
  images?: string[];
};

/**
 * The two colours of the dome behind each comb, taken from the comb itself:
 * the inner grid first, the handle second. The design fills the arc with both
 * — a pink-and-purple comb gets a pink-to-purple dome — which one colour could
 * never do.
 *
 * Measured off the design rather than guessed: in the Figma the leopard comb's
 * pad is rgb(88,183,228) and its dome is #b6efff — the same hue, saturation
 * pushed up by about a third, lightness at 0.86. Running that on every cut-out
 * reproduces the designed dome to within 5/255 and gives the rest of the range
 * a dome that matches its own comb, which a hand-written table of colour names
 * never did.
 */
/**
 * The two colours of each comb, read off its own photograph: the handle and
 * the grid. The swatch is drawn from these rather than from the colour's name,
 * because the names in this range do not describe what you see — the comb the
 * shop calls "Blue" is teal with a yellow grid.
 */
const SWATCHES: Record<string, [string, string]> = {
  "fuchsia-blue": ["#d25aa0", "#1eb4dc"],
  "gold-brown": ["#faf0d2", "#644646"],
  "green-fuchsia": ["#64d200", "#e664be"],
  "leopard-lightblue": ["#a0826e", "#78d2f0"],
  "leopard-magenta": ["#b48c6e", "#d246aa"],
  "lightblue-solid": ["#3caad2", "#3caad2"],
  "lilac-white": ["#b496c8", "#beb4d2"],
  "mint-white": ["#b4d2c8", "#b4d2c8"],
  "navy-lightblue": ["#0a0a46", "#28b4f0"],
  "palepink-magenta-a": ["#dcbed2", "#c85aaa"],
  "palepink-magenta-b": ["#dcbed2", "#c85aaa"],
  "purple-fuchsia": ["#6e468c", "#be3278"],
  "red-orange": ["#fa1e0a", "#f03214"],
  "teal-pink": ["#0abec8", "#f04678"],
  "teal-yellow": ["#32b4b4", "#e6be00"],
  "yellow-orange": ["#fabe00", "#e61400"],
};

const DOMES: Record<string, [string, string]> = {
  "fuchsia-blue": ["#b8f2ff", "#f5c1e1"],
  "gold-brown": ["#e6d8d0", "#ffedb8"],
  "green-fuchsia": ["#feb9e5", "#d9ffb8"],
  "leopard-lightblue": ["#b8eaff", "#e5d7d2"],
  "leopard-magenta": ["#f6c0e8", "#ebdbcc"],
  "lightblue-solid": ["#bfe9f8", "#bbedfb"],
  "lilac-white": ["#d6cceb", "#e2cee9"],
  "mint-white": ["#d2e4e4", "#d2e4e4"],
  "navy-lightblue": ["#b8eaff", "#b9b9fe"],
  "palepink-magenta-a": ["#f2c5e8", "#ebcce0"],
  "palepink-magenta-b": ["#f2c5e8", "#ebcce0"],
  "purple-fuchsia": ["#f8bedb", "#dbcbeb"],
  "red-orange": ["#ffbfb8", "#ffbeb8"],
  "teal-pink": ["#ffb8cc", "#b8ffff"],
  "teal-yellow": ["#fff4b8", "#bff7f7"],
  "yellow-orange": ["#ffbbb8", "#ffebb8"],
};

/**
 * The masked photographs, by the product each one is of.
 *
 * Every cut-out the shop has sits in /public/brands/janeke; only the ones
 * whose colourway names exactly one product in the range are attached here.
 * The rest wait for somebody to say which is which — this range sells two
 * pinks and two lilac-fuchsias, and the wrong photograph on a product is worse
 * than a plain studio shot.
 */
const CUTOUTS: Record<string, string> = {
  "janeke-premium-gold-superbrush": "/brands/janeke/gold-brown.webp",
  "janeke-premium-silver-superbrush": "/brands/janeke/silver-grey.webp",
  "janeke-mac-tse-superbrush-maculata": "/brands/janeke/leopard-lightblue.webp",
  // Fux is the leopard with the magenta pad, Tse the one with light blue —
  // the new set has both, so the two no longer share a photograph.
  "janeke-mac-fux-superbrush-maculata": "/brands/janeke/leopard-magenta.webp",
  // Colour names that belong to exactly one product in the range, so the
  // photograph can only be of that one: no other comb here is navy with a
  // light blue pad, or yellow with an orange one.
  "new-janeke-small-superbrush-deep-blue": "/brands/janeke/navy-lightblue.webp",
  "new-janeke-small-superbrush-green-1": "/brands/janeke/yellow-orange.webp",
  "new-janeke-superbrush-purple": "/brands/janeke/purple-fuchsia.webp",
  "new-janeke-superbrush-lillac": "/brands/janeke/lilac-white.webp",
  "new-janeke-superbrush-orange": "/brands/janeke/red-orange.webp",
  "new-janeke-superbrush-light-blue": "/brands/janeke/lightblue-solid.webp",
  // Matched by comparing the dominant colours of each cut-out against the
  // product's own catalogue photograph, not by reading the colour's name:
  // this range calls a teal comb with a pink pad "Blue".
  "new-janeke-small-superbrush-blue": "/brands/janeke/teal-pink.webp",
  "new-janeke-small-superbrush-blue-pastel": "/brands/janeke/mint-white.webp",
  "new-janeke-small-superbrush-green": "/brands/janeke/green-fuchsia.webp",
  "new-janeke-small-superbrush-pink-pastel": "/brands/janeke/palepink-magenta-a.webp",
  // The second of two near-identical pale pinks, told apart by the shop.
  "new-janeke-small-superbrush-lillac-fucsia": "/brands/janeke/palepink-magenta-b.webp",
  // The full-size one is the same colourway as the Small — the shop's photos
  // of the two agree on it (deep magenta pad, pale lilac body) — and a floating
  // cut-out says nothing about size, so one photograph serves both.
  "new-janeke-superbrush-lillac-fucsia": "/brands/janeke/palepink-magenta-b.webp",
  "new-janeke-superbrush-pink": "/brands/janeke/fuchsia-blue.webp",
  // Confirmed by the shop, and not guessable: the comb is teal with a yellow
  // pad and the range calls it Blue.
  "new-janeke-superbrush-blue": "/brands/janeke/teal-yellow.webp",
};

/**
 * The photograph that can float.
 *
 * The stage puts the comb on a tinted arch with nothing behind it, so it wants
 * a cut-out. The catalogue carries both: PNGs from the brand's own press kit,
 * which are cut out, and JPG/WebP lifestyle shots, which are not. Preferring a
 * PNG gets the right one wherever the shop has it, and anything uploaded in
 * the admin (see withCustomImages, which runs before this) wins over both
 * because it arrives first in the list.
 */
function floatable(p: Shelf): string {
  const all = [p.image, ...(p.images ?? [])].filter(Boolean) as string[];
  return all.find((u) => /\.png(\?|$)/i.test(u)) ?? all[0] ?? "";
}

export function janekeModels(items: Shelf[]): StageModel[] {
  const out = new Map<string, StageModel>();

  for (const p of items) {
    const cut = CUTOUTS[p.slug];
    const image = cut ?? floatable(p);
    if (!image) continue;
    const spec = MODELS.find((m) => m.match(p.slug));
    if (!spec) continue;

    // What is left of the name once the model words are gone is the colour —
    // and when nothing is left, this is the plain one the range started with.
    const rest = p.name.replace(spec.strip, " ").replace(/\s+/g, " ").trim();
    const colour = COLOURS.find((c) => c.test.test(rest || p.slug));
    const art = cut ? cut.split("/").pop()?.replace(/\.webp$/, "") : undefined;
    const pair = art ? DOMES[art] : undefined;
    const way: Colourway = {
      slug: p.slug,
      colour: colour?.th ?? (rest ? rest : DEFAULT_COLOUR.th),
      swatch: (art && SWATCHES[art]) ?? colour?.swatch ?? DEFAULT_COLOUR.swatch,
      // The photograph's own two dome colours where there is one; the colour
      // name's single approximation only for products still on a catalogue
      // photo, where both stops are the same and the arc reads as one colour.
      tint: pair?.[0] ?? colour?.tint ?? DEFAULT_COLOUR.tint,
      tint2: pair?.[1] ?? colour?.tint ?? DEFAULT_COLOUR.tint,
      image,
      // A cut-out floats; a square studio photograph gets a frame, or it reads
      // as a white box somebody forgot to mask.
      cutout: Boolean(cut),
      price: p.price,
      soldOut: p.inStock === false,
    };

    const model =
      out.get(spec.key) ??
      { key: spec.key, title: spec.title, wordmark: spec.wordmark, blurb: spec.blurb, items: [] };
    model.items.push(way);
    out.set(spec.key, model);
  }

  // Cheapest model first, which is also the one the headline quotes a price
  // from; within a model, the colours in catalogue order.
  return [...out.values()]
    .filter((m) => m.items.length > 0)
    .sort((a, b) => Math.min(...a.items.map((i) => i.price)) - Math.min(...b.items.map((i) => i.price)));
}
