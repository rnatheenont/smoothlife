"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { products } from "@/data/products";

type CartItem = { slug: string; qty: number };

type CartContextValue = {
  items: CartItem[];
  addItem: (slug: string, qty?: number) => void;
  removeItem: (slug: string) => void;
  updateQty: (slug: string, qty: number) => void;
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
  }[];
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "sl_cart";
const COUPON_KEY = "sl_coupon";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCodeState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      setItems(saved);
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

  function addItem(slug: string, qty = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === slug);
      if (existing) {
        return prev.map((i) => (i.slug === slug ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { slug, qty }];
    });
  }
  function removeItem(slug: string) {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }
  function updateQty(slug: string, qty: number) {
    if (qty <= 0) return removeItem(slug);
    setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, qty } : i)));
  }
  function clear() {
    setItems([]);
    setCouponCode(null);
  }

  const lines = items
    .map((i) => {
      const p = products.find((pr) => pr.slug === i.slug);
      if (!p) return null;
      return {
        slug: i.slug,
        variantId: p.variantId,
        qty: i.qty,
        name: p.name,
        price: p.price,
        image: p.image,
        compareAtPrice: p.compareAtPrice,
        brand: p.brand,
        category: p.category,
      };
    })
    .filter(Boolean) as CartContextValue["lines"];

  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQty, clear, count, subtotal, lines, couponCode, setCouponCode }}
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
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  function toggle(slug: string) {
    setSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
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
