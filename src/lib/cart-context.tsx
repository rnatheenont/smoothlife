"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { products } from "@/data/products";
import { ProductVariant } from "@/data/types";
import { useAuth } from "@/lib/auth-context";
import { CartLine } from "@/data/coupons";
import { evaluateActiveFreeGifts, FreeGiftPromo } from "@/data/free-gifts";

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
  giftPromos: FreeGiftPromo[];
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "sl_cart";
const COUPON_KEY = "sl_coupon";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCodeState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [giftPromos, setGiftPromos] = useState<FreeGiftPromo[]>([]);

  useEffect(() => {
    fetch("/api/free-gifts")
      .then((r) => r.json())
      .then((data) => setGiftPromos(Array.isArray(data?.promos) ? data.promos : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]") as (CartItem & { variantId?: string })[];
      // Carts saved before per-variant support only stored {slug, qty} — fill
      // in each product's default variant so old carts keep working instead
      // of silently losing their variantId (and thus their price/checkout line).
      const migrated = saved
        .map((i) => {
          if (i.variantId) return i as CartItem;
          const p = products.find((pr) => pr.slug === i.slug);
          return p ? { slug: i.slug, variantId: p.variantId, qty: i.qty } : null;
        })
        .filter(Boolean) as CartItem[];
      setItems(migrated);
      setCouponCodeState(localStorage.getItem(COUPON_KEY));
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);

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
  function sameLine(i: CartItem, variantId: string, subscribeMonths?: 3 | 6 | 12) {
    return i.variantId === variantId && i.subscribeMonths === subscribeMonths;
  }

  function addItem(slug: string, qty = 1, variantId?: string, subscribeMonths?: 3 | 6 | 12) {
    const p = products.find((pr) => pr.slug === slug);
    const resolvedVariantId = variantId || p?.variantId;
    if (!resolvedVariantId) return;
    const stock = p?.variants.find((v) => v.variantId === resolvedVariantId)?.quantity;
    setItems((prev) => {
      const existing = prev.find((i) => sameLine(i, resolvedVariantId, subscribeMonths));
      const currentQty = existing?.qty ?? 0;
      const nextQty = typeof stock === "number" ? Math.min(currentQty + qty, stock) : currentQty + qty;
      if (nextQty <= 0) return prev;
      if (existing) {
        return prev.map((i) => (sameLine(i, resolvedVariantId, subscribeMonths) ? { ...i, qty: nextQty } : i));
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
        const p = products.find((pr) => pr.slug === i.slug);
        const stock = p?.variants.find((v) => v.variantId === variantId)?.quantity;
        return { ...i, qty: typeof stock === "number" ? Math.min(qty, stock) : qty };
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

  const lines = items
    .map((i) => {
      const p = products.find((pr) => pr.slug === i.slug);
      if (!p) return null;
      const v = p.variants.find((variant) => variant.variantId === i.variantId);
      return {
        slug: i.slug,
        variantId: i.variantId,
        qty: i.qty,
        name: p.name,
        price: v ? v.price : p.price,
        image: p.image,
        compareAtPrice: v ? v.compareAtPrice : p.compareAtPrice,
        brand: p.brand,
        category: p.category,
        size: v ? v.size : p.size || "",
        variants: p.variants,
        stock: v?.quantity,
        subscribeMonths: i.subscribeMonths,
      };
    })
    .filter(Boolean) as CartContextValue["lines"];

  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

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
  function giftLineFor(gp: ReturnType<typeof products.find>, qty: number, giftPromoSlug: string) {
    if (!gp) return null; // misconfigured slug — fail closed, don't crash the cart
    return {
      slug: gp.slug,
      variantId: gp.variantId,
      qty,
      name: gp.name,
      price: 0,
      image: gp.image,
      compareAtPrice: undefined,
      brand: gp.brand,
      category: gp.category,
      size: gp.size || "",
      variants: gp.variants,
      stock: undefined,
      isGift: true,
      giftPromoSlug,
    };
  }
  const giftLines = evaluateActiveFreeGifts(giftPromos, cartLinesForEval)
    .filter((e) => e.eligible)
    .flatMap((e) => {
      if (e.unlockedTiers) {
        // Tiered promo — one synthetic line per unlocked tier, keyed
        // uniquely per tier so multiple tiers of the same promo don't
        // collide on giftPromoSlug.
        return e.unlockedTiers.map((t) =>
          giftLineFor(
            products.find((pr) => pr.slug === t.giftProductSlug),
            t.giftQty,
            `${e.promo.slug}::tier-${t.tierIndex}`
          )
        );
      }
      return [giftLineFor(products.find((pr) => pr.slug === e.promo.giftProductSlug), e.promo.giftQty, e.promo.slug)];
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
        giftPromos,
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
