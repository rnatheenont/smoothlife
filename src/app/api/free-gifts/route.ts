import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { FreeGiftPromoRow, giftsOf, rowToPromo, FREE_GIFT_COLUMNS } from "@/data/free-gifts";
import { freeGiftProducts } from "@/lib/shopify-admin";

// What the storefront is allowed to promise.
//
// Three things can make an active promo not worth showing, and none of them is
// visible from the row alone: it has not started yet, it has ended, or the shop
// has run out of the gift. The last one is the reason this route talks to
// Shopify at all — the gifts are handed out by an app over there, and a
// progress bar counting a shopper toward a gift that ran out yesterday is a
// promise the checkout will not keep.

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ promos: [] });
  try {
    const rows = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?active=eq.true&select=${FREE_GIFT_COLUMNS}`);
    const promos = rows.map(rowToPromo);

    // One call for the whole page, cached five minutes inside the helper.
    const wantsGifts = promos.some(
      (p) =>
        giftsOf(p).some((g) => g.variantId) ||
        p.tiers?.some((t) => giftsOf(t).some((g) => g.variantId)),
    );
    const shelf = wantsGifts
      ? new Map((await freeGiftProducts()).map((g) => [g.variantId, g]))
      : new Map<string, Awaited<ReturnType<typeof freeGiftProducts>>[number]>();

    // Each gift carries its own name, picture and stock — a promo that hands
    // over four things has four of each, and the card has nothing to show
    // without them.
    const dress = (items: ReturnType<typeof giftsOf>) =>
      items.map((item) => {
        const g = item.variantId ? shelf.get(item.variantId) : undefined;
        return { ...item, title: g?.title, image: g?.image ?? null, stock: g?.stock ?? null };
      });

    const now = Date.now();
    const live = promos
      .map((p) => {
        const gift = p.giftVariantId ? shelf.get(p.giftVariantId) : undefined;
        return {
          ...p,
          giftStock: p.giftVariantId ? (gift?.stock ?? null) : undefined,
          giftTitle: gift?.title,
          giftImage: gift?.image ?? null,
          gifts: p.gifts ? dress(p.gifts) : undefined,
          tiers: p.tiers?.map((tier) => {
            const g = tier.giftVariantId ? shelf.get(tier.giftVariantId) : undefined;
            return {
              ...tier,
              giftTitle: g?.title,
              giftImage: g?.image ?? null,
              giftStock: g?.stock ?? null,
              gifts: tier.gifts ? dress(tier.gifts) : undefined,
            };
          }),
        };
      })
      .filter((p) => {
        if (p.starts && new Date(p.starts).getTime() > now) return false;
        if (p.expires && new Date(p.expires).getTime() < now) return false;
        // null means we could not ask Shopify; the promo stands rather than
        // vanishing from the shop because one API call timed out. A promo
        // handing over several things survives as long as one of them is
        // still on the shelf — the checkout drops the empty ones on its own.
        const everything = [...giftsOf(p), ...(p.tiers ?? []).flatMap((t) => giftsOf(t))];
        if (everything.length > 1) {
          return everything.some((g) => !(typeof g.stock === "number" && g.stock <= 0));
        }
        return !(typeof p.giftStock === "number" && p.giftStock <= 0);
      });

    return NextResponse.json({ promos: live });
  } catch (err) {
    console.error("[free-gifts] fetch failed", err);
    return NextResponse.json({ promos: [] });
  }
}
