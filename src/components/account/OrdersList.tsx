"use client";

import { useEffect, useMemo, useState } from "react";
import { shopifyImage } from "@/lib/shopify-image";
import Link from "next/link";
import Image from "next/image";
import { Package, Loader2, Truck, RefreshCw, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useLiteProducts } from "@/lib/use-lite-products";
import { formatTHB } from "@/lib/format";
import {
  orderStateBadge,
  stillShipping,
  stalledOrder,
  financialText,
  orderIdFromGid,
  orderStage,
  ORDER_STAGE_LABEL,
  type OrderStage,
} from "@/lib/order-status";
import type { ShopifyOrderSummary } from "@/lib/shopify-admin";
import type { buildTracking } from "@/lib/tracking";
import ShipmentTracker from "@/components/ShipmentTracker";
import { Button } from "@/components/ui";


type OrderWithTracking = ShopifyOrderSummary & { storeLabel?: string; tracking?: ReturnType<typeof buildTracking> };

type StaffPendingOrder = {
  id: string;
  subtotal_thb: number;
  expires_at: string;
  payment_url: string | null;
  lines: { product_slug: string; qty: number; staff_price: number }[];
};

/** "เหลือ 18 นาที", or nothing left to say. */
function minutesLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "หมดเวลาแล้ว";
  const mins = Math.ceil(ms / 60_000);
  return mins < 60 ? `เหลือ ${mins} นาที` : `เหลือ ${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
}

function Heading({ embedded }: { embedded: boolean }) {
  return embedded ? (
    <h2 className="mb-2 text-lg font-bold text-brand-ink">คำสั่งซื้อของฉัน</h2>
  ) : (
    <h1 className="mb-2 text-2xl font-bold text-brand-ink">คำสั่งซื้อและติดตามพัสดุ</h1>
  );
}

export default function OrdersList({ embedded = false }: { embedded?: boolean }) {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [orders, setOrders] = useState<OrderWithTracking[]>([]);
  const [totals, setTotals] = useState<{ orders: number; spend: number; currency: string } | null>(null);
  // The products in these orders, asked for by slug once the orders arrive.
  // Looking them up meant importing the catalogue — ~1,000 products in the
  // browser so that a "ซื้ออีกครั้ง" button knows which variant to add.
  const orderSlugs = orders.flatMap((o) => o.items.map((it) => it.slug).filter((s): s is string => Boolean(s)));
  const { products: orderProducts } = useLiteProducts(orderSlugs);
  const bySlug = new Map(orderProducts.map((p) => [p.slug, p]));
  /** Orders Shopify counts but will not hand to this app — see the API route. */
  const [hidden, setHidden] = useState(0);
  // A staff order waiting to be paid lives only in our own tables — it has
  // no Shopify order yet, so the list above cannot show it. Without this it
  // is an allowance held by something the person cannot see or cancel.
  const [staffPending, setStaffPending] = useState<StaffPendingOrder[]>([]);
  const [error, setError] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkAttempted, setLinkAttempted] = useState(false);
  // Which pile of orders to show. Arrives from the account page's counters
  // (?stage=to_ship) and the tabs below take over from there. Read off
  // location rather than useSearchParams so this page needs no Suspense
  // boundary to stay statically renderable.
  const [stage, setStage] = useState<OrderStage | "all">("all");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("stage");
    if (value && value in ORDER_STAGE_LABEL) setStage(value as OrderStage);
  }, []);

  const stageCounts = useMemo(() => {
    const counts = { to_pay: 0, to_ship: 0, to_receive: 0, completed: 0, refunded: 0, cancelled: 0 } as Record<OrderStage, number>;
    for (const o of orders) counts[orderStage(o)] += 1;
    return counts;
  }, [orders]);
  const shown = stage === "all" ? orders : orders.filter((o) => orderStage(o) === stage);

  function loadStaffPending() {
    return fetch("/api/staff/my-orders")
      .then((r) => r.json())
      .then((data) => setStaffPending(Array.isArray(data.orders) ? data.orders : []))
      // Silent: the employee shop is a side door, and most people loading
      // this page have nothing to do with it.
      .catch(() => setStaffPending([]));
  }

  async function cancelStaffOrder(id: string) {
    if (!confirm("ยกเลิกคำสั่งซื้อพนักงานที่รอชำระเงิน? วงเงินและสินค้าจะถูกคืนให้")) return;
    await fetch("/api/staff/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    void loadStaffPending();
  }

  function loadOrders() {
    return fetch("/api/account/orders")
      .then((r) => r.json())
      .then((data) => {
        setLinked(Boolean(data.linked));
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setTotals(data.totals ?? null);
        setHidden(Number(data.hidden) || 0);
      });
  }

  useEffect(() => {
    loadOrders()
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    void loadStaffPending();
  }, []);

  // Keeps itself current without being asked.
  //
  // Everything on this page changes somewhere else: payment lands at the
  // bank, the warehouse marks a parcel shipped, a staff order turns from
  // waiting into an order. None of it reaches the browser on its own —
  // Shopify has nothing to push to us — so the page asks again rather than
  // showing a stale list until somebody reloads.
  //
  // Refreshing when the tab comes back is the half that actually matters: a
  // payment is finished in another tab, and this is the moment somebody
  // returns to look for it. The interval is the slow background half, and it
  // only runs while the tab is visible — a page left open all afternoon
  // should not keep asking Shopify about it.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadOrders().catch(() => {});
      void loadStaffPending();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
    // loadOrders/loadStaffPending are stable for the life of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRetryLink() {
    setLinking(true);
    try {
      const res = await fetch("/api/account/link-shopify", { method: "POST" });
      const data = await res.json();
      if (data.linked) {
        await loadOrders();
      } else {
        setLinkAttempted(true);
      }
    } catch {
      setLinkAttempted(true);
    } finally {
      setLinking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <Package size={40} className="mx-auto text-slate-300" />
        <p className="text-slate-500 mt-4">โหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ</p>
      </div>
    );
  }

  return (
    <div>
      <Heading embedded={embedded} />
      {totals && totals.orders > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-slate-500">
            สั่งซื้อทั้งหมด <span className="font-bold text-brand-ink">{totals.orders}</span> รายการ
          </span>
          <span className="text-slate-500">
            ยอดสะสม <span className="font-bold text-brand-ink">{formatTHB(totals.spend)}</span>
          </span>
        </div>
      )}
      {hidden > 0 && (
        <p className="mb-5 rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          แสดงคำสั่งซื้อย้อนหลัง 60 วัน — อีก {hidden} รายการก่อนหน้านั้นยังดูรายละเอียดที่นี่ไม่ได้
          แต่ยอดสะสมด้านบนนับรวมไว้ครบแล้ว หากต้องการรายละเอียดคำสั่งซื้อเก่า ติดต่อทีมงานได้เลยค่ะ
        </p>
      )}
      {/* Above the tabs on purpose: this is the one row on the page with a
          clock running on it. Everything below it is history. */}
      {staffPending.map((o) => (
        <div key={o.id} className="mb-5 rounded-xl2 border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            คำสั่งซื้อราคาพนักงาน · รอชำระเงิน · {minutesLeft(o.expires_at)}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {o.lines.reduce((n, l) => n + l.qty, 0)} ชิ้น รวม {formatTHB(o.subtotal_thb)} ·
            ถ้าไม่ชำระภายในเวลา วงเงินและสินค้าจะถูกคืนให้อัตโนมัติ
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {o.payment_url && (
              <a
                href={o.payment_url}
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                ชำระเงินต่อ
              </a>
            )}
            <button
              type="button"
              onClick={() => cancelStaffOrder(o.id)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-600 ring-1 ring-amber-200 hover:text-brand-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              ยกเลิกคำสั่งซื้อนี้
            </button>
          </div>
        </div>
      ))}

      {/* Marketplace-style tabs: one scrolling row, the active one underlined
          rather than filled, so six states fit a phone without wrapping.
          Shown even with no orders yet, so the page has its real shape from
          the first visit instead of a lone empty message. */}
      {(
        <div className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-surface-line px-4">
          {([["all", "ทั้งหมด", orders.length]] as [OrderStage | "all", string, number][])
            .concat((Object.keys(ORDER_STAGE_LABEL) as OrderStage[]).map((k) => [k, ORDER_STAGE_LABEL[k], stageCounts[k]]))
            .map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStage(key)}
                aria-current={stage === key ? "true" : undefined}
                // h-11: these seven are how the order list is filtered, and a
                // 36px tab is below what a thumb is asked to find.
                className={`flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors ${
                  stage === key
                    ? "border-brand-action font-bold text-brand-ink"
                    : "border-transparent font-medium text-slate-500 hover:text-brand-ink"
                }`}
              >
                {label}
                {count > 0 && <span className="ml-1 text-xs text-slate-400">({count})</span>}
              </button>
            ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {shown.length === 0 && orders.length > 0 && (
          <p className="rounded-xl2 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-card">
            ไม่มีคำสั่งซื้อในสถานะนี้
          </p>
        )}
        {!linked && (
          <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700 leading-relaxed">
            บัญชีของคุณยังไม่ได้เชื่อมกับระบบคำสั่งซื้อของ Shopify ค่ะ (มักเกิดขึ้นเมื่อสมัครสมาชิกด้วยอีเมล/เบอร์ที่ไม่ตรงกับตอนสั่งซื้อ)
            <div className="mt-3">
              <Button size="sm" className="h-11" onClick={handleRetryLink} disabled={linking}>
                <RefreshCw size={13} className={linking ? "animate-spin" : ""} />
                {linking ? "กำลังเชื่อมบัญชี…" : "ลองเชื่อมบัญชีอีกครั้ง"}
              </Button>
            </div>
            {linkAttempted && (
              <p className="mt-3 text-rose-600 font-medium">
                ไม่พบคำสั่งซื้อที่ตรงกับอีเมล/เบอร์ของบัญชีนี้ค่ะ แปลว่าตอนสั่งซื้อน่าจะใช้อีเมล/เบอร์อื่น ระหว่างนี้ตรวจสอบคำสั่งซื้อได้จาก:
              </p>
            )}
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>อีเมลยืนยันการสั่งซื้อ (order confirmation) ที่ส่งไปตอนกดสั่งซื้อ</li>
              <li>
                <Link href="/help/contact" className="text-brand-800 font-semibold">
                  ติดต่อทีมงาน
                </Link>{" "}
                เพื่อให้ช่วยเชื่อมบัญชีให้ค่ะ
              </li>
            </ul>
          </div>
        )}
        {linked && orders.length === 0 && (
          <div className="rounded-xl2 bg-white px-6 py-12 text-center shadow-card">
            <Package size={40} className="mx-auto text-slate-300" />
            {/* "You have no orders" would be a lie to a customer whose purchases
                are simply older than what we may list. The totals come from the
                customer record and are right either way. */}
            <p className="mt-4 text-sm text-slate-500">
              {totals && totals.orders > 0
                ? `คุณมีคำสั่งซื้อ ${totals.orders} รายการ ยอดรวม ${formatTHB(totals.spend)} — แต่ทั้งหมดเก่ากว่า 60 วัน จึงยังไม่แสดงที่นี่ ติดต่อทีมงานได้เลยหากต้องการรายละเอียดค่ะ`
                : "ยังไม่มีคำสั่งซื้อ เมื่อสั่งซื้อแล้ว รายการและสถานะพัสดุจะแสดงที่นี่"}
            </p>
            <Link
              href="/shop"
              className="mt-5 inline-block rounded-full bg-brand-800 px-6 py-2.5 text-sm font-semibold text-white"
            >
              เริ่มช้อปเลย
            </Link>
          </div>
        )}
        {shown.map((o) => {
          const badge = orderStateBadge(o);
          const shipping = stillShipping(o);
          const refunded = Number(o.refunded) > 0;
          const stalled = stalledOrder(o);
          const detailHref = `/account/orders/${orderIdFromGid(o.id)}${o.store && o.store !== "smoothlife" ? `?store=${o.store}` : ""}`;
          // Three lines of the order, not all of them. A seven-item staff
          // order drew seven 56px rows before the tracker even started, so
          // the second order on the page began a screen and a half down and
          // the list stopped being a list. Three is enough to recognise which
          // order this is, which is the only job the card has — the rest is
          // what the detail page is for, and the line that counts them goes
          // there.
          const lines = o.items.slice(0, 3);
          const moreLines = o.items.length - lines.length;
          return (
            <div key={`${o.store}-${o.id}`} className="rounded-xl2 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  {/* The whole header links through — the order number is what
                      people reach for, and a separate "details" link would be
                      one more thing to aim at on a phone. */}
                  <Link
                    href={detailHref}
                    className="group inline-flex items-center gap-1 rounded-s focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <span className="text-sm font-bold text-brand-ink group-hover:text-brand-800">{o.name}</span>
                    <ChevronRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  {/* Bought at the employee price. Without this the order
                      reads as an ordinary one charged the wrong amount. A
                      tone of its own, because it answers a different
                      question from the status pill beside it. */}
                  {o.tags?.includes("staff-purchase") && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 align-middle text-[11px] font-semibold text-brand-800">
                      ราคาพนักงาน
                    </span>
                  )}
                  {/* Orders from the group's other stores say where they were placed. */}
                  {o.store && o.store !== "smoothlife" && o.storeLabel && (
                    <span className="ml-2 rounded-full bg-surface-mist px-2 py-0.5 align-middle text-[11px] font-semibold text-brand-800">
                      สั่งที่ร้าน {o.storeLabel}
                    </span>
                  )}
                  {/* Labelled and spelled out. "29/8/2569" next to a parcel
                      that shipped on 1 Sep invites the reading that one of the
                      two dates is wrong, when they are simply the order date
                      and the dispatch date. */}
                  <p className="text-xs text-slate-500">
                    สั่งเมื่อ{" "}
                    {new Date(o.createdAt).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {financialText(o.financialStatus) ? ` · ${financialText(o.financialStatus)}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                {lines.map((it, i) => {
                  const product = it.slug ? bySlug.get(it.slug) : undefined;
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-surface-soft grid place-items-center">
                        {/* The order line's own picture first. The local catalogue holds
                            only what is on sale today, so free gifts, bundles and seasonal
                            SKUs fell through to a grey box — on the very page a customer
                            opens to recognise what they bought. */}
                        {it.imageUrl || product ? (
                          <Image
                            src={shopifyImage(it.imageUrl || product!.image, 96)}
                            alt={it.title}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <Package size={18} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p translate="no" className="text-xs text-slate-600 truncate">{it.title}</p>
                        <p className="text-[11px] text-slate-500">x{it.quantity}</p>
                      </div>
                      {product && (
                        <button
                          onClick={() => addItem(product.slug, it.quantity, product.variantId)}
                          className="shrink-0 text-[11px] font-semibold text-brand-800 border border-brand-emerald rounded-full px-3 py-1"
                        >
                          ซื้อซ้ำ
                        </button>
                      )}
                    </div>
                  );
                })}
                {moreLines > 0 && (
                  <Link
                    href={detailHref}
                    className="rounded-lg px-1 py-1 text-xs font-semibold text-brand-800 hover:underline"
                  >
                    ดูอีก {moreLines} รายการ
                  </Link>
                )}
              </div>

              {/* No tracker on an order that will never ship. Five grey steps
                  under a refunded order read as "your parcel is stuck", which
                  is the opposite of what happened. */}
              {!shipping ? (
                <p className="mb-3 rounded-xl2 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                  {o.financialStatus === "EXPIRED"
                    ? "รายการนี้ไม่ได้ชำระเงินภายในเวลาที่กำหนด จึงไม่มีการจัดส่ง"
                    : "รายการนี้ปิดแล้ว ไม่มีการจัดส่ง"}
                  {refunded ? ` — คืนเงิน ${formatTHB(Number(o.refunded))} เรียบร้อยแล้ว` : ""}
                </p>
              ) : o.tracking ? (
                <div className="mb-3">
                  <ShipmentTracker
                    shipments={o.tracking.shipments}
                    hasCourierFeed={o.tracking.hasCourierFeed}
                  />
                  {stalled && (
                    <p className="mt-2 rounded-xl2 border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                      รายการนี้ชำระเงินแล้วแต่ยังไม่ได้จัดส่ง และเกินกำหนดปกติไปมากแล้ว — ทักหาทีมงานได้เลยค่ะ
                      เราจะตรวจสอบให้ทันที
                    </p>
                  )}
                </div>
              ) : (
                o.trackingNumbers.length > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <Truck size={13} /> เลขพัสดุ: {o.trackingNumbers.join(", ")}
                  </p>
                )
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                {/* What they paid, not what is left after a refund. ฿0 on an
                    order somebody paid 546 baht for is not a total, it is a
                    missing story. */}
                <span className="text-sm font-bold text-brand-ink">{formatTHB(Number(o.originalTotal || o.total))}</span>
                {refunded && (
                  <span className="text-xs font-semibold text-slate-500">
                    คืนเงินแล้ว {formatTHB(Number(o.refunded))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
