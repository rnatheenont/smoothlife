"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { ProductVariant } from "@/data/types";
import type { CartProduct } from "@/data/cart-product";
import { useAuth } from "@/lib/auth-context";
import { CartLine } from "@/data/coupons";
import { evaluateActiveFreeGifts, FreeGiftPromo, giftsOf } from "@/data/free-gifts";
import {
  buildLines,
  clampQty,
  giftLineFrom,
  reconcileItems,
  sameLine as isSameLine,
  stockOf,
  subtotalOf,
  type ProductsBySlug,
} from "@/lib/cart-lines";

// The cart no longer knows the catalogue.
//
// It used to import all ~1,000 products to turn {slug, variantId, qty} into
// a row with a name and a price — and because this provider wraps every
// page, that array was downloaded by every visitor on every visit for the
// sake of the three products in their cart. Now it asks
// /api/products/lite?slugs= for exactly those, keeps the answer in
// localStorage so a reload paints the cart before the network replies, and
// works out the rows in cart-lines.ts, where the arithmetic is tested.
//
// What a customer is charged does not come from here either way:
// /api/checkout/init resolves every line's price from its variantId and
// never trusts a number sent by a browser. A stale cached price can make
// the cart show yesterday's total for a moment; it cannot charge it.

/** Products the cart has fetched, kept across reloads. */
const PRODUCTS_KEY = "sl_cart_products";

type CartItem = {
  slug: string;
  variantId: string;
  qty: number;
  /** Set only for a line added via the "สมัครรับประจำ" discount-code fallback
   *  — the plan's month count, so the cart can show it as a distinct
   *  subscription line (own row, own badge) instead of silently merging
   *  into a same-variant line added the normal way. */
  subscribeMonths?: 3 | 6 | 12;
};

type CartContextValue = {
  items: CartItem[];
  /** variantId defaults to the product's own default (cheapest in-stock) variant when omitted. subscribeMonths tags this as a subscribe-sourced line, kept separate from a normal line of the same variant. */
  addItem: (slug: string, qty?: number, variantId?: string, subscribeMonths?: 3 | 6 | 12) => void;
  /** subscribeMonths disambiguates when a subscribe line and a normal line share the same variantId — omit for a normal line. */
  removeItem: (variantId: string, subscribeMonths?: 3 | 6 | 12) => void;
  updateQty: (variantId: string, qty: number, subscribeMonths?: 3 | 6 | 12) => void;
  /** Switch a cart line to a different size of the same product. If that size is already a separate line (same subscribeMonths tag), the two lines are merged instead of creating a duplicate. */
  changeVariant: (variantId: string, newVariantId: string, subscribeMonths?: 3 | 6 | 12) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  lines: {
    slug: string;
    variantId: string;
    qty: number;
    name: string;
    price: number;
    image: string;
    compareAtPrice?: number;
    brand: string;
    category: string;
    size: string;
    variants: ProductVariant[];
    /** Real Shopify stock count for this line's variant, when the store exposes it — undefined means unlimited/unknown, never a fabricated cap. */
    stock?: number;
    /** True for a synthetic free-gift line derived from an eligible FreeGiftPromo — never persisted, never independently editable. */
    isGift?: boolean;
    giftPromoSlug?: string;
    subscribeMonths?: 3 | 6 | 12;
  }[];
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
  /** What Shopify says the applied code takes off this exact cart. */
  couponQuote: CouponQuote | null;
  couponPending: boolean;
  giftPromos: FreeGiftPromo[];
  /** One of the products the cart has already fetched — the lines in it and
   *  the gifts the live promos give away. The gift widgets draw a picture
   *  and a name for those gifts; looking them up in the catalogue is what
   *  put the catalogue in the browser. Undefined until the fetch lands. */
  productBySlug: (slug: string) => CartProduct | undefined;
};

