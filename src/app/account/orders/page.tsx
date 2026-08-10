"use client";

import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import AccountLayout from "@/components/account/AccountLayout";
import DemoBadge from "@/components/DemoBadge";
import { formatTHB } from "@/lib/format";

const statusColor: Record<string, string> = {
  Processing: "bg-amber-100 text-amber-700",
  Shipped: "bg-sky-100 text-sky-700",
  Delivered: "bg-emerald-100 text-emerald-700",
};
const statusLabel: Record<string, string> = {
  Processing: "กำลังเตรียมสินค้า",
  Shipped: "จัดส่งแล้ว",
  Delivered: "ส่งถึงแล้ว",
};

function OrdersContent() {
  const { getOrders } = useAuth();
  const { addItem } = useCart();
  const orders = getOrders();

  if (orders.length === 0) {
    return (
      <div className="text-center py-10">
        <Package size={40} className="mx-auto text-slate-300" />
        <p className="text-slate-500 mt-4">คุณยังไม่มีคำสั่งซื้อ</p>
        <Link href="/shop" className="inline-block mt-4 text-brand-emerald font-semibold text-sm">เริ่มช้อปเลย</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-ink mb-2">คำสั่งซื้อและติดตามพัสดุ</h1>
      <div className="mb-6">
        <DemoBadge text="คำสั่งซื้อที่ทำผ่านหน้าชำระเงินของ Shopify จะยังไม่แสดงที่นี่ — หน้านี้กำลังจะเชื่อมกับ Shopify Order/Customer API จริงในเฟสถัดไป ตอนนี้ตรวจสอบสถานะคำสั่งซื้อได้จากอีเมลยืนยันของ Shopify" />
      </div>
      <div className="flex flex-col gap-4">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-brand-ink">#{o.id}</p>
                <p className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString("th-TH")}</p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor[o.status]}`}>
                {statusLabel[o.status]}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none mb-3">
              {o.items.map((it) => (
                <div key={it.slug} className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                  <Image src={it.image} alt={it.name} fill className="object-cover" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-brand-ink">{formatTHB(o.total)}</span>
              <button
                onClick={() => o.items.forEach((it) => addItem(it.slug, it.qty))}
                className="text-xs font-semibold text-brand-emerald border border-brand-emerald rounded-full px-4 py-1.5"
              >
                ซื้อซ้ำ
              </button>
            </div>
          </div>
        ))}
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
