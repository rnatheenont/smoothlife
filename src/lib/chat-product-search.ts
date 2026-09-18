// Product lookup for the chat assistant, run on our own server.
//
// The assistant used to receive the whole catalogue (~82K tokens) with every
// message. Now it asks for what it needs through two tools and gets back only
// a handful of matching lines, so a message costs a few thousand tokens
// instead of ~89K — and "สวัสดี" costs no catalogue at all.
//
// Search has to work for Thai questions against a catalogue whose
// descriptions are often English only, so each product also carries Thai and
// English tags for its type and what it is for (from the reviewed product
// classification in skin-product-classes.json, plus the store's categories and
// concerns). Rare words count for more than common ones, so "กันแดด ผิวมัน"
// ranks oil-control sunscreens above every product that merely says "ผิว".

import type Anthropic from "@anthropic-ai/sdk";
import type { Product } from "@/data/types";
import { products, getProductBySlug } from "@/data/products";
import { categories, concerns as siteConcerns } from "@/data/categories";
import classesJson from "@/data/skin-product-classes.json";

type ProductClass = { type: string; face: boolean; primary: string[]; secondary: string[]; suits: string[] };
const CLASSES = classesJson as unknown as Record<string, ProductClass>;

const PROMO = /\[[^\]]*(free|pack|buy|get)[^\]]*\]|\([^)]*(deal|free|pack)[^)]*\)|\bpack\s*\d|buy\s*\d\s*get|แพ็ค|แถม/i;

const PRIORITY_BRANDS = ["smooth e", "dentiste", "smooth life"];
const isPriorityBrand = (brand: string) => PRIORITY_BRANDS.some((b) => brand.toLowerCase().includes(b));

const TYPE_WORDS: Record<string, string> = {
  cleanser: "ล้างหน้า โฟมล้างหน้า เจลล้างหน้า cleanser foam face wash",
  makeup_remover: "ล้างเครื่องสำอาง คลีนซิ่ง ไมเซล่า micellar cleansing makeup remover",
  toner: "โทนเนอร์ toner",
  exfoliant: "ผลัดเซลล์ผิว สครับ exfoliant scrub peeling aha bha",
  serum: "เซรั่ม serum essence แอมพูล ampoule",
  moisturizer: "ครีมบำรุงผิวหน้า มอยส์เจอไรเซอร์ มอยเจอไรเซอร์ moisturizer moisturiser face cream",
  sunscreen: "กันแดด ครีมกันแดด sunscreen sunblock spf uv",
  spot_treatment: "แต้มสิว เจลแต้มสิว แผ่นแปะสิว spot treatment acne patch",
  mask: "มาส์ก มาสก์ mask",
  eye_care: "ครีมรอบดวงตา ใต้ตา อายครีม eye cream",
  set: "เซ็ต เซต ชุด set",
  lip: "ลิป ลิปบาล์ม ริมฝีปาก lip balm",
  body: "ผิวกาย โลชั่นทาผิว ครีมทาผิว body lotion",
  hair: "ผม แชมพู ผมร่วง หนังศีรษะ shampoo hair scalp",
  oral: "ยาสีฟัน ฟัน ช่องปาก น้ำยาบ้วนปาก แปรงสีฟัน กลิ่นปาก toothpaste mouthwash toothbrush oral",
  supplement: "อาหารเสริม วิตามิน คอลลาเจน supplement vitamin capsule",
  other: "",
};

const CONCERN_WORDS: Record<string, string> = {
  acne: "สิว acne",
  spots: "จุดด่างดำ ฝ้า กระ รอยสิว รอยดำ dark spot melasma pigmentation",
  wrinkles: "ริ้วรอย ชะลอวัย wrinkle anti-aging",
  texture: "ผิวไม่เรียบเนียน ผิวขรุขระ texture",
  pores: "รูขุมขน pores",
  darkCircles: "ใต้ตาคล้ำ ขอบตาดำ dark circles",
  eyeBags: "ถุงใต้ตา ตาบวม eye bags puffiness",
  redness: "ผิวแดง ผิวแพ้ง่าย ระคายเคือง sensitive redness soothing",
  oiliness: "ผิวมัน หน้ามัน คุมมัน oily oil control",
  moisture: "ผิวแห้ง ชุ่มชื้น ขาดน้ำ dry hydrating moisture",
  radiance: "หมองคล้ำ กระจ่างใส ผิวใส brightening glow",
  firmness: "หย่อนคล้อย กระชับ ยกกระชับ firming lifting",
};

