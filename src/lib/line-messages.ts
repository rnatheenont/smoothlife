import { getProductBySlug } from "@/data/products";
import { lineOpenLink, type LineMessage } from "@/lib/line-push";

// Smoothie's product recommendations, as LINE sees them.
//
// On the website a `[[slug]]` in her reply becomes a product card. In LINE it
// used to become a bare LIFF link — two lines of %2F-encoded URL under a
// product name, which is the least appealing way to show someone a product
// they were just told to consider. LINE's own equivalent of the card is a Flex
// carousel, so this builds one: photo, brand, name, price, and a button that
// opens the product inside LINE, already signed in.

const BRAND_GREEN = "#0E9F6E";
const INK = "#1F2937";
const MUTED = "#9CA3AF";

// LINE allows 12 bubbles in a carousel. Five is the point at which a customer
// is choosing rather than scrolling a catalogue, and Smoothie rarely names
// more than three in one answer anyway.
const MAX_BUBBLES = 5;

function baht(amount: number) {
  return `฿${amount.toLocaleString("th-TH")}`;
}

function bubble(product: NonNullable<ReturnType<typeof getProductBySlug>>) {
  const link = lineOpenLink(`/product/${product.slug}`);
  const price: LineMessage[] = [
    { type: "text", text: baht(product.price), weight: "bold", size: "md", color: BRAND_GREEN, flex: 0 },
  ];
  // Only when it is genuinely a discount: Shopify leaves compareAtPrice equal
  // to the price on plenty of products, and a struck-through price identical
  // to the one beside it reads as a mistake.
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    price.push({
      type: "text",
      text: baht(product.compareAtPrice),
      size: "xs",
      color: MUTED,
      decoration: "line-through",
      margin: "sm",
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: product.image,
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "cover",
      backgroundColor: "#FFFFFF",
      action: { type: "uri", label: product.name.slice(0, 20), uri: link },
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        { type: "text", text: product.brand || "Smooth Life", size: "xxs", color: MUTED },
        // Three lines, then an ellipsis: Thai product names run long, and a
        // bubble that grows to fit one pushes the button out of alignment with
        // its neighbours in the carousel.
        { type: "text", text: product.name, size: "sm", weight: "bold", color: INK, wrap: true, maxLines: 3 },
        { type: "box", layout: "baseline", margin: "md", contents: price },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: BRAND_GREEN,
          action: { type: "uri", label: "ดูสินค้า", uri: link },
        },
      ],
    },
  };
}

/**
 * A carousel for the products named in a reply, or null when none were.
 *
 * Silently drops a slug with no product behind it (a renamed or delisted one)
 * rather than showing an empty card — the answer's text still stands on its
 * own, which is why the slugs are stripped from it either way.
 */
export function productCarousel(slugs: string[]): LineMessage | null {
  const seen = new Set<string>();
  const bubbles = slugs
    .filter((slug) => !seen.has(slug) && (seen.add(slug), true))
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.image))
    .slice(0, MAX_BUBBLES)
    .map(bubble);

  if (!bubbles.length) return null;
  return {
    type: "flex",
    // What the customer sees in the chat list and what a screen reader says.
    altText: bubbles.length === 1 ? "สินค้าที่แนะนำ" : `สินค้าที่แนะนำ ${bubbles.length} รายการ`,
    contents: { type: "carousel", contents: bubbles },
  };
}

/** The `[[slug]]` product references in a reply, in the order she named them. */
export function productSlugsIn(text: string): string[] {
  return [...text.matchAll(/\[\[([a-z0-9-]+)\]\]/gi)].map((m) => m[1]);
}
