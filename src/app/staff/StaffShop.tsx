"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  Mail,
  Check,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { Button } from "@heroui/react";
import { categories } from "@/data/categories";
import Countdown from "@/components/staff/Countdown";
import { flyToCart } from "@/lib/fly-to-cart";
import { HaloRing, RIM } from "@/components/Halo";
import { formatTHB } from "@/lib/format";
import { shopifyImage, shopifySquare, shopifySquareSrcSet } from "@/lib/shopify-image";
import type { StaffShopVariant } from "@/lib/staff-sale";

// The employee shop, all of its states.
//
// Separate from the ordinary cart on purpose — not a flag on it. A staff
// cart is priced from the round, capped per person, limited per product and
// paid for through its own checkout, and every one of those is a rule the
// shop's own cart has no idea about. Sharing the cart would mean teaching it
// four rules it would get wrong once.

type RoundInfo = {
  id?: string;
  name: string;
  ends_at: string;
  cap_thb?: number;
  payment_window_min?: number;
  max_per_item?: number | null;
  max_orders?: number | null;
};

type Standing = {
  staff_email: string;
  cap_thb: number;
  reserved_thb: number;
  spent_thb: number;
  left_thb: number;
};

type PendingOrder = {
  id: string;
  subtotal_thb: number;
  expires_at: string;
  payment_url: string | null;
  lines: { variant_id: string; product_slug: string; qty: number; staff_price: number }[];
};

type State =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "closed"; nextRound: { name: string; starts_at: string } | null }
  | { state: "signin" }
  | { state: "verify"; round: RoundInfo | null; suggestEmail?: string; proofDays?: number }
  | {
      state: "shop";
      round: RoundInfo;
      standing: Standing;
      items: StaffShopVariant[];
      pending: PendingOrder | null;
      shipTo: { summary: string; hasPhone: boolean } | null;
      ordersUsed: number;
      canOrder: boolean;
    };

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const CATEGORY_TH = new Map(categories.map((c) => [c.slug as string, c.nameTh]));

/**
 * The checkout button, in both of its states.
 *
 * Written out rather than taken from the shared Button because its disabled
 * state is the brand gradient at half opacity — which on a page this pale
 * reads as a pale green button, not as one that cannot be pressed. Solid
 * brand when it works, flat grey when it does not.
 */
const CHECKOUT_BUTTON =
  "grid h-12 place-items-center rounded-full px-6 text-sm font-bold transition-[filter,background-color] " +
  "bg-brand-gradient text-white hover:brightness-105 " +
  "disabled:cursor-not-allowed disabled:bg-slate-200 disabled:bg-none disabled:text-slate-500 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2";

/**
 * The payment window, draining.
 *
 * A number counting down says how long is left; a strip says it without
 * being read, which is what somebody glancing at the bottom of a phone
 * needs. One state flip and a CSS transition rather than a timer: the
 * browser animates the width over exactly the time remaining, costing
 * nothing per frame, and the page re-mounts this whenever it comes back
 * from the payment page so it never drifts.
 */
function WindowStrip({ to, windowMin }: { to: string; windowMin: number }) {
  const [width, setWidth] = useState<string | null>(null);
  const [leftMs, setLeftMs] = useState(0);

  useEffect(() => {
    const ms = Math.max(0, new Date(to).getTime() - Date.now());
    const total = Math.max(windowMin, 1) * 60_000;
    setLeftMs(ms);
    setWidth(`${Math.min(100, (ms / total) * 100)}%`);
    // Next frame, so the browser has the starting width before it is asked
    // to leave it.
    const id = requestAnimationFrame(() => setWidth("0%"));
    return () => cancelAnimationFrame(id);
  }, [to, windowMin]);

  if (width === null) return null;
  // Under five minutes it stops being information and starts being a
  // deadline, so it changes colour with the clock above it.
  const urgent = leftMs < 5 * 60_000;
  return (
    <span aria-hidden className="block h-1 w-full overflow-hidden bg-amber-100">
      <span
        className={`block h-full transition-[width] ease-linear motion-reduce:transition-none ${
          urgent ? "bg-rose-500" : "bg-amber-400"
        }`}
        style={{ width, transitionDuration: `${leftMs}ms` }}
      />
    </span>
  );
}