const SKIN_TYPE_WORDS: Record<string, string> = {
  oily: "ผิวมัน oily skin",
  dry: "ผิวแห้ง dry skin",
  combination: "ผิวผสม combination skin",
  normal: "ผิวธรรมดา normal skin",
  sensitive: "ผิวแพ้ง่าย sensitive skin",
};

type Indexed = { p: Product; name: string; brand: string; purpose: string; tags: string; short: string; body: string; ingredients: string };

let index: Indexed[] | null = null;
function getIndex() {
  if (index) return index;
  index = products.map((p) => {
    const c = CLASSES[p.slug];
    const tags = [
      categories.find((x) => x.slug === p.category)?.nameTh ?? "",
      p.category,
      // The store's own concern tags are broad ("สิวและผิวแพ้ง่าย" sits on body
      // serums too); for skin and body products the reviewed classification
      // below says it better. Hair, oral and wellness products keep them.
      ...(p.category === "skincare" || p.category === "body-care" ? [] : p.concerns).map((k) => {
        const info = siteConcerns.find((x) => x.slug === k);
        return `${k} ${info?.nameTh ?? ""} ${info?.name ?? ""}`;
      }),
      ...(c ? c.secondary.map((k) => CONCERN_WORDS[k] ?? "") : []),
      ...(c ? c.suits.map((k) => SKIN_TYPE_WORDS[k] ?? "") : []),
    ].join(" ");
    // What the product is and what it is mainly for — the strongest signal.
    const purpose = c ? [TYPE_WORDS[c.type] ?? "", ...c.primary.map((k) => CONCERN_WORDS[k] ?? "")].join(" ") : "";
    return {
      p,
      name: p.name.toLowerCase(),
      brand: p.brand.toLowerCase(),
      purpose: purpose.toLowerCase(),
      tags: tags.toLowerCase(),
      short: p.shortDesc.toLowerCase(),
      body: `${p.benefits.join(" ")} ${p.whoFor} ${(p.description || "").slice(0, 500)}`.toLowerCase(),
      ingredients: (p.ingredients || "").toLowerCase(),
    };
  });
  return index;
}

const FIELDS: [keyof Omit<Indexed, "p">, number][] = [
  ["purpose", 3.5],
  ["name", 3],
  ["brand", 3],
  ["tags", 2],
  ["short", 1.5],
  ["ingredients", 1],
  ["body", 1],
];

export type SearchInput = {
  query: string;
  category?: string;
  product_type?: string;
  max_price?: number;
  in_stock_only?: boolean;
  limit?: number;
};

export function searchProducts(input: SearchInput): Product[] {
  const idx = getIndex();
  const terms = Array.from(
    new Set(
      String(input.query || "")
        .toLowerCase()
        .split(/[\s,|/]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
    )
  ).slice(0, 12);
  const phrase = String(input.query || "").toLowerCase().trim().replace(/\s+/g, " ");
  const limit = Math.max(1, Math.min(15, Math.round(input.limit ?? 8)));

  let pool = idx;
  if (input.category) pool = pool.filter((x) => x.p.category === input.category);
  if (input.product_type) pool = pool.filter((x) => CLASSES[x.p.slug]?.type === input.product_type);
  if (typeof input.max_price === "number" && input.max_price > 0) pool = pool.filter((x) => x.p.price <= input.max_price!);
  if (input.in_stock_only) pool = pool.filter((x) => x.p.inStock);

  // A word found in few products tells more than one found in most of them.
  const weight = new Map<string, number>();
  for (const t of terms) {
    const df = idx.reduce((n, x) => n + (FIELDS.some(([f]) => x[f].includes(t)) ? 1 : 0), 0);
    weight.set(t, df === 0 ? 0 : Math.log(1 + idx.length / df));
  }

  const scored = pool
    .map((x) => {
      let score = 0;
      let matched = 0;
      for (const t of terms) {
        const best = FIELDS.reduce((m, [f, w]) => (x[f].includes(t) ? Math.max(m, w) : m), 0);
        score += best * (weight.get(t) ?? 0);
        if (best > 0) matched++;
      }
      if (terms.length === 0) score = 1; // filters only
      else {
        // Matching more of what was asked beats matching one rare word.
        score *= 0.5 + (0.5 * matched) / terms.length;
        // The customer typed (part of) a product's name.
        if (phrase.length >= 6 && x.name.includes(phrase)) score *= 2;
      }
      if (score > 0 && !x.p.inStock) score *= 0.7;
      // A single product before its multipacks and "buy 1 get 1" listings.
      if (score > 0 && (CLASSES[x.p.slug]?.type === "set" || PROMO.test(x.p.name))) score *= 0.85;
      return { x, score };
    })
    .filter((r) => r.score > 0);

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(isPriorityBrand(b.x.p.brand)) - Number(isPriorityBrand(a.x.p.brand)) ||
      (b.x.p.sold ?? 0) - (a.x.p.sold ?? 0) ||
      a.x.p.name.length - b.x.p.name.length ||
      a.x.p.slug.localeCompare(b.x.p.slug)
  );
  return scored.slice(0, limit).map((r) => r.x.p);
}

