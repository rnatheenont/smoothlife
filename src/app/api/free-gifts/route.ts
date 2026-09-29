import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { FreeGiftPromoRow, rowToPromo, FREE_GIFT_COLUMNS } from "@/data/free-gifts";
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
    const wantsStock = promos.some((p) => p.giftVariantId);
    const stock = wantsStock ? new Map((await freeGiftProducts()).map((g) => [g.variantId, g.stock])) : new Map();

    const now = Date.now();
    const live = promos
      .map((p) => ({ ...p, giftStock: p.giftVariantId ? (stock.get(p.giftVariantId) ?? null) : undefined }))
      .filter((p) => {
        if (p.starts && new Date(p.starts).getTime() > now) return false;
        if (p.expires && new Date(p.expires).getTime() < now) return false;
        // null means we could not ask Shopify; the promo stands rather than
        // vanishing from the shop because one API call timed out.
        return !(typeof p.giftStock === "number" && p.giftStock <= 0);
      });

    return NextResponse.json({ promos: live });
  } catch (err) {
    console.error("[free-gifts] fetch failed", err);
    return NextResponse.json({ promos: [] });
  }
}