export default function StaffShop() {
  const [data, setData] = useState<State>({ state: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  // Read straight off the URL rather than through useSearchParams: that hook
  // puts the whole page behind a Suspense boundary, for one boolean that
  // only matters on the first paint after 2C2P sends the browser back.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("paid") === "1") {
      setJustPaid(true);
      // Taken out of the address so a reload does not claim a second
      // payment, and so the banner does not survive into the next visit.
      window.history.replaceState(null, "", "/staff");
    }
  }, []);

  const load = useCallback(async (): Promise<State | null> => {
    try {
      const res = await fetch("/api/staff/round", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "โหลดหน้าร้านไม่สำเร็จ");
      setData(json);
      // Handed back as well as stored: putting an order's lines back in the
      // cart needs the numbers from after the cancel, and React has not
      // re-rendered with them yet.
      return json as State;
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดหน้าร้านไม่สำเร็จ");
      setData({ state: "unavailable" });
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Coming back from the payment page.
  //
  // The shop loads its state once, on mount — and a phone returning from
  // 2C2P does not mount anything. iOS restores the page from the back-forward
  // cache exactly as it left, so the order that was just created is not on
  // it, and the only way to see it was to kill the app and start again.
  //
  // `pageshow` with `persisted` is that restore; `visibilitychange` covers
  // the tab being switched back to, and a browser that suspended the page
  // instead of caching it. Both only ever re-ask the same question, so
  // firing twice costs one request.
  useEffect(() => {
    const refresh = () => void load();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const shop = data.state === "shop" ? data : null;

  const subtotal = useMemo(() => {
    if (!shop) return 0;
    return Object.entries(cart).reduce((sum, [variantId, qty]) => {
      const item = shop.items.find((i) => i.variant_id === variantId);
      return sum + (item ? item.staff_price * qty : 0);
    }, 0);
  }, [cart, shop]);

  const cartCount = Object.values(cart).reduce((n, q) => n + q, 0);

  /**
   * Everything still worth putting on a shelf.
   *
   * A product whose every option is gone is dropped here, at the source, so
   * the grid, the tab counts and the search results all agree — a tab
   * promising 59 beside 51 cards is a tab that looks broken. A product with
   * one colour left keeps its card; that one chip is struck through, which
   * is worth knowing.
   */
  const sellable = useMemo(() => {
    if (!shop) return [];
    const hasStock = new Set(
      shop.items.filter((i) => i.in_stock && i.left !== 0).map((i) => i.product_slug),
    );
    return shop.items.filter((i) => hasStock.has(i.product_slug));
  }, [shop]);

  /**
   * The brands in this round, with how many products each has.
   *
   * Counted in products rather than variants, like the tabs, so a brand
   * offering one toothbrush in five colours is one entry of one.
   */
  // The tabs are brands now and the select is categories — the two swapped
  // places. A staff round is shopped brand-first ("what Dentiste is in it?")
  // far more than category-first, and this round carries eight brands, which
  // is a row rather than the thirty the select was defending against.

  // Narrowed before the tabs are built, so their counts are counts of what
  // the grid will actually show. A tab saying 68 under a category with three
  // of them is a tab nobody can trust.
  const inCategory = useMemo(
    () => (category === "all" ? sellable : sellable.filter((i) => (i.category || "other") === category)),
    [sellable, category],
  );

  const brands = useMemo(() => {
    const by = new Map<string, Set<string>>();
    for (const item of inCategory) {
      if (!item.brand) continue;
      if (!by.has(item.brand)) by.set(item.brand, new Set());
      by.get(item.brand)!.add(item.product_slug);
    }
    return [...by.entries()]
      .map(([name, slugs]) => ({ name, count: slugs.size }))
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [inCategory]);

  /** For the select. Counted across the whole round, not inside the brand
   *  tab that happens to be open — otherwise choosing a category could only
   *  ever narrow, never move you somewhere with more in it. */
  const categoryOptions = useMemo(() => {
    if (!shop) return [];
    const by = new Map<string, Set<string>>();
    for (const item of sellable) {
      const key = item.category || "other";
      if (!by.has(key)) by.set(key, new Set());
      by.get(key)!.add(item.product_slug);
    }
    return [...by.entries()]
      .map(([key, slugs]) => ({ key, label: CATEGORY_TH.get(key) ?? "อื่นๆ", count: slugs.size }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [shop, sellable]);

  /** Category order inside the grid, so like still sits beside like however
   *  the tabs above were set. */
  const ordered = useMemo(() => {
    const picked = brand === "all" ? inCategory : inCategory.filter((i) => i.brand === brand);
    return [...picked].sort(
      (a, b) =>
        (a.category || "other").localeCompare(b.category || "other", "th") ||
        a.name.localeCompare(b.name, "th"),
    );
  }, [inCategory, brand]);

  // Searching crosses the tabs. Somebody typing a product name is asking the
  // whole round, not the tab they happen to be standing in — so a hit in
  // another category still comes back, and the tabs step aside while it does.
  const q = query.trim().toLowerCase();
  const matches = (item: StaffShopVariant) =>
    !q || item.name.toLowerCase().includes(q) || item.brand.toLowerCase().includes(q);

  /**
   * One grid, never a stack of titled sections.
   *
   * The tabs are the headings — printing them again over each block said
   * the same word twice and broke a wall of products into three short walls
   * with gaps between them. "ทั้งหมด" is everything in one run, in category
   * order so like still sits beside like without anything announcing it.
   */
  const shownItems = useMemo(() => {
    // Searching asks the whole round, so it starts from everything sellable
    // rather than from whatever the tab and the select have narrowed it to.
    if (q) return sellable.filter(matches);
    return ordered;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matches` closes over q, which is in the deps
  }, [ordered, sellable, q]);

  /**
   * One card per product, not per variant.
   *
   * The price list is keyed by variant because that is what is bought, but
   * three colours of the same toothbrush were three identical cards in a
   * row with one word different. Grouped here, in the order the variants
   * first appeared, so the shelf still reads the way the tabs left it.
   */
  const shownProducts = useMemo(() => {
    const by = new Map<string, { slug: string; name: string; brand: string; variants: StaffShopVariant[] }>();
    for (const item of shownItems) {
      const row = by.get(item.product_slug);
      if (row) row.variants.push(item);
      else by.set(item.product_slug, { slug: item.product_slug, name: item.name, brand: item.brand, variants: [item] });
    }
    return [...by.values()];
  }, [shownItems]);

  const shownCount = shownProducts.length;

  /**
   * Whether "ไม่เกิน N ชิ้นต่อสินค้า" is the whole truth.
   *
   * The round carries one number and every product may override it. On the
   * open round 189 of 387 items do, which makes the flat sentence a promise
   * the shop then breaks with a grey button. Said once, under the heading,
   * rather than on every card: the cards carry their own number where it
   * differs.
   */
  const someItemsLimitedLower = useMemo(() => {
    const round = shop?.round.max_per_item ?? null;
    if (round === null) return false;
    return (shop?.items ?? []).some(
      (i) => i.per_person_limit !== null && i.per_person_limit < round,
    );
  }, [shop]);

  /**
   * Which option each card is showing.
   *
   * Only holds what somebody has chosen; a card nobody has touched falls
   * back to its first option that is actually buyable, so a product whose
   * first colour is sold out does not open on a dead card.
   */
  const [chosenVariant, setChosenVariant] = useState<Record<string, string>>({});
  /** The card that just took something, so it can say so for a moment. */
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function variantOf(product: { slug: string; variants: StaffShopVariant[] }): StaffShopVariant {
    const picked = chosenVariant[product.slug];
    const found = picked && product.variants.find((v) => v.variant_id === picked);
    if (found) return found;
    return (
      product.variants.find((v) => v.in_stock && v.left !== 0) ??
      product.variants[0]
    );
  }

  function setQty(item: StaffShopVariant, qty: number) {
    // Clamped against both ceilings here as well as in the database, so the
    // plus button stops rather than the checkout refusing after the fact.
    const ceilings = [
      item.per_person_limit === null ? Infinity : item.per_person_limit - item.mine,
      item.left === null ? Infinity : item.left,
    ];
    const max = Math.max(0, Math.min(...ceilings));
    const next = Math.max(0, Math.min(qty, max));
    setCart((cur) => {
      const copy = { ...cur };
      if (next === 0) delete copy[item.variant_id];
      else copy[item.variant_id] = next;
      return copy;
    });
  }

  /**
   * Picking one up.
   *
   * setQty does the clamping, so this cannot push past a per-person limit
   * or past what the shelf has; the tick is only so the card says something
   * happened — on a grid this dense the cart is far from the thumb that
   * pressed the button.
   */
  function add(item: StaffShopVariant, from?: HTMLElement) {
    setQty(item, (cart[item.variant_id] ?? 0) + 1);
    setJustAdded(item.variant_id);
    if (from) flyToCart(from, "staff");
    window.setTimeout(() => setJustAdded((cur) => (cur === item.variant_id ? null : cur)), 1200);
  }

  async function checkout() {
    if (!shop) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: Object.entries(cart).map(([variant_id, qty]) => ({ variant_id, qty })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "เริ่มการชำระเงินไม่สำเร็จ");
      // 2C2P's own page. Replaced rather than opened so the back button
      // comes back here instead of to a spent payment page.
      //
      // `busy` is deliberately left on: the navigation can take a few
      // seconds on a phone, and a button that comes back to life before the
      // page changes invites a second press and a second order.
      window.location.href = json.webPaymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เริ่มการชำระเงินไม่สำเร็จ");
      setBusy(false);
      void load();
    }
  }

  /**
   * Cancel an unpaid order and put what was in it back in the cart.
   *
   * Somebody who opened the payment page, changed their mind and wants one
   * more thing had no way through: a pending order blocks a new one, and
   * cancelling emptied the basket, so the only route was to find all of it
   * again. This is the same cancel — the allowance and the quota go back —
   * with the lines handed to the cart on the way out.
   *
   * Quantities are clamped against the numbers from after the cancel, not
   * the ones on screen: the shelf may have moved while the order sat there,
   * and a restored cart that cannot be checked out is a worse trap than the
   * one it replaced.
   */
  async function editPending(order: PendingOrder) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ยกเลิกไม่สำเร็จ");

      const fresh = await load();
      if (fresh?.state !== "shop") return;

      const restored: Record<string, number> = {};
      let trimmed = false;
      for (const line of order.lines) {
        const item = fresh.items.find((i) => i.variant_id === line.variant_id);
        if (!item) {
          trimmed = true;
          continue;
        }
        const ceilings = [
          item.per_person_limit === null ? Infinity : item.per_person_limit - item.mine,
          item.left === null ? Infinity : item.left,
        ];
        const qty = Math.max(0, Math.min(Number(line.qty), ...ceilings));
        if (qty > 0) restored[item.variant_id] = qty;
        if (qty !== Number(line.qty)) trimmed = true;
      }
      setCart(restored);
      setCartOpen(Object.keys(restored).length > 0);
      if (trimmed) {
        setError("นำรายการกลับมาในตะกร้าแล้ว แต่บางรายการมีไม่พอเท่าเดิม กรุณาตรวจจำนวนอีกครั้ง");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending(id: string) {
    if (!confirm("ยกเลิกคำสั่งซื้อที่รอชำระเงิน? วงเงินและสินค้าจะถูกคืนให้")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ยกเลิกไม่สำเร็จ");
      setCart({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">
          {/* The shop's own gradient, the one on its buttons. Still a span
              rather than the heading itself: background-clip: text makes the
              box it sits on transparent, and the h1 is what the page layout
              measures. */}
          <span className="brand-text-gradient">ร้านพนักงาน</span>
        </h1>
        {data.state === "shop" && (
          <p className="mt-1 text-[13px] text-slate-500">
            {data.round.name} · <Countdown to={data.round.ends_at} />
          </p>
        )}
      </header>

      {justPaid && (
        <div className="mb-5 rounded-xl2 bg-emerald-50 p-4 text-[13px] text-emerald-800">
          <p className="font-semibold">ได้รับการชำระเงินแล้ว กำลังยืนยันกับธนาคาร</p>
          <p className="mt-1">
            ใบเสร็จจะส่งไปที่อีเมลของคุณ และคำสั่งซื้อจะขึ้นในหน้าโปรไฟล์ภายในไม่กี่นาที
            ถ้ายังไม่ขึ้น ลองรีเฟรชอีกครั้ง
          </p>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl2 bg-rose-50 p-3 text-[13px] text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {data.state === "loading" && <p className="text-[13px] text-slate-400">กำลังโหลด…</p>}

      {data.state === "unavailable" && (
        <div className="rounded-xl2 bg-white p-6 ring-1 ring-surface-line">
          <p className="text-[14px] text-slate-600">
            ร้านพนักงานยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้งภายหลัง
          </p>
        </div>
      )}

      {data.state === "closed" && (
        <div className="rounded-xl2 bg-white p-6 ring-1 ring-surface-line">
          <p className="text-[15px] font-semibold text-brand-ink">ยังไม่มีรอบการซื้อที่เปิดอยู่</p>
          <p className="mt-1 text-[13px] text-slate-600">
            {data.nextRound
              ? `รอบถัดไป "${data.nextRound.name}" เริ่ม ${new Date(data.nextRound.starts_at).toLocaleString("th-TH", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
              : "ฝ่ายบุคคลจะแจ้งเมื่อเปิดรอบถัดไป"}
          </p>
        </div>
      )}

      {data.state === "signin" && (
        // Reached only by somebody whose session expired between the page
        // loading and this call — the page itself sends a signed-out visitor
        // to the login screen before any of this renders.
        <div className="rounded-xl2 bg-white p-6 ring-1 ring-surface-line">
          <p className="text-[15px] font-semibold text-brand-ink">กรุณาเข้าสู่ระบบ</p>
          <p className="mt-2 text-[13px] text-slate-600">
            เข้าสู่ระบบด้วยบัญชี Smoothlife ของคุณก่อน แล้วยืนยันอีเมลบริษัทเพื่อดูราคาพนักงาน
          </p>
          <Link
            href="/account/login?returnTo=%2Fstaff"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-brand-800 px-6 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      )}

      {data.state === "verify" && (
        <VerifyPanel
          round={data.round}
          suggestEmail={data.suggestEmail}
          proofDays={data.proofDays}
          onVerified={load}
        />
      )}

      {shop && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
          <div className="min-w-0">
            {shop.pending && (
              <div className="mb-5 hidden rounded-xl2 bg-amber-50 p-4 lg:block">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-amber-900">
                  <Clock className="h-4 w-4" aria-hidden />
                  มีคำสั่งซื้อรอชำระเงิน · <Countdown to={shop.pending.expires_at} />
                </p>
                <p className="mt-1 text-[13px] text-amber-800">
                  {shop.pending.lines.length} รายการ รวม {baht(shop.pending.subtotal_thb)} บาท
                  {shop.pending.payment_url
                    ? " — ชำระให้เสร็จ หรือกลับมาแก้ไขรายการก็ได้"
                    : " — ลิงก์ชำระเงินเดิมหมดอายุแล้ว กดแก้ไขรายการเพื่อสั่งใหม่"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* The way back to the page they walked away from. It was
                      only on the bar at the bottom of a phone, which is the
                      one place somebody scrolled to the top will not look. */}
                  {shop.pending.payment_url && (
                    <a
                      href={shop.pending.payment_url}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                    >
                      ชำระเงินต่อ
                    </a>
                  )}
                  {/* Changing your mind is the ordinary case, not an error:
                      the order is cancelled and what was in it comes back to
                      the cart, so adding one more thing does not mean
                      finding all of it again. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => editPending(shop.pending!)}
                    isDisabled={busy}
                  >
                    แก้ไขรายการ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => cancelPending(shop.pending!.id)}
                    isDisabled={busy}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </div>
            )}

            {!shop.canOrder && !shop.pending && (
              <div className="mb-5 rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
                <p className="text-[14px] font-semibold text-brand-ink">
                  คุณใช้สิทธิ์ของรอบนี้แล้ว
                </p>
                <p className="mt-1 text-[13px] text-slate-600">
                  รอบนี้ซื้อได้ {shop.round.max_orders ?? 1} ครั้งต่อคน — ดูคำสั่งซื้อได้ที่{" "}
                  <Link href="/account/orders" className="font-semibold text-brand-800 underline">
                    หน้าคำสั่งซื้อ
                  </Link>
                </p>
              </div>
            )}

            {/* The allowance and the round's rules, together, where they
                can be read before anything is chosen. On a phone this is the
                only place they appear until the bottom bar lights up —
                finding out at checkout that a cart was never allowed is
                finding out too late. */}
            {shop.canOrder && !shop.pending && (
              // White with a ring, like its own desktop twin in the sidebar
              // below. It used to be bg-surface-soft (#edf4f1), which read as
              // a box while the page behind it was white — and stopped the
              // day the page grew an aurora, because the wash lands on very
              // nearly that same colour. A panel whose background matches
              // what is behind it is not a panel.
              <div className="mb-5 rounded-xl2 bg-white p-3 ring-1 ring-surface-line lg:hidden">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-medium text-slate-500">วงเงินที่เหลือ</span>
                  <span className="text-[17px] font-bold">
                    <span className="brand-text-gradient">฿{baht(shop.standing.left_thb)}</span>
                    <span className="ml-1 text-[11px] font-normal text-slate-400">
                      จาก ฿{baht(shop.standing.cap_thb)}
                    </span>
                  </span>
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{
                      width: `${Math.min(100, Math.round(((shop.standing.cap_thb - shop.standing.left_thb) / shop.standing.cap_thb) * 100))}%`,
                    }}
                  />
                </div>
                {(shop.round.max_orders || shop.round.max_per_item) && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    {[
                      shop.round.max_orders ? `ซื้อได้ ${shop.round.max_orders} ครั้งต่อรอบ` : null,
                      shop.round.max_per_item
                        ? `ไม่เกิน ${shop.round.max_per_item} ชิ้นต่อสินค้า${
                            someItemsLimitedLower ? " (บางรายการน้อยกว่านี้)" : ""
                          }`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            )}

            {shop.canOrder && !shop.pending && (shop.round.max_orders || shop.round.max_per_item) && (
              <p className="mb-5 hidden text-[12px] font-medium text-slate-600 lg:block">
                {[
                  shop.round.max_orders ? `ซื้อได้ ${shop.round.max_orders} ครั้งต่อรอบ` : null,
                  shop.round.max_per_item
                    ? `ไม่เกิน ${shop.round.max_per_item} ชิ้นต่อสินค้า${
                        someItemsLimitedLower ? " (บางรายการน้อยกว่านี้)" : ""
                      }`
                    : null,
                  `รวมไม่เกิน ฿${baht(shop.standing.cap_thb)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

            {shop.items.length === 0 && (
              <p className="rounded-xl2 bg-white p-6 text-[13px] text-slate-500 ring-1 ring-surface-line">
                รอบนี้ยังไม่มีสินค้าให้เลือก
              </p>
            )}
            {shop.items.length > 0 && sellable.length === 0 && (
              <p className="rounded-xl2 bg-white p-6 text-[13px] text-slate-500 ring-1 ring-surface-line">
                สินค้าในรอบนี้หมดทั้งหมดแล้ว
              </p>
            )}
            {sellable.length > 0 && shownProducts.length === 0 && !q && (
              <p className="rounded-xl2 bg-white p-6 text-[13px] text-slate-500 ring-1 ring-surface-line">
                ไม่มีสินค้าที่ตรงกับตัวกรองนี้ —{" "}
                <button
                  type="button"
                  onClick={() => {
                    setBrand("all");
                    setCategory("all");
                  }}
                  className="font-semibold text-brand-800 underline underline-offset-2"
                >
                  ล้างตัวกรอง
                </button>
              </p>
            )}

            {sellable.length > 0 && (
              // Pinned under the header on a phone, so the search box and the
              // tabs are still there twenty products down — the two controls
              // that decide what is on screen were the first things to scroll
              // off it. top-(--app-header-h) is the height the header reports
              // as it hides and comes back, so this follows it rather than
              // guessing a number (see Header.tsx).
              // A card, like the allowance card beside it, rather than a
              // white band bleeding to both edges. The bleed was invisible
              // while the page behind it was white; against the aurora it
              // reads as a square-cornered slab sitting on a rounded page.
              //
              // Still sticky, and now offset from the header by the same
              // 1rem the sidebar card uses — a rounded card jammed against
              // the bar above it looks like it failed to stop.
              // brand-50 with a brand-200 edge: the same pair the staff
              // entry in the header wears. This card and that button are the
              // two things on screen that belong to the staff round rather
              // than to the shop, and now they say so in the same colour.
              //
              // /95 rather than flat, because it is sticky over a moving
              // grid — the blur underneath needs something to blur.
              <div className="scrollbar-none sticky top-[calc(var(--app-header-h,0px)+1rem)] z-30 mb-5 space-y-3 rounded-xl2 bg-brand-50/95 p-3 ring-1 ring-brand-200 backdrop-blur-sm transition-[top] duration-300">
                {/* Search first, because it is the shortest route to one
                    known product, and the tabs are for browsing. */}
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="ค้นหาสินค้าหรือแบรนด์ในรอบนี้"
                      aria-label="ค้นหาสินค้าในรอบนี้"
                      className="h-11 w-full rounded-xl2 border border-slate-200 bg-white pl-9 pr-3 text-[14px] text-brand-ink placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                    />
                  </div>
                  {/* The category, as a select. It used to be the tab row
                      and the brands used to be here; they swapped. Six
                      categories fit in a menu and are the thing people reach
                      for second — the brand is what they come in asking for.
                      It narrows the tabs' counts as well as the grid, so the
                      two always agree. */}
                  {categoryOptions.length > 1 && (
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        // Back to ทุกแบรนด์: the brand tab that was open may
                        // have nothing in the new category, and a grid that
                        // empties itself on a press meant to narrow it reads
                        // as a broken filter.
                        setBrand("all");
                      }}
                      aria-label="กรองตามหมวดสินค้า"
                      className={`h-11 max-w-[45%] shrink-0 rounded-xl2 border bg-white px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 ${
                        category === "all"
                          ? "border-slate-200 text-slate-600"
                          : "border-brand-800 font-semibold text-brand-800"
                      }`}
                    >
                      <option value="all">ทุกหมวด ({categoryOptions.length})</option>
                      {categoryOptions.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label} ({c.count})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* One scrolling row rather than a wrapped block: six
                    categories at 375px wrap into three lines of chips, which
                    reads as a paragraph of buttons. */}
                {!q && brands.length > 1 && (
                  <div
                    role="tablist"
                    aria-label="แบรนด์"
                    // No -mx bleed any more: inside a rounded card an
                    // overflow-x-auto child that runs to the edge draws its
                    // square corners straight through the curve.
                    className="scrollbar-none flex gap-1 overflow-x-auto border-b border-surface-line"
                  >
                    {/* Counted in products, because products are what the
                        grid shows: three colours of one toothbrush are one
                        card, and a tab promising 387 next to 240 cards is a
                        tab that looks broken. */}
                    {(
                      [["all", "ทั้งหมด", new Set(inCategory.map((i) => i.product_slug)).size]] as [
                        string,
                        string,
                        number,
                      ][]
                    )
                      .concat(brands.map((b) => [b.name, b.name, b.count]))
                      .map(([key, label, count]) => (
                        <button
                          key={key}
                          role="tab"
                          aria-selected={brand === key}
                          onClick={() => setBrand(key)}
                          // h-11: these are how the round is filtered, and a
                          // 36px target is below what a thumb is asked to find.
                          className={`flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 ${
                            brand === key
                              ? "border-brand-action font-bold text-brand-ink"
                              : "border-transparent font-medium text-slate-500 hover:text-brand-ink"
                          }`}
                        >
                          {label}
                          <span className="ml-1 text-xs text-slate-400">({count})</span>
                        </button>
                      ))}
                  </div>
                )}

                {q && (
                  <p className="text-[12px] text-slate-500">
                    พบ {shownCount} รายการสำหรับ “{query.trim()}”
                    {shownCount === 0 && " — ลองค้นด้วยชื่อแบรนด์ดู"}
                  </p>
                )}
              </div>
            )}

            {/* One grid for whatever the tabs and the search left. The
                category headings are gone: the tabs already say which
                shelf this is, and repeating it over each block turned one
                wall of products into three short ones with gaps. */}
            <section className="mb-7">
                {/* The shop's own card, with the round's price in it.
                    ProductCard itself cannot be reused — it quick-adds to the
                    ordinary cart and carries a wishlist heart, neither of
                    which belongs on a staff round — so this follows its
                    shape instead: square photo edge to edge, brand over
                    name, and the price with the struck-through retail
                    beside it. No discount chip: see the note on the price. */}
                {/* The shop's own grid shape, stopping at four. It used to
                    reach five, on the reasoning that these cards carry no
                    rating and no sold count and so could take the ~170px that
                    left them once the allowance rail had its 320px. What that
                    missed is the colour and size chips: a toothbrush in five
                    colours wrapped to three rows of chips at that width, so
                    the row of cards was as tall as the photos again and the
                    saving was spent on the thing it was meant to buy. Four
                    across gives each card ~230px and most of those chip rows
                    collapse to one or two.

                    Plain breakpoints rather than a container query: the main
                    card uses @container because it is dropped into shelves
                    of wildly different widths, and this grid has one home. */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
                  {shownProducts.map((product) => {
                    const item = variantOf(product);
                    const qty = cart[item.variant_id] ?? 0;
                    // Out of stock in Shopify counts as sold out even when
                    // the round's quota still has room: the warehouse has
                    // none, so the plus button would only lead to a refusal
                    // at checkout.
                    const soldOut = item.left === 0 || !item.in_stock;
                    const atLimit =
                      item.per_person_limit !== null && item.mine + qty >= item.per_person_limit;
                    // Why the plus is grey, in the one place somebody looking
                    // at a grey plus is already looking. A product whose limit
                    // matches the round's says nothing — the heading already
                    // did — so the line only appears when it is news.
                    const limitLine = atLimit
                      ? `ครบ ${item.per_person_limit} ชิ้นต่อคนแล้ว`
                      : item.per_person_limit !== null &&
                          item.per_person_limit !== shop.round.max_per_item
                        ? `ไม่เกิน ${item.per_person_limit} ชิ้น`
                        : null;
                    // Only worth showing options when there is a choice, and
                    // only when they have names: a product with one variant
                    // calls it "Default Title", which is not an option, it
                    // is the absence of one.
                    const options =
                      product.variants.length > 1 ? product.variants.filter((v) => v.size) : [];
                    const inCart = product.variants.reduce(
                      (n, v) => n + (cart[v.variant_id] ?? 0),
                      0,
                    );
                    return (
                      // Two boxes, because the ring has to live outside the
                      // one that clips: the card crops its own photo and its
                      // own corners with overflow-hidden, which would cut the
                      // lights off at exactly the edge they trace. The rim is
                      // a pixel and a half of padding on a box around it —
                      // the same arrangement ProductCard uses, and the same
                      // radii, so the two cards wear it identically.
                      <div
                        key={product.slug}
                        className="group relative h-full rounded-[17.5px]"
                        style={{ padding: RIM }}
                      >
                        <HaloRing radius="rounded-[17.5px]" />
                        <article className="relative flex h-full flex-col overflow-hidden rounded-[16px] bg-white shadow-product transition-shadow duration-200 hover:shadow-productHover">
                        <div className="relative aspect-square overflow-hidden bg-white">
                          {item.image && (
                            /* Square crops and a real srcset, the same as the
                               storefront card — and for the same reason: with
                               images.unoptimized on, next/image ships one
                               source and drops `sizes`, so a 560px file was
                               being decoded for a slot drawn at 163px. A
                               round holds 387 products; that is how a phone
                               runs out of memory scrolling a staff sale.
                               See lib/shopify-image. */
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={shopifySquare(item.image, 480)}
                              srcSet={shopifySquareSrcSet(item.image)}
                              sizes="(max-width: 768px) 50vw, (max-width: 1536px) 25vw, 20vw"
                              alt={product.name}
                              loading="lazy"
                              decoding="async"
                              className={`absolute inset-0 h-full w-full object-cover ${soldOut ? "opacity-60 grayscale" : ""}`}
                            />
                          )}
                          {soldOut && (
                            <div className="absolute inset-0 grid place-items-center bg-black/10">
                              <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-bold text-white">
                                สินค้าหมด
                              </span>
                            </div>
                          )}
                          {/* What is in the cart across every option of
                              this product. The options themselves no longer
                              carry their own counts — a row of chips each
                              with a number on it reads as a row of prices,
                              and the one number worth seeing from across the
                              grid is "something from this card is in the
                              cart". The breakdown is in the cart. */}
                          {inCart > 0 && (
                            <span
                              key={inCart}
                              className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand-800 px-1.5 text-[11px] font-bold text-white motion-safe:animate-pop"
                            >
                              {inCart}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-1.5 p-3">
                          <span translate="no" className="truncate text-[13px] font-bold uppercase text-brand-ink">
                            {product.brand}
                          </span>
                          <h3
                            translate="no"
                            className="line-clamp-2 min-h-9 text-[13px] font-medium leading-snug text-slate-500"
                          >
                            {product.name}
                          </h3>

                          {options.length > 0 && (
                            <div className="flex flex-wrap gap-1" role="group" aria-label={`ตัวเลือกของ ${product.name}`}>
                              {options.map((v) => {
                                const on = v.variant_id === item.variant_id;
                                const gone = v.left === 0 || !v.in_stock;
                                return (
                                  <button
                                    key={v.variant_id}
                                    type="button"
                                    onClick={() =>
                                      setChosenVariant((cur) => ({ ...cur, [product.slug]: v.variant_id }))
                                    }
                                    aria-pressed={on}
                                    title={gone ? `${v.size} — สินค้าหมด` : v.size}
                                    className={`rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                                      on
                                        ? "bg-brand-800 text-white"
                                        : gone
                                          ? "bg-slate-50 text-slate-400 line-through"
                                          : "bg-surface-soft text-slate-600 hover:text-brand-800"
                                    }`}
                                  >
                                    {v.size}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="mt-auto pr-12 pt-1.5">
                            <span className="block text-[17px] font-bold tabular-nums text-brand-800">
                              {formatTHB(item.staff_price)}
                            </span>
                            {item.regular_price > item.staff_price && (
                              <span className="flex flex-wrap items-center gap-1.5">
                                {/* The retail price, struck through — and
                                    not the percentage off it. Staff prices
                                    are set per product and the figure moves
                                    with every reprice; a chip reading -63%
                                    beside one product and -60% beside the
                                    next invites the question of why, which
                                    is a conversation about margins nobody
                                    wanted to have on a shopping page. */}
                                <span className="text-[11px] tabular-nums text-slate-500 line-through">
                                  {formatTHB(item.regular_price)}
                                </span>
                              </span>
                            )}

                            {/* The per-person limit was taken off every card
                                on the grounds that it was the same number on
                                all of them and was already said once under
                                the heading. That stopped being true the day
                                the round got per-product limits: 189 of the
                                387 items are not the round's 6, and a card
                                that says nothing leaves a grey button with no
                                reason next to a heading promising six.
                                
                                So it is back, but only where it carries
                                information — when this product allows fewer
                                than the round does, and when the number has
                                been reached. */}
                            {(soldOut || item.left !== null || item.mine > 0 || limitLine) && (
                              <p
                                className={`mt-1 text-[11px] ${
                                  atLimit && !soldOut ? "font-medium text-brand-800" : "text-slate-500"
                                }`}
                              >
                                {soldOut
                                  ? "สินค้าหมด"
                                  : [
                                      limitLine,
                                      item.left !== null ? `เหลือ ${item.left} ชิ้น` : null,
                                      item.mine > 0 ? `สั่งไปแล้ว ${item.mine}` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                              </p>
                            )}

                            {/* A round plus in the bottom corner, the way
                                the shop's own card quick-adds. It sits on
                                the price row rather than under it: the two
                                things a card is read for are what it costs
                                and how to take one, and a full-width button
                                under the price made every card taller for a
                                word.

                                A stepper used to live here, which asked
                                somebody to settle on a number before they
                                had seen a total. Quantities are counted in
                                the cart now, beside the running total and
                                the allowance they spend. */}
                            {!soldOut && !shop.pending && shop.canOrder && (() => {
                              const full = atLimit || (item.left !== null && qty >= item.left);
                              const added = justAdded === item.variant_id;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => add(item, e.currentTarget)}
                                  disabled={full}
                                  // "ครบจำนวนแล้ว" was true but useless: the
                                  // question a grey button raises is which
                                  // number, and there are two it could be.
                                  title={
                                    !full
                                      ? "หยิบใส่ตะกร้า"
                                      : atLimit
                                        ? `ครบ ${item.per_person_limit} ชิ้นต่อคนแล้ว`
                                        : "เหลือเท่าที่หยิบไว้แล้ว"
                                  }
                                  aria-label={
                                    full
                                      ? `${product.name}${item.size ? ` ${item.size}` : ""} ${
                                          atLimit
                                            ? `ครบ ${item.per_person_limit} ชิ้นต่อคนแล้ว`
                                            : "เหลือเท่าที่หยิบไว้แล้ว"
                                        }`
                                      : `หยิบ ${product.name}${item.size ? ` ${item.size}` : ""} ใส่ตะกร้า`
                                  }
                                  // The shop's own call-to-action colour,
                                  // the one on ดำเนินการชำระเงิน. The
                                  // confirmation stays flat: "added" is a
                                  // state, and a state that keeps moving
                                  // reads as still busy.
                                  className={`absolute bottom-3 right-3 grid size-10 place-items-center rounded-full text-white shadow-card transition-[filter,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2 ${
                                    added ? "bg-brand-emerald" : "bg-brand-gradient hover:brightness-105"
                                  } disabled:cursor-not-allowed disabled:bg-slate-200 disabled:bg-none disabled:text-slate-500 disabled:shadow-none`}
                                >
                                  {added ? (
                                    <Check className="h-5 w-5" strokeWidth={2.75} aria-hidden />
                                  ) : (
                                    <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                                  )}
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
            </section>
          </div>

          {/* The allowance, the cart and the button. Sticky on desktop only —
              on a phone it sits under the products, where the thumb is. */}
          {/* Desktop only. On a phone the same two things live where a
              thumb is: the allowance on a strip under the heading, and the
              cart on a bar fixed to the bottom of the screen. A column of
              this below eighty products is a column nobody scrolls to.

              It sticks below the header's real height rather than at a
              measured 96px: the header is taller than that with the ticker
              strip showing, so a fixed offset put the allowance underneath
              it every time somebody scrolled back up. --app-header-h is what
              the header reports as it hides and returns (Header.tsx). */}
          <aside className="hidden lg:sticky lg:top-[calc(var(--app-header-h,0px)+1rem)] lg:block lg:space-y-3">
            <div className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                วงเงินของคุณในรอบนี้
              </p>
              <p className="mt-1 text-2xl font-extrabold">
                <span className="brand-text-gradient">฿{baht(shop.standing.left_thb)}</span>
                <span className="ml-1 text-[12px] font-normal text-slate-500">
                  จาก ฿{baht(shop.standing.cap_thb)}
                </span>
              </p>
              {/* A number plus a bar, because "เหลือ 500 จาก 2,000" and a
                  quarter-full bar answer two different glances. */}
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
                role="img"
                aria-label={`ใช้ไปแล้ว ${baht(shop.standing.cap_thb - shop.standing.left_thb)} บาท จาก ${baht(shop.standing.cap_thb)} บาท`}
              >
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{
                    width: `${Math.min(100, Math.round(((shop.standing.cap_thb - shop.standing.left_thb) / shop.standing.cap_thb) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                <BadgeCheck className="h-3 w-3" aria-hidden />
                ยืนยันแล้วด้วย {shop.standing.staff_email}
              </p>
            </div>

            {!shop.pending && shop.canOrder && (
              <div data-cart-target="staff" className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
                <p className="text-[14px] font-bold text-brand-ink">ตะกร้าพนักงาน</p>
                {Object.keys(cart).length === 0 ? (
                  <p className="mt-2 text-[12px] text-slate-400">ยังไม่ได้เลือกสินค้า</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {Object.entries(cart).map(([variantId, qty]) => {
                      const item = shop.items.find((i) => i.variant_id === variantId);
                      if (!item) return null;
                      const full =
                        (item.per_person_limit !== null &&
                          item.mine + qty >= item.per_person_limit) ||
                        (item.left !== null && qty >= item.left);
                      return (
                        <li key={variantId} className="flex items-center gap-2 text-[12px]">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-slate-600">{item.name}</span>
                            {/* The option gets its own line rather than
                                trailing the name: it is the only thing
                                telling two lines of the same product apart,
                                and on a name long enough to truncate it was
                                the first thing cut. */}
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {item.size && (
                                <span className="rounded-full bg-surface-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                                  {item.size}
                                </span>
                              )}
                              <span className="font-mono text-[11px] text-slate-400">
                                {baht(item.staff_price)} × {qty}
                              </span>
                            </span>
                          </span>
                          {/* The card hands things over; the counting
                              happens here, next to the total it changes. */}
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => setQty(item, qty - 1)}
                              aria-label={`ลดจำนวน ${item.name}${item.size ? ` ${item.size}` : ""}`}
                              className="grid size-7 place-items-center rounded-full bg-surface-soft text-slate-600 transition-colors hover:text-brand-800"
                            >
                              <Minus className="h-3 w-3" aria-hidden />
                            </button>
                            <span className="w-4 text-center font-bold tabular-nums text-brand-ink">
                              {qty}
                            </span>
                            <button
                              onClick={() => setQty(item, qty + 1)}
                              disabled={full}
                              aria-label={`เพิ่มจำนวน ${item.name}${item.size ? ` ${item.size}` : ""}`}
                              className="grid size-7 place-items-center rounded-full bg-surface-soft text-slate-600 transition-colors hover:text-brand-800 disabled:opacity-35"
                            >
                              <Plus className="h-3 w-3" aria-hidden />
                            </button>
                          </span>
                          <span className="w-14 shrink-0 text-right font-mono text-slate-700">
                            {baht(item.staff_price * qty)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-3 flex items-baseline justify-between border-t border-surface-line pt-3 text-[14px] font-bold text-brand-ink">
                  <span>รวม</span>
                  <span className="text-[18px] font-extrabold">฿{baht(subtotal)}</span>
                </div>

                {subtotal > shop.standing.left_thb && (
                  <p className="mt-2 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700">
                    เกินวงเงินที่เหลือ ฿{baht(subtotal - shop.standing.left_thb)} — ลดจำนวนลงก่อน
                  </p>
                )}

                {shop.shipTo ? (
                  <p className="mt-3 text-[11px] text-slate-400">ส่งไปที่ {shop.shipTo.summary}</p>
                ) : (
                  <p className="mt-3 text-[12px] text-amber-700">
                    ยังไม่มีที่อยู่จัดส่ง —{" "}
                    <Link href="/account/addresses" className="font-semibold underline">
                      เพิ่มที่อยู่ก่อนสั่งซื้อ
                    </Link>
                  </p>
                )}

                <button
                  type="button"
                  onClick={checkout}
                  disabled={
                    busy ||
                    Object.keys(cart).length === 0 ||
                    subtotal > shop.standing.left_thb ||
                    !shop.shipTo ||
                    !shop.shipTo.hasPhone
                  }
                  className={`${CHECKOUT_BUTTON} mt-3 w-full`}
                >
                  {busy ? "กำลังเปิดหน้าชำระเงิน…" : "ไปชำระเงิน"}
                </button>
                <p className="mt-2 text-[11px] text-slate-400">
                  ชำระเงินแยกจากตะกร้าปกติ · มีเวลาชำระ {shop.round.payment_window_min ?? 30} นาที
                  หลังกดปุ่มนี้ ถ้าไม่ชำระ วงเงินจะคืนให้อัตโนมัติ
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
      {/* The staff cart, on the strip the site's own tab bar used to hold.
          That bar's basket badge counts the ordinary cart, so the two sat
          on screen together showing different numbers for "your cart" —
          see the /staff entry in Providers' BARE list.

          Phone only: on a desktop the same thing is the column on the right,
          already in view. */}
      {/* canOrder is false while an order is waiting to be paid — it counts
          against the one-per-round rule — so the bar has to ask for that
          case too, or the unpaid order loses the one place it could be
          acted on. */}
      {shop && (shop.canOrder || shop.pending) && (
        <>
          {/* The page needs somewhere to end that is not underneath the bar. */}
          <div className="h-24 lg:hidden" aria-hidden />

          <div
            // The safe-area padding belongs to each sheet, not to this: with
            // it here the strip under the sheet took the wrapper's colour,
            // which is now none at all, and a notched phone showed the page
            // scrolling through the gap below the bar.
            className={`fixed inset-x-0 bottom-0 z-90 lg:hidden ${
              // Both states are sheets with a shadow under them; the
              // colour is the sheet's, not the bar's.
              shop.pending
                ? "shadow-[0_-8px_24px_rgba(15,23,42,.12)]"
                : "shadow-[0_-8px_24px_rgba(15,23,42,.28)]"
            }`}
          >
            {/* Opened from the bar, closed by choosing or by the handle.
                Capped at 45vh so the products stay visible behind it.

                Above the bar, not below it: both live in a box anchored to
                the bottom of the screen, so whatever is written last sits
                lowest — and a list that opens underneath the thing that
                opened it reads as a second bar. */}
            {cartOpen && cartCount > 0 && !shop.pending && (
              <div className="max-h-[45vh] overflow-y-auto rounded-t-2xl border-b border-slate-100 bg-white px-4 py-3">
                <ul className="space-y-2">
                  {Object.entries(cart).map(([variantId, qty]) => {
                    const item = shop.items.find((i) => i.variant_id === variantId);
                    if (!item) return null;
                    const full =
                      (item.per_person_limit !== null &&
                        item.mine + qty >= item.per_person_limit) ||
                      (item.left !== null && qty >= item.left);
                    return (
                      <li key={variantId} className="flex items-center gap-2 text-[13px]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-slate-700">{item.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {item.size && (
                              <span className="rounded-full bg-surface-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                                {item.size}
                              </span>
                            )}


                            <span className="text-[11px] text-slate-400">
                              ฿{baht(item.staff_price)} × {qty}
                            </span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => setQty(item, qty - 1)}
                            aria-label={`ลดจำนวน ${item.name}${item.size ? ` ${item.size}` : ""}`}
                            className="grid size-9 place-items-center rounded-full bg-surface-soft text-slate-600"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <span className="w-5 text-center font-semibold">{qty}</span>
                          <button
                            onClick={() => setQty(item, qty + 1)}
                            disabled={full}
                            aria-label={`เพิ่มจำนวน ${item.name}${item.size ? ` ${item.size}` : ""}`}
                            className="grid size-9 place-items-center rounded-full bg-surface-soft text-slate-600 disabled:opacity-35"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                        {/* What this line costs, which is the number the
                            total is made of. The phone's cart showed the
                            unit price and the count and left the
                            multiplication to the reader. */}
                        <span className="w-16 shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums text-brand-ink">
                          ฿{baht(item.staff_price * qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2 text-[13px] font-bold text-brand-ink">
                  <span>รวม {cartCount} ชิ้น</span>
                  <span className="font-mono text-[15px] tabular-nums">฿{baht(subtotal)}</span>
                </div>
                {!shop.shipTo ? (
                  <p className="mt-3 text-[12px] text-amber-700">
                    ยังไม่มีที่อยู่จัดส่ง —{" "}
                    <Link href="/account/addresses" className="font-semibold underline">
                      เพิ่มที่อยู่ก่อนสั่งซื้อ
                    </Link>
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-slate-400">ส่งไปที่ {shop.shipTo.summary}</p>
                )}
              </div>
            )}

            {shop.pending ? (
              // The whole unpaid order, on the bar.
              //
              // It used to be a card at the top of the page as well as a
              // line down here, which meant the one thing with a clock on it
              // was also the one thing you had to scroll up to act on. The
              // card stays on a desktop, where there is no bar.
              //
              // Three rows, each with one job: what is waiting and what it
              // comes to, the two ways forward, and the way out. They were
              // one row of three buttons, where the primary took most of the
              // width and squeezed "ยกเลิก" against the edge — a destructive
              // action pressed into the corner beside the one everybody is
              // aiming for.
              <div className="overflow-hidden rounded-t-2xl bg-amber-50 pb-[env(safe-area-inset-bottom)] motion-safe:animate-slideUp">
                <WindowStrip
                  to={shop.pending.expires_at}
                  windowMin={shop.round.payment_window_min ?? 30}
                />
                <div className="flex items-start justify-between gap-3 px-4 pt-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden />
                      รอชำระเงิน
                    </p>
                    <p className="mt-0.5 text-[15px] font-bold text-amber-900">
                      <Countdown to={shop.pending.expires_at} />
                    </p>
                  </div>
                  {/* Facing the clock across the bar, the way a receipt puts
                      the total opposite what it is for. */}
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-amber-700">
                      {shop.pending.lines.length} รายการ
                    </p>
                    <p className="text-[15px] font-bold tabular-nums text-amber-900">
                      ฿{baht(shop.pending.subtotal_thb)}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2 px-4">
                  {shop.pending.payment_url && (
                    <a
                      href={shop.pending.payment_url}
                      className="flex h-12 flex-1 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white transition-[filter] hover:brightness-105"
                    >
                      ชำระเงินต่อ
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => editPending(shop.pending!)}
                    disabled={busy}
                    className={`flex h-12 flex-1 items-center justify-center rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${
                      shop.pending.payment_url
                        ? "bg-white text-brand-800 ring-1 ring-amber-300 hover:ring-brand-800/40"
                        : "bg-brand-gradient text-white hover:brightness-105"
                    }`}
                  >
                    แก้ไขรายการ
                  </button>
                </div>

                {/* Out of the way of the thumb heading for the green one.
                    Full width and centred, it still sat directly under
                    ชำระเงินต่อ — a press aimed at the primary and landing an
                    inch low cancelled the order instead. It is short now,
                    pushed to the far side under แก้ไขรายการ, and behind a
                    hairline that says the row above has ended. */}
                <div className="mt-2 flex justify-end border-t border-amber-200/70 px-4 pt-1.5">
                  <button
                    type="button"
                    onClick={() => cancelPending(shop.pending!.id)}
                    disabled={busy}
                    className="h-9 rounded-full px-3 text-[12px] font-medium text-amber-800 underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    ยกเลิกคำสั่งซื้อ
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-3 bg-brand-ink px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:animate-slideUp ${
                  cartOpen && cartCount > 0 ? "" : "rounded-t-2xl"
                }`}
              >
                {/* The left half opens the cart. A total with no way to see
                    what is in it means scrolling the whole round back to
                    find the one line that is wrong. */}
                <button
                  type="button"
                  onClick={() => cartCount > 0 && setCartOpen((v) => !v)}
                  disabled={cartCount === 0}
                  aria-expanded={cartOpen}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
                >
                  <span
                    data-cart-target="staff"
                    className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/10"
                  >
                    <ShoppingCart className="h-4 w-4 text-white" aria-hidden />
                    {cartCount > 0 && (
                      // Keyed on the count so each change remounts the badge
                      // and replays the pop — the same trick the shop's own
                      // tab bar uses for its basket.
                      <span
                        key={cartCount}
                        className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-white motion-safe:animate-pop"
                      >
                        {cartCount}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold leading-tight text-white">
                      ฿{baht(subtotal)}
                    </span>
                    {/* Over the cap is a warning on a green bar, where
                        rose on white would have been one on white: a pale
                        chip, so it still reads as a stop rather than as more
                        of the same sentence. */}
                    <span
                      className={`mt-0.5 block text-[11px] leading-tight ${
                        subtotal > shop.standing.left_thb
                          ? "w-fit rounded-full bg-rose-500 px-1.5 py-0.5 font-semibold text-white"
                          : "text-white/70"
                      }`}
                    >
                      {cartCount === 0
                        ? `เลือกสินค้าได้ถึง ฿${baht(shop.standing.left_thb)}`
                        : subtotal > shop.standing.left_thb
                          ? `เกินวงเงิน ฿${baht(subtotal - shop.standing.left_thb)}`
                          : `เหลืออีก ฿${baht(shop.standing.left_thb - subtotal)} · แตะเพื่อดูตะกร้า`}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={checkout}
                  disabled={
                    busy ||
                    cartCount === 0 ||
                    subtotal > shop.standing.left_thb ||
                    !shop.shipTo ||
                    !shop.shipTo.hasPhone
                  }
                  // On a dark bar the call-to-action can be the shop's own
                  // colour rather than an inverted white pill, which is what
                  // it had to be while the bar itself was the gradient.
                  className="grid h-12 shrink-0 place-items-center rounded-full bg-brand-gradient px-6 text-sm font-bold text-white transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/12 disabled:text-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink"
                >
                  {/* A phone can take several seconds to reach 2C2P, and a
                      button that still says "go" is a button somebody
                      presses again. */}
                  {busy ? "กำลังเปิด…" : "ไปชำระเงิน"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}

/**
 * Proving the company mailbox.
 *
 * Two steps in one card rather than two screens: the second step is six
 * digits, and a page change to collect six digits loses people.
 */
function VerifyPanel({
  round,
  suggestEmail,
  proofDays,
  onVerified,
}: {
  /** Null for anybody this shop does not already know — see the route. */
  round: RoundInfo | null;
  suggestEmail?: string;
  proofDays?: number;
  onVerified: () => void;
}) {
  // Prefilled when the account already carries an eligible address: being
  // asked here means the mailbox has not been opened for a code lately, not
  // that we do not know who they are.
  const [email, setEmail] = useState(suggestEmail ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/verify${confirm ? "?confirm=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirm ? { email, code } : { email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ไม่สำเร็จ");
      if (confirm) onVerified();
      else {
        setSent(true);
        // Only ever present outside production, where no mail provider is
        // configured — see the route's own note.
        if (json.devCode) setDevCode(String(json.devCode));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[520px] rounded-xl2 bg-white p-5 ring-1 ring-surface-line md:p-6">
      <p className="flex items-center gap-1.5 text-[15px] font-bold text-brand-ink">
        <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden />
        ยืนยันอีเมลบริษัท
      </p>
      {/* The round's name and what it is worth are for people with a claim
          to it. A signed-in customer who found this URL gets the box and
          nothing else. */}
      {round && (
        <p className="mt-1 text-[13px] text-slate-600">
          {round.name}
          {round.cap_thb ? ` · วงเงิน ฿${baht(round.cap_thb)} ต่อคน` : ""}
        </p>
      )}
      <p className="mt-3 text-[13px] text-slate-600">
        {suggestEmail
          ? `ยืนยันกล่องอีเมลบริษัทครั้งหนึ่งทุก ${proofDays ?? 30} วัน เพื่อให้แน่ใจว่ายังเปิดอ่านได้อยู่ — หลังจากนี้เข้าร้านได้เลยไม่ต้องกรอกอีก`
          : "ยืนยันเพื่อให้แน่ใจว่ายังใช้อีเมลบริษัทอยู่"}{" "}
        อีเมลนี้ใช้ยืนยันสิทธิ์เท่านั้น ไม่ได้เปลี่ยนอีเมลของบัญชีคุณ
      </p>

      {error && (
        <div className="mt-3 rounded-xl2 bg-rose-50 p-3 text-[13px] text-rose-700">{error}</div>
      )}

      <label className="mt-4 block text-[12px] font-medium text-slate-500">
        อีเมลบริษัท
        <div className="mt-1 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="somchai@smooth-e.com"
            autoComplete="email"
            className="h-11 flex-1 rounded-xl2 border border-slate-200 bg-white px-3 text-[14px] text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          />
          <Button onPress={() => post(false)} isDisabled={busy || !email.includes("@")}>
            <Mail className="h-4 w-4" aria-hidden />
            {sent ? "ส่งอีกครั้ง" : "ส่งรหัส"}
          </Button>
        </div>
      </label>

      {sent && (
        <>
          <label className="mt-4 block text-[12px] font-medium text-slate-500">
            รหัส 6 หลักที่ส่งไปที่อีเมลนั้น
            <div className="mt-1 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="h-11 w-32 rounded-xl2 border border-slate-200 bg-white px-3 text-center font-mono text-[16px] tracking-[0.3em] text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              />
              <Button onPress={() => post(true)} isDisabled={busy || code.length !== 6}>
                ยืนยัน
              </Button>
            </div>
          </label>
          {devCode && (
            <p className="mt-2 text-[12px] text-amber-700">
              (เครื่องทดสอบ ยังไม่ได้ตั้งค่าอีเมล) รหัสคือ {devCode}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            รหัสมีอายุ 10 นาที · ถ้าไม่เจอในกล่องหลัก ลองดูในสแปม
          </p>
        </>
      )}
    </div>
  );
}