export type CouponQuote =
  | { ok: true; code: string; title: string; discount: number }
  | { ok: false; code: string; reason: string };

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "sl_cart";
const COUPON_KEY = "sl_coupon";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCodeState] = useState<string | null>(null);
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [giftPromos, setGiftPromos] = useState<FreeGiftPromo[]>([]);
  const [bySlug, setBySlug] = useState<ProductsBySlug>({});

  useEffect(() => {
    fetch("/api/free-gifts")
      .then((r) => r.json())
      .then((data) => setGiftPromos(Array.isArray(data?.promos) ? data.promos : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      // A cart saved before per-variant support stored only {slug, qty}. The
      // empty variantId is filled in by reconcileItems once the product
      // arrives — it cannot be filled in here any more, because knowing a
      // product's default variant is exactly what this file stopped
      // carrying the catalogue for.
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]") as (CartItem & { variantId?: string })[];
      setItems(
        saved
          .filter((i) => i && typeof i.slug === "string" && typeof i.qty === "number")
          .map((i) => ({ slug: i.slug, variantId: i.variantId ?? "", qty: i.qty, subscribeMonths: i.subscribeMonths }))
      );
      setCouponCodeState(localStorage.getItem(COUPON_KEY));
    } catch {
      setItems([]);
    }
    try {
      // Last visit's answer, so the cart draws before the network replies.
      const cached = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}") as ProductsBySlug;
      if (cached && typeof cached === "object") setBySlug(cached);
    } catch {}
    setHydrated(true);
  }, []);

  // Every slug the cart needs to draw: what is in it, plus the products the
  // live free-gift promos give away (a gift is a row too).
  const neededSlugs = useMemo(() => {
    const slugs = new Set(items.map((i) => i.slug));
    for (const promo of giftPromos) {
      if (promo.giftProductSlug) slugs.add(promo.giftProductSlug);
      for (const tier of promo.tiers ?? []) if (tier.giftProductSlug) slugs.add(tier.giftProductSlug);
    }
    return [...slugs].sort();
  }, [items, giftPromos]);

  const slugKey = neededSlugs.join(",");

  useEffect(() => {
    if (!hydrated || !slugKey) return;
    let cancelled = false;
    fetch(`/api/products/lite?slugs=${encodeURIComponent(slugKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.products)) return;
        setBySlug((prev) => {
          const next: ProductsBySlug = { ...prev };
          for (const p of data.products as CartProduct[]) next[p.slug] = p;
          try {
            localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
      })
      // Offline, or the route is down: the cart keeps drawing from the
      // cached copy rather than emptying itself.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, slugKey]);

  // Fresh data can mean a size that no longer exists or a quantity the shop
  // no longer has. Applied once per arrival; reconcileItems returns the very
  // same array when there is nothing to repair, which is what keeps this
  // from looping.
  useEffect(() => {
    if (!hydrated) return;
    setItems((prev) => reconcileItems(prev, bySlug));
  }, [bySlug, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  // Every discount number the customer sees comes from Shopify, re-asked
  // whenever the cart or the code changes.
  //
  // A coupon is a statement about a cart, not about a code: remove the one
  // qualifying item and a ฿100 discount silently becomes nothing. Re-quoting
  // on every change is how the cart, the checkout page and the charge stay
  // the same number — and how a code that has stopped qualifying says so
  // while the customer can still do something about it.
  const quoteKey = JSON.stringify(items.map((i) => [i.variantId, i.qty]));
  useEffect(() => {
    if (!couponCode) {
      setCouponQuote(null);
      return;
    }
    const payload = items.map((i) => ({ variantId: i.variantId, quantity: i.qty }));
    if (!payload.length) {
      setCouponQuote(null);
      return;
    }
    let cancelled = false;
    setCouponPending(true);
    fetch("/api/coupons/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, lines: payload }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCouponQuote(
          data?.ok
            ? { ok: true, code: data.code, title: data.title, discount: data.discount }
            : { ok: false, code: couponCode, reason: data?.reason || "ใช้โค้ดนี้ไม่ได้" }
        );
      })
      .catch(() => {
        if (!cancelled) setCouponQuote({ ok: false, code: couponCode, reason: "ตรวจสอบโค้ดไม่สำเร็จ" });
      })
      .finally(() => {
        if (!cancelled) setCouponPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode, quoteKey]);

  function setCouponCode(code: string | null) {
    setCouponCodeState(code);
    try {
      if (code) localStorage.setItem(COUPON_KEY, code);
      else localStorage.removeItem(COUPON_KEY);
    } catch {}
  }

  // A subscribe-sourced line and a normal line never merge even when they
  // share a variantId — subscribeMonths is part of a line's identity, not
  // just display metadata, precisely so the two stay visually and
  // functionally separate in the cart.
  const sameLine = isSameLine;

  /**
   * Adds a product to the cart.
   *
   * The variant: passed in by callers that know it (a product page where a
   * size is selected, a card that carries its default variant). Left empty
   * otherwise, and filled in from /api/products/lite on the next breath —
   * this file cannot look up a default variant any more, and guessing one
   * would be guessing which size someone is buying.
   */
  function addItem(slug: string, qty = 1, variantId?: string, subscribeMonths?: 3 | 6 | 12) {
    const resolvedVariantId = variantId || bySlug[slug]?.variantId || "";
    const stock = stockOf(bySlug[slug], resolvedVariantId);
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === slug && sameLine(i, resolvedVariantId, subscribeMonths));
      const currentQty = existing?.qty ?? 0;
      const nextQty = clampQty(currentQty + qty, stock);
      if (nextQty <= 0) return prev;
      if (existing) {
        return prev.map((i) =>
          i.slug === slug && sameLine(i, resolvedVariantId, subscribeMonths) ? { ...i, qty: nextQty } : i
        );
      }
      return [...prev, { slug, variantId: resolvedVariantId, qty: nextQty, subscribeMonths }];
    });
  }
  function removeItem(variantId: string, subscribeMonths?: 3 | 6 | 12) {
    setItems((prev) => prev.filter((i) => !sameLine(i, variantId, subscribeMonths)));
  }
  function updateQty(variantId: string, qty: number, subscribeMonths?: 3 | 6 | 12) {
    if (qty <= 0) return removeItem(variantId, subscribeMonths);
    setItems((prev) =>
      prev.map((i) => {
        if (!sameLine(i, variantId, subscribeMonths)) return i;
        return { ...i, qty: clampQty(qty, stockOf(bySlug[i.slug], variantId)) };
      })
    );
  }
  function changeVariant(variantId: string, newVariantId: string, subscribeMonths?: 3 | 6 | 12) {
    if (variantId === newVariantId) return;
    setItems((prev) => {
      const item = prev.find((i) => sameLine(i, variantId, subscribeMonths));
      if (!item) return prev;
      const target = prev.find((i) => sameLine(i, newVariantId, subscribeMonths));
      if (target) {
        return prev
          .map((i) => (sameLine(i, newVariantId, subscribeMonths) ? { ...i, qty: i.qty + item.qty } : i))
          .filter((i) => !sameLine(i, variantId, subscribeMonths));
      }
      return prev.map((i) => (sameLine(i, variantId, subscribeMonths) ? { ...i, variantId: newVariantId } : i));
    });
  }
  function clear() {
    setItems([]);
    setCouponCode(null);
  }

  const lines = buildLines(items, bySlug) as CartContextValue["lines"];

  // The badge counts what is in the cart, not what has been drawn: it must
  // not drop to zero while the products are still on their way.
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = subtotalOf(lines);

  // Free-gift lines are fully derived from the real lines above — never
  // persisted, never independently addable/removable — so a gift always
  // reflects current cart eligibility and disappears the moment it no
  // longer applies, with no separate bookkeeping to keep in sync.
  const cartLinesForEval: CartLine[] = lines.map((l) => ({
    slug: l.slug,
    qty: l.qty,
    price: l.price,
    brand: l.brand,
    category: l.category as CartLine["category"],
  }));
  const giftLineFor = giftLineFrom;
  /** A gift that lives only on Shopify's free-gift shelf — UNLISTED, so absent from our catalogue. */
  function shopifyGiftLine(variantId: string, title: string | undefined, image: string | null | undefined, qty: number, giftPromoSlug: string) {
    return {
      slug: variantId,
      variantId,
      qty,
      name: (title ?? "ของแถม").replace(/^\s*(TEST\s*\|\s*)?\[Free Gift\]\s*/i, "").trim(),
      price: 0,
      image: image ?? "",
      compareAtPrice: undefined,
      brand: "",
      category: "" as CartLine["category"],
      size: "",
      variants: [],
      stock: undefined,
      isGift: true,
      giftPromoSlug,
    };
  }

  /** Every gift a promo or tier hands over, as cart lines. A promo can give
   *  several at once — the ฿1,599 tier gives four — so this returns a list
   *  and the catalogue is tried first for each, the shelf second. */
  const linesForGifts = (source: Parameters<typeof giftsOf>[0], key: string) =>
    giftsOf(source).flatMap((item, i) => {
      // Keyed per gift, or two gifts from one promo collide on giftPromoSlug.
      const itemKey = giftsOf(source).length > 1 ? `${key}::gift-${i}` : key;
      const fromCatalogue = item.productSlug
        ? giftLineFrom(bySlug[item.productSlug], item.qty, itemKey)
        : null;
      if (fromCatalogue) return [fromCatalogue];
      return item.variantId
        ? [shopifyGiftLine(item.variantId, item.title, item.image, item.qty, itemKey)]
        : [];
    });

  const giftLines = evaluateActiveFreeGifts(giftPromos, cartLinesForEval)
    .filter((e) => e.eligible)
    .flatMap((e) => {
      if (e.unlockedTiers) {
        // Tiered promo — one synthetic line per unlocked tier, keyed
        // uniquely per tier so multiple tiers of the same promo don't
        // collide on giftPromoSlug.
        return e.unlockedTiers.flatMap((t) =>
          linesForGifts(t, `${e.promo.slug}::tier-${t.tierIndex}`),
        );
      }
      // The gift usually lives on Shopify's free-gift shelf rather than in our
      // catalogue — every one of them is UNLISTED there — so the promo carries
      // its name and picture and the line is built from those. The catalogue
      // lookup stays for promos written before the shelf existed.
      return linesForGifts(e.promo, e.promo.slug);
    })
    .filter(Boolean) as CartContextValue["lines"];
  const linesWithGifts = [...lines, ...giftLines];

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        changeVariant,
        clear,
        count,
        subtotal,
        lines: linesWithGifts,
        couponCode,
        setCouponCode,
        couponQuote,
        couponPending,
        giftPromos,
        productBySlug: (slug: string) => bySlug[slug],
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

// --- Wishlist ---
type WishlistContextValue = {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
};
const WishlistContext = createContext<WishlistContextValue | null>(null);
const WISHLIST_KEY = "sl_wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Guards the one-time merge-with-server so it runs once per login, not on
  // every render.
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    try {
      setSlugs(JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"));
    } catch {
      setSlugs([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(WISHLIST_KEY, JSON.stringify(slugs));
  }, [slugs, hydrated]);

  // Logged-in customers get a real, cross-device wishlist backed by
  // Supabase — guests keep working from localStorage only. On login, merge
  // whatever's already saved on this device with the server copy so
  // nothing gets lost either direction.
  useEffect(() => {
    if (!user || !hydrated || syncedForUser.current === user.id) return;
    syncedForUser.current = user.id;
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((data) => {
        const serverSlugs: string[] = Array.isArray(data?.slugs) ? data.slugs : [];
        setSlugs((prev) => {
          const merged = Array.from(new Set([...serverSlugs, ...prev]));
          const toPush = merged.filter((s) => !serverSlugs.includes(s));
          if (toPush.length) {
            fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slugs: toPush }),
            }).catch(() => {});
          }
          return merged;
        });
      })
      .catch(() => {});
  }, [user, hydrated]);

  function toggle(slug: string) {
    const isRemoving = slugs.includes(slug);
    setSlugs((prev) => (isRemoving ? prev.filter((s) => s !== slug) : [...prev, slug]));
    if (!user) return;
    if (isRemoving) {
      fetch(`/api/wishlist?slug=${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => {});
    } else {
      fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: [slug] }),
      }).catch(() => {});
    }
  }
  function has(slug: string) {
    return slugs.includes(slug);
  }

  return <WishlistContext.Provider value={{ slugs, toggle, has }}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
