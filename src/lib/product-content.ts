import {
  pgValue,
  supabaseConfigured,
  supabaseRest,
  supabaseRestCached,
} from "@/lib/supabase-server";
import type { Product } from "@/data/types";

// The free-form, bilingual content blocks that overlay a product's page —
// same idea as seo-overrides.ts (a Supabase row overlaying the generated
// catalogue), for the parts of a product page Shopify's own metafields never
// got filled in for (see the plan this came out of: 0.2% of 1,086 products
// had anything in Shopify's "Tab 1/Tab 2" fields).
//
// Keyed by one specific variant's GID, not by slug or SKU — see the comment
// on `ProductVariant.sku` in data/types.ts for why: a slug can change on a
// handle collision, and a SKU is hand-typed and not guaranteed unique. A
// variant's own GID never moves — but `Product.variantId` is NOT that: it's
// recomputed on every catalogue build as whichever variant is currently
// cheapest-and-in-stock (see fetch-products.js), so it can point at a
// different variant the day a price changes or a size sells out. Content
// written against it would silently "vanish" on the page that moved.
// `stableContentVariantId()` below picks the variant whose GID sorts lowest
// instead — the one thing about a product's variant set that doesn't change
// unless that specific variant is deleted from Shopify.

/** A fixed anchor for a product's content, independent of pricing/stock. */
export function stableContentVariantId(
  product: Pick<Product, "variantId" | "variants">,
): string {
  if (!product.variants.length) return product.variantId;
  return product.variants.reduce((min, v) => {
    const a = BigInt(v.variantId.split("/").pop() || "0");
    const b = BigInt(min.variantId.split("/").pop() || "0");
    return a < b ? v : min;
  }, product.variants[0]).variantId;
}

/**
 * `hidden` is on every block: the shop writes a block, parks it, and keeps
 * publishing the rest. Without it the only way to keep one block off the page
 * was to unpublish the whole product or delete the words.
 *
 * A hidden block is not held to the both-languages rule either — see the
 * publish check in the PUT route. Parking a half-written block is most of why
 * it exists.
 */
export type ContentBlock =
  | {
      type: "paragraph";
      headingTh?: string;
      headingEn?: string;
      bodyTh: string;
      bodyEn: string;
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      type: "bullet_list";
      headingTh?: string;
      headingEn?: string;
      itemsTh: string[];
      itemsEn: string[];
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      type: "ingredients";
      itemsTh: string[];
      itemsEn: string[];
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      // Both carry their own heading, the way "ingredients" does: a product
      // page that calls this section something different on every product is
      // a page nobody can skim.
      type: "who_for";
      itemsTh: string[];
      itemsEn: string[];
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      type: "how_to_use";
      itemsTh: string[];
      itemsEn: string[];
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      type: "image_text";
      imageUrl: string;
      headingTh?: string;
      headingEn?: string;
      bodyTh: string;
      bodyEn: string;
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      type: "image";
      imageUrl: string;
      captionTh?: string;
      captionEn?: string;
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      type: "video";
      videoUrl: string;
      posterUrl?: string;
      captionTh?: string;
      captionEn?: string;
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    }
  | {
      type: "spec_table";
      rows: {
        labelTh: string;
        labelEn: string;
        valueTh: string;
        valueEn: string;
      }[];
      hasVerifiedSource?: boolean;
      hidden?: boolean;
    };

export const BLOCK_TYPES: { key: ContentBlock["type"]; label: string }[] = [
  { key: "paragraph", label: "ย่อหน้า" },
  { key: "bullet_list", label: "รายการหัวข้อย่อย" },
  { key: "ingredients", label: "ส่วนผสม" },
  { key: "image_text", label: "รูปภาพ + คำอธิบาย" },
  { key: "spec_table", label: "ตารางสเปค" },
  { key: "image", label: "รูปภาพ" },
  { key: "video", label: "วิดีโอ" },
  { key: "who_for", label: "เหมาะสำหรับใคร" },
  { key: "how_to_use", label: "วิธีใช้" },
];

/** The heading these blocks always carry, in both languages. */
export const FIXED_HEADING: Partial<
  Record<ContentBlock["type"], { th: string; en: string }>
> = {
  ingredients: { th: "ส่วนผสม", en: "Ingredients" },
  who_for: { th: "เหมาะสำหรับใคร", en: "Who it's for" },
  how_to_use: { th: "วิธีใช้", en: "How to use" },
};