function stockText(p: Product) {
  if (!p.inStock) return "OUT OF STOCK";
  const qty = p.variants.find((v) => v.variantId === p.variantId)?.quantity;
  return typeof qty === "number" && qty > 0 && qty <= 10 ? `in stock, low-stock:${qty}` : "in stock";
}

function priceText(p: Product) {
  return `฿${p.price}${p.compareAtPrice ? ` (was ฿${p.compareAtPrice})` : ""}`;
}

function resultLine(p: Product) {
  const c = CLASSES[p.slug];
  const kind = c ? ` | type:${c.type}${c.primary.length ? ` for:${c.primary.join(",")}` : ""}` : "";
  const short = p.shortDesc && p.shortDesc !== p.name ? `\n  ${p.shortDesc.slice(0, 120)}` : "";
  return `${p.slug} | ${p.name.slice(0, 110)} | ${p.brand} | ${priceText(p)} | ${p.category}${kind} | ${stockText(p)}${short}`;
}

function productDetails(slug: string) {
  const p = getProductBySlug(slug);
  if (!p) return `No product with slug "${slug}". Use a slug exactly as search_products returned it.`;
  const sizes =
    p.variants.length > 1 ? p.variants.map((v) => `  - ${v.size || "Default"}: ฿${v.price}`).join("\n") : "";
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  return [
    resultLine(p),
    p.benefits.length ? `benefits: ${p.benefits.slice(0, 6).map((b) => clip(b, 160)).join("; ")}` : "",
    p.howToUse ? `how to use: ${clip(p.howToUse, 400)}` : "",
    p.ingredients ? `ingredients: ${clip(p.ingredients, 400)}` : "",
    p.whoFor ? `who it's for: ${clip(p.whoFor, 200)}` : "",
    sizes ? `sizes:\n${sizes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_products",
    description:
      "Search the Smoothlife catalogue. Returns up to `limit` products, best match first, one per line: slug | name | brand | price | category | type and main purpose | stock, then a short description. " +
      "Put several short keywords in `query`, in Thai AND English, covering the product kind, the problem and the skin type — e.g. \"กันแดด sunscreen ผิวมัน oily\", \"ยาสีฟัน toothpaste เสียวฟัน sensitive\", a brand (\"Eucerin\") or an ingredient (\"niacinamide\"). " +
      "If nothing fits, search again with different or broader words before telling the customer we don't have it.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords, Thai and English, space-separated." },
        category: {
          type: "string",
          enum: ["skincare", "oral-care", "hair-care", "personal-care", "wellness", "body-care",
            "dermo-cosmetics", "womens-health", "health-devices", "mother-baby"],
          description: "Optional: only this store category.",
        },
        product_type: {
          type: "string",
          enum: Object.keys(TYPE_WORDS),
          description: "Optional: only this kind of product.",
        },
        max_price: { type: "number", description: "Optional: highest price in baht." },
        in_stock_only: { type: "boolean", description: "Optional: leave out products that are out of stock." },
        limit: { type: "integer", minimum: 1, maximum: 15, description: "How many results (default 8)." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_details",
    description:
      "Full details for one product by slug: benefits, how to use, ingredients, who it is for, sizes and prices, stock. Use it when the customer asks about a specific product's use, ingredients or sizes.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string", description: "The product slug exactly as search_products returned it." } },
      required: ["slug"],
    },
  },
];

/** Runs one tool call from the model and returns the text to send back. */
export function runChatTool(name: string, input: unknown): string {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (name === "search_products") {
    const found = searchProducts({
      query: typeof args.query === "string" ? args.query : "",
      category: typeof args.category === "string" ? args.category : undefined,
      product_type: typeof args.product_type === "string" ? args.product_type : undefined,
      max_price: typeof args.max_price === "number" ? args.max_price : undefined,
      in_stock_only: args.in_stock_only === true,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    });
    if (found.length === 0) return "No products matched. Try other keywords (Thai and English, a brand, or a broader product kind).";
    return found.map(resultLine).join("\n");
  }
  if (name === "get_product_details") {
    return productDetails(typeof args.slug === "string" ? args.slug : "");
  }
  return `Unknown tool ${name}.`;
}
