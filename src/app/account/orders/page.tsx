"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, Loader2, Truck } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug } from "@/data/products";
import AccountLayout from "@/components/account/AccountLayout";
import { formatTHB } from "@/lib/format";
import type { ShopifyOrderSummary } from "@/lib/shopify-admin";

const fulfillmentLabel: Record<string, string> = {
  FULFILLED: "จัดส่งแล้ว",
  IN_PROGRESS: "กำลังเตรียมจัดส่ง",
  PARTIALLY_FULFILLED: "จัดส่งบางส่วน",
  UNFULFILLED: "รอดำเนินการ",
  PENDING_FULFILLMENT: "รอดำเนินการ",
  ON_HOLD: "พักคำสั่งซื้อ",
  OPEN: "เปิดอยู่",
  SCHEDULED: "กำหนดส่งแล้ว",
  RESTOCKED: "คืนสต็อกแล้ว",
  REQUEST_DECLINED: "คำขอถูกปฏิเสธ",
};
const fulfillmentColor: Record<string, string> = {
  FULFILLED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  PARTIALLY_FULFILLED: "bg-sky-100 text-sky-700",
  UNFULFILLED: "bg-amber-100 text-amber-700",
  PENDING_FULFILLMENT: "bg-amber-100 text-amber-700",
  ON_HOLD: "bg-slate-100 text-slate-600",
  OPEN: "bg-amber-100 text-amber-700",
  SCHEDULED: "bg-sky-100 text-sky-700",
  RESTOCKED: "bg-slate-100 text-slate-600",
  REQUEST_DECLINED: "bg-rose-100 text-rose-700",
};
const financialLabel: Record<string, string> = {
  PAID: "ชำระเงินแล้ว",
  PENDING: "รอชำระเงิน",
  PARTIALLY_PAID: "ชำระบางส่วน",
  REFUNDED: "คืนเงินแล้ว",
  PARTIALLY_REFUNDED: "คืนเงินบางส่วน",
  VOIDED: "ยกเลิกรายการ",
  AUTHORIZED: "อนุมัติวงเงินแล้ว",
  EXPIRED: "หมดอายุ",
};

function fulfillmentBadge(status: string | null) {
  const s = status || "UNFULFILLED";
  return { label: fulfillmentLabel[s] || s, color: fulfillmentColor[s] || "bg-slate-100 text-slate-600" };
}

function OrdersContent() {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [orders, setOrders] = useState<ShopifyOrderSummary[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/account/orders")
      .then((r) => r.json())
      .then((data) => {
        setLinked(Boolean(data.linked));
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

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
          บัญชีของคุณยังไม่ได้เชื่อมกับระบบคำสั่งซื้อของ Shopify ค่ะ (มักเกิดขึ้นเมื่อสมัครสมาชิกด้วยอีเมล/เบอร์ที่ไม่ตรงกับตอนสั่งซื้อ) ระหว่างนี้ตรวจสอบคำสั่งซื้อได้จาก:
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
        <p className="text-slate-500 mt-4">คุณยังไม่มีคำสั่งซื้อ</p>
        <Link href="/shop" className="inline-block mt-4 text-brand-emerald font-semibold text-sm">
          เริ่มช้อปเลย
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-ink mb-6">คำสั่งซื้อและติดตามพัสดุ</h1>
      <div className="flex flex-col gap-4">
        {orders.map((o) => {
          const badge = fulfillmentBadge(o.fulfillmentStatus);
          return (
            <div key={o.name} className="rounded-xl2 border border-slate-100 p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-brand-ink">{o.name}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString("th-TH")}
                    {o.financialStatus ? ` · ${financialLabel[o.financialStatus] || o.financialStatus}` : ""}
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
                        {product ? (
                          <Image src={product.image} alt={it.title} fill className="object-cover" />
                        ) : (
                          <Package size={18} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-600 truncate">{it.title}</p>
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

              {o.trackingNumbers.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <Truck size={13} /> เลขพัสดุ: {o.trackingNumbers.join(", ")}
                </p>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-bold text-brand-ink">{formatTHB(Number(o.total))}</span>
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