// ---------------------------------------------------------------------------
// Video links.
//
// A "video" block holds whatever link an admin pasted; this is the one place
// that decides what that link actually plays, so the editor's preview and the
// product page cannot disagree about it. Anything unrecognised returns null
// and is treated as "not filled in yet" rather than dropped into an <iframe>
// unseen — the src of a frame on our own origin is not a field to be lax
// about, and the allowlist here is what keeps it to the three players the CSP
// in next.config.mjs permits.

export type VideoSource = {
  kind: "youtube" | "vimeo" | "facebook" | "tiktok" | "instagram" | "file";
  src: string;
  /** What shape to give the frame. Social clips are shot for a phone and are
   *  taller than they are wide; forcing them into 16:9 leaves the player
   *  letterboxed in a wide black band. */
  aspect: string;
};

const LANDSCAPE = "16 / 9";
const YOUTUBE_ID = /^[\w-]{6,20}$/;

/** A Facebook link that actually points at a video rather than a photo or a
 *  profile — their player answers with an error page for the rest. */
function isFacebookVideoPath(
  parts: string[],
  search: URLSearchParams,
): boolean {
  if (parts.includes("videos") || parts[0] === "reel" || parts[0] === "watch")
    return true;
  if (parts[0] === "share" && parts[1] === "v") return true;
  if (parts[0] === "video.php" || parts[0] === "watch.php") return true;
  return Boolean(search.get("v"));
}

export function parseVideoUrl(value: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  // http:// would be blocked as mixed content anyway, and a javascript: or
  // data: link must never reach an iframe src.
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const id =
      host === "youtu.be"
        ? parts[0]
        : parts[0] === "watch"
          ? url.searchParams.get("v") || ""
          : ["embed", "shorts", "live", "v"].includes(parts[0] ?? "")
            ? parts[1]
            : "";
    if (!id || !YOUTUBE_ID.test(id)) return null;
    // -nocookie: the same player without the ad/profile cookies a product page
    // has no business setting on a visitor who never pressed play.
    return {
      kind: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      aspect: LANDSCAPE,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = (parts[0] === "video" ? parts[1] : parts[0]) ?? "";
    if (!/^\d{6,12}$/.test(id)) return null;
    return {
      kind: "vimeo",
      src: `https://player.vimeo.com/video/${id}`,
      aspect: LANDSCAPE,
    };
  }

  // Social clips. Each of these is the platform's own embed address, built
  // from the link somebody copied out of the app — nothing is fetched here to
  // work out what the link points at, so a link whose shape says nothing about
  // a video is refused rather than framed and hoped for.
  if (
    host === "facebook.com" ||
    host === "web.facebook.com" ||
    host === "fb.watch"
  ) {
    if (host !== "fb.watch" && !isFacebookVideoPath(parts, url.searchParams))
      return null;
    // Facebook's player takes the whole original link as a parameter, so there
    // is no id to pull out — which is just as well, given how many shapes
    // their video URLs come in (/<page>/videos/<slug>, /watch/?v=, /reel/, a
    // share link).
    return {
      kind: "facebook",
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        url.toString(),
      )}&show_text=false`,
      // A reel is shot upright; the rest of their videos are not.
      aspect: parts[0] === "reel" ? "9 / 16" : LANDSCAPE,
    };
  }

  if (host === "tiktok.com") {
    const after = parts[parts.indexOf("video") + 1] ?? "";
    const id = parts.includes("video")
      ? after
      : parts[0] === "embed"
        ? parts[parts.length - 1]
        : "";
    // A vt.tiktok.com / vm.tiktok.com short link hides the id behind a redirect
    // we would have to follow server-side, so it is refused with the same
    // message as any other link we cannot play.
    if (!/^\d{6,25}$/.test(id)) return null;
    return {
      kind: "tiktok",
      src: `https://www.tiktok.com/embed/v2/${id}`,
      aspect: "9 / 16",
    };
  }

  if (host === "instagram.com") {
    const kind = parts[0] === "reels" ? "reel" : parts[0];
    const code = parts[1] ?? "";
    if (
      !["p", "reel", "tv"].includes(kind ?? "") ||
      !/^[\w-]{5,30}$/.test(code)
    )
      return null;
    // Their embed adds a header and the caption under the video, so the frame
    // is taller than the clip itself.
    return {
      kind: "instagram",
      src: `https://www.instagram.com/${kind}/${code}/embed`,
      aspect: "3 / 4",
    };
  }

  // A file served from somewhere we control — a Shopify CDN video, our own
  // storage bucket. Plays in a <video> tag, no third-party player involved.
  // Restricted to those hosts for the same reason the pictures are (IMAGE_HOSTS
  // in the save route) and to match media-src in next.config.mjs: a file from
  // a host nobody here controls is one that can be swapped for something else
  // after the page was approved.
  const ourHost =
    host === "cdn.shopify.com" ||
    host === "smoothlife.com" ||
    url.hostname.endsWith(".supabase.co");
  if (ourHost && /\.(mp4|webm|mov)$/i.test(url.pathname)) {
    return { kind: "file", src: url.toString(), aspect: LANDSCAPE };
  }
  return null;
}

