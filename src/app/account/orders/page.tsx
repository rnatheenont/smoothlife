"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, Loader2, Truck, RefreshCw, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug } from "@/data/products";
import AccountLayout from "@/components/account/AccountLayout";
import { formatTHB } from "@/lib/format";
import { orderStateBadge, stillShipping, stalledOrder, financialText, orderIdFromGid } from "@/lib/order-status";
import type { ShopifyOrderSummary } from "@/lib/shopify-admin";
import type { buildTracking } from "@/lib/tracking";
import ShipmentTracker from "@/components/ShipmentTracker";
import { Button } from "@/components/ui";


type OrderWithTracking = ShopifyOrderSummary & { tracking?: ReturnType<typeof buildTracking> };

function OrdersContent() {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [orders, setOrders] = useState<OrderWithTracking[]>([]);
  const [totals, setTotals] = useState<{ orders: number; spend: number; currency: string } | null>(null);
  /** Orders Shopify counts but will not hand to this app — see the API route. */
  const [hidden, setHidden] = useState(0);
  const [error, setError] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkAttempted, setLinkAttempted] = useState(false);

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
      <div className="flex items-center justify-center py-16 text-slate-400">
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

  if (!linked) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-brand-ink mb-2">คำสั่งซื้อและติดตามพัสดุ</h1>
        <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700 leading-relaxed">
          บัญชีของคุณยังไม่ได้เชื่อมกับระบบคำสั่งซื้อของ Shopify ค่ะ (มักเกิดขึ้นเมื่อสมัครสมาชิกด้วยอีเมล/เบอร์ที่ไม่ตรงกับตอนสั่งซื้อ)
          <div className="mt-3">
            <Button size="sm" onClick={handleRetryLink} disabled={linking}>
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
              <Link href="/help/contact" className="text-brand-emerald font-semibold">
                ติดต่อทีมงาน
              </Link>{" "}
              เพื่อให้ช่วยเชื่อมบัญชีให้ค่ะ
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-10">
        <Package size={40} className="mx-auto text-slate-300" />
        {/* "You have no orders" would be a lie to a customer whose purchases
            are simply older than what we may list. The totals come from the
            customer record and are right either way. */}
        <p className="text-slate-500 mt-4">
          {totals && totals.orders > 0
            ? `คุณมีคำสั่งซื้อ ${totals.orders} รายการ ยอดรวม ${formatTHB(totals.spend)} — แต่ทั้งหมดเก่ากว่า 60 วัน จึงยังไม่แสดงที่นี่ ติดต่อทีมงานได้เลยหากต้องการรายละเอียดค่ะ`
            : "คุณยังไม่มีคำสั่งซื้อ"}
        </p>
        <Link href="/shop" className="inline-block mt-4 text-brand-emerald font-semibold text-sm">
          เริ่มช้อปเลย
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-ink mb-2">คำสั่งซื้อและติดตามพัสดุ</h1>
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
      <div className="flex flex-col gap-4">
        {orders.map((o) => {
          const badge = orderStateBadge(o);
          const shipping = stillShipping(o);
          const refunded = Number(o.refunded) > 0;
          const stalled = stalledOrder(o);
          return (
            <div key={o.id} className="rounded-xl2 border border-slate-100 p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  {/* The whole header links through — the order number is what
                      people reach for, and a separate "details" link would be
                      one more thing to aim at on a phone. */}
                  <Link
                    href={`/account/orders/${orderIdFromGid(o.id)}`}
                    className="group inline-flex items-center gap-1 rounded-s focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <span className="text-sm font-bold text-brand-ink group-hover:text-brand-800">{o.name}</span>
                    <ChevronRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  {/* Labelled and spelled out. "29/8/2569" next to a parcel
                      that shipped on 1 Sep invites the reading that one of the
                      two dates is wrong, when they are simply the order date
                      and the dispatch date. */}
                  <p className="text-xs text-slate-400">
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
                {o.items.map((it, i) => {
                  const product = it.slug ? getProductBySlug(it.slug) : undefined;
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-surface-soft grid place-items-center">
                        {/* The order line's own picture first. The local catalogue holds
                            only what is on sale today, so free gifts, bundles and seasonal
                            SKUs fell through to a grey box — on the very page a customer
                            opens to recognise what they bought. */}
                        {it.imageUrl || product ? (
                          <Image
                            src={it.imageUrl || product!.image}
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
                        <p className="text-[11px] text-slate-400">x{it.quantity}</p>
                      </div>
                      {product && (
                        <button
                          onClick={() => addItem(product.slug, it.quantity)}
                          className="shrink-0 text-[11px] font-semibold text-brand-emerald border border-brand-emerald rounded-full px-3 py-1"
                        >
                          ซื้อซ้ำ
                        </button>
                      )}
                    </div>
                  );
                })}
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

export default function OrdersPage() {
  return (
    <AccountLayout>
      <OrdersContent />
    </AccountLayout>
  );
}