export type ProductContentOverride = {
  id: string;
  variant_id: string;
  sku: string | null;
  slug: string | null;
  blocks: ContentBlock[];
  published: boolean;
  /** The admin_users row that last saved this, when there was one. Null for a
   *  bulk import and for anyone who signed in with the shared password, which
   *  carries no identity — see getAdminSession. */
  updated_by: string | null;
  updated_at: string;
};

export const PRODUCT_CONTENT_COLUMNS =
  "id,variant_id,sku,slug,blocks,published,updated_by,updated_at";

export function productContentTag(variantId: string) {
  return `product-content:${variantId}`;
}

/**
 * What a product's page should show beyond the generated defaults, or null
 * if nobody has written anything yet. Read through the Next cache and
 * tagged, same pattern as getSeoOverride — never throws, since missing
 * content is not worth failing a page render over.
 */
export async function getProductContentOverride(
  variantId: string,
): Promise<ProductContentOverride | null> {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabaseRestCached<ProductContentOverride[]>(
      `product_content_overrides?variant_id=eq.${pgValue(variantId)}&select=${PRODUCT_CONTENT_COLUMNS}&limit=1`,
      {
        revalidate: 3600,
        tags: [productContentTag(variantId), "product-content-overrides"],
      },
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** A block is only worth showing/publishing once it actually has text in
 *  both languages — an admin mid-edit shouldn't be able to publish a block
 *  that's still half-written in one language. */
/** A blank block of the given kind, ready to be typed into. */
export function emptyBlock(type: ContentBlock["type"]): ContentBlock {
  switch (type) {
    case "paragraph":
      return { type, bodyTh: "", bodyEn: "" };
    case "image_text":
      return { type, imageUrl: "", bodyTh: "", bodyEn: "" };
    case "bullet_list":
    case "ingredients":
    case "who_for":
    case "how_to_use":
      return { type, itemsTh: [], itemsEn: [] };
    case "spec_table":
      return { type, rows: [] };
    case "image":
      return { type, imageUrl: "" };
    case "video":
      return { type, videoUrl: "" };
  }
}

/**
 * The shape a product write-up is expected to take, as empty blocks.
 *
 * A product nobody has written up yet opens with these already laid out, so
 * the job is "fill in three boxes" rather than "decide what a product page
 * should contain, then build it". They are ordinary blocks: delete the ones
 * that do not apply, reorder them, add others.
 *
 * The three are what the write-ups that exist actually use — paragraph first
 * (it opens 20 of the 20 products written so far), then a bullet list of
 * selling points, then how-to-use. The spec table is deliberately not here:
 * it is imported from Shopify rather than typed, so a product that has one
 * already has it, and a product that does not is not waiting for somebody to
 * type it by hand.
 *
 * A function, not a constant: these get edited in place the moment they are
 * on screen, and a shared constant would carry one product's half-written
 * copy to the next one.
 */
export function starterBlocks(): ContentBlock[] {
  return [
    {
      ...emptyBlock("paragraph"),
      headingTh: "คุณสมบัติ",
      headingEn: "Properties",
    },
    {
      ...emptyBlock("bullet_list"),
      headingTh: "จุดเด่นของผลิตภัณฑ์",
      headingEn: "Key features",
    },
    // Carries its own heading from FIXED_HEADING, so it needs none here.
    emptyBlock("how_to_use"),
  ] as ContentBlock[];
}

/**
 * The starter the team has set, or the built-in one if they never did.
 *
 * Read on the server as part of loading a product's editor, so opening a
 * blank product is still one request and the decision of "what goes in a
 * starter" never reaches the browser as two possible answers.
 */
export async function getStarterBlocks(): Promise<ContentBlock[]> {
  if (!supabaseConfigured()) return starterBlocks();
  const [row] = await supabaseRest<{ blocks: ContentBlock[] | null }[]>(
    "product_content_starter?select=blocks&limit=1",
  ).catch((): { blocks: ContentBlock[] | null }[] => []);
  const saved = row?.blocks;
  // An empty list is a real answer — the team can decide a blank page is the
  // right start — so only a missing row falls back to the built-in one.
  return Array.isArray(saved) ? saved : starterBlocks();
}

/** What section of the page a block is, for deciding whether a product
 *  already has it.
 *
 *  Keyed on the heading a reader would see rather than on the block type,
 *  because the same section is written both ways across this catalogue: half
 *  the drafts carry วิธีใช้ as a how_to_use block and half as a paragraph
 *  headed "วิธีใช้". Matching on type alone put a second, empty วิธีใช้ under
 *  the one that was already there. Blocks with no heading at all — a picture,
 *  a clip, the spec table — are one of a kind, so those fall back to type. */
function sectionKey(block: ContentBlock): string {
  const own =
    block.type === "paragraph" ||
    block.type === "bullet_list" ||
    block.type === "image_text"
      ? block.headingTh
      : FIXED_HEADING[block.type]?.th;
  const heading = (own ?? "").trim().toLowerCase();
  return heading ? `h:${heading}` : `t:${block.type}`;
}

/**
 * The starter sections a product is still missing.
 *
 * A draft is unfinished by definition, and most of this catalogue's drafts
 * are a spec table imported from Shopify and nothing else — opening one
 * showed a finished-looking table and no sign that a write-up was expected.
 * These fill that gap: the sections the starter asks for and the product does
 * not have, as empty blocks beside what is already there. Nothing saved is
 * touched, reordered or rewritten.
 */
export function missingStarterBlocks(
  saved: ContentBlock[],
  starter: ContentBlock[],
): ContentBlock[] {
  const have = new Set(saved.map(sectionKey));
  const out: ContentBlock[] = [];
  for (const block of starter) {
    const key = sectionKey(block);
    if (have.has(key)) continue;
    // Added as we go, so a starter that lists the same section twice still
    // only puts it on the page once.
    have.add(key);
    out.push(block);
  }
  return out;
}

/**
 * Strip a submitted starter back to structure.
 *
 * Rebuilt from `emptyBlock` rather than trusted field by field: a starter
 * carrying words would put the same sentence on every product nobody had got
 * to yet, and this is the only place that can make that impossible.
 */
export function sanitiseStarter(input: unknown): ContentBlock[] {
  if (!Array.isArray(input)) return [];
  const types = new Set(BLOCK_TYPES.map((t) => t.key));
  const out: ContentBlock[] = [];
  for (const raw of input.slice(0, 12)) {
    const type = (raw as { type?: unknown })?.type;
    if (typeof type !== "string" || !types.has(type as ContentBlock["type"]))
      continue;
    const block = emptyBlock(type as ContentBlock["type"]);
    // Keyed off the type, not off whether the key is already there: an empty
    // paragraph has no `headingTh` property at all, so `"headingTh" in block`
    // was false for exactly the blocks that are allowed one, and every heading
    // the team typed was dropped on save.
    if (
      block.type === "paragraph" ||
      block.type === "bullet_list" ||
      block.type === "image_text"
    ) {
      const th = (raw as { headingTh?: unknown }).headingTh;
      const en = (raw as { headingEn?: unknown }).headingEn;
      if (typeof th === "string" && th.trim())
        block.headingTh = th.trim().slice(0, 120);
      if (typeof en === "string" && en.trim())
        block.headingEn = en.trim().slice(0, 120);
    }
    out.push(block);
  }
  return out;
}

/** Nothing has been typed into it yet — the state a starter block is in until
 *  somebody starts work. Media counts as written once it has a link. */
export function isBlockEmpty(block: ContentBlock): boolean {
  switch (block.type) {
    case "paragraph":
      return !block.bodyTh.trim() && !block.bodyEn.trim();
    case "image_text":
      return (
        !block.imageUrl.trim() && !block.bodyTh.trim() && !block.bodyEn.trim()
      );
    case "bullet_list":
    case "ingredients":
    case "who_for":
    case "how_to_use":
      return (
        block.itemsTh.every((s) => !s.trim()) &&
        block.itemsEn.every((s) => !s.trim())
      );
    case "spec_table":
      return block.rows.length === 0;
    case "image":
      return !block.imageUrl.trim();
    case "video":
      return !block.videoUrl.trim();
  }
}

export function isBlockComplete(block: ContentBlock): boolean {
  switch (block.type) {
    case "paragraph":
    case "image_text":
      return Boolean(block.bodyTh.trim() && block.bodyEn.trim());
    case "bullet_list":
    case "ingredients":
    case "who_for":
    case "how_to_use":
      return (
        block.itemsTh.filter((s) => s.trim()).length > 0 &&
        block.itemsEn.filter((s) => s.trim()).length > 0
      );
    case "spec_table":
      return (
        block.rows.length > 0 &&
        block.rows.every((r) => r.labelTh.trim() && r.labelEn.trim())
      );
    // Media carries itself: a photo or a clip is as complete in Thai as it is
    // in English, so the both-languages rule the text blocks live by would
    // only block publishing over an optional caption. The link is the thing
    // that has to be there.
    case "image":
      return Boolean(block.imageUrl.trim());
    case "video":
      return parseVideoUrl(block.videoUrl) !== null;
  }
}

// ---------------------------------------------------------------------------
// The storefront's half.
//
// getProductContentOverride() above returns a row whether or not it is
// published, which is what the editor wants when it loads a draft and is
// exactly wrong for a product page. These two are what the page uses.

/** Tagged by slug: the page makes one lookup for the whole product, so that is
 *  the unit a save has to invalidate. */
export function productContentPageTag(slug: string) {
  return `product-content-page:${slug}`;
}

/**
 * The published blocks for a product, or null when nobody has written any —
 * which is the case for almost all 1,086 products and has to stay cheap.
 *
 * Takes every one of the product's variant ids rather than one. The row is
 * keyed on a single variant, and a product's variant set changes whenever a
 * size is added or retired; matching on any of them keeps copy attached to the
 * product it was written for instead of to a bottle size. Read through the
 * Next cache, and never throws — a product page is worth more than its last
 * tab.
 */
export async function getPublishedProductContent(
  slug: string,
  variantIds: string[],
): Promise<ContentBlock[] | null> {
  if (!supabaseConfigured() || variantIds.length === 0) return null;
  try {
    const list = variantIds.map((id) => pgValue(id)).join(",");
    const rows = await supabaseRestCached<{ blocks: ContentBlock[] }[]>(
      `product_content_overrides?variant_id=in.(${list})&published=is.true&select=blocks&limit=1`,
      {
        revalidate: 3600,
        // Tagged with every one of the product's variants as well as the page
        // itself. The admin save route revalidates product-content:<variantId>
        // for the one variant the row is keyed on, and this read does not know
        // which that is — tagging all of them means a publish shows up here
        // whichever one the editor wrote to, with nothing to change at that end.
        tags: [
          productContentPageTag(slug),
          ...variantIds.map(productContentTag),
          "product-content",
        ],
      },
    );
    const blocks = rows[0]?.blocks;
    return Array.isArray(blocks) && blocks.length > 0 ? blocks : null;
  } catch {
    return null;
  }
}

/**
 * The blocks a person wrote for this product, as plain text for the chat
 * assistant.
 *
 * This is the content the product page actually shows, and until now the
 * assistant could not see a word of it: get_product_details answered from
 * the catalogue fields alone, so anything the team wrote by hand — the real
 * "how to use", the ingredient notes, who it suits — was invisible to the
 * one part of the shop that gets asked about it most.
 *
 * Thai only. The assistant is told to answer in the customer's language and
 * translates as it goes, so sending both copies would double the tokens to
 * say the same thing twice.
 */
export function productContentForPrompt(blocks: ContentBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.hidden) continue;
    const heading = "headingTh" in b ? b.headingTh?.trim() : undefined;
    const label = (fallback: string) => heading || FIXED_HEADING[b.type]?.th || fallback;
    switch (b.type) {
      case "paragraph":
      case "image_text":
        if (b.bodyTh?.trim()) out.push(`${heading ? `${heading}: ` : ""}${b.bodyTh.trim()}`);
        break;
      case "bullet_list":
        if (b.itemsTh?.length) out.push(`${label("รายละเอียด")}: ${b.itemsTh.join("; ")}`);
        break;
      case "ingredients":
      case "who_for":
      case "how_to_use":
        if (b.itemsTh?.length) out.push(`${label(b.type)}: ${b.itemsTh.join("; ")}`);
        break;
      case "spec_table":
        if (b.rows?.length) {
          out.push(`ข้อมูลจำเพาะ: ${b.rows.map((r) => `${r.labelTh} ${r.valueTh}`).join("; ")}`);
        }
        break;
      // image and video carry no text worth the tokens — a caption without
      // the picture it belongs to is a sentence about nothing.
      default:
        break;
    }
  }
  return out.join("\n");
}
