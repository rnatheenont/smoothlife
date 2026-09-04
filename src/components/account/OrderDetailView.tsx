"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Package, MapPin } from "lucide-react";
import ShipmentTracker from "@/components/ShipmentTracker";
import { Button, Card } from "@/components/ui";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug } from "@/data/products";
import { formatTHB } from "@/lib/format";
import { fulfillmentBadge, financialLabel } from "@/lib/order-status";
import type { ShopifyOrderDetail } from "@/lib/shopify-admin";
import type { buildTracking } from "@/lib/tracking";

// The presentational half of the order-detail page, split out from the fetch
// so it can be rendered from fixtures. Every state it can show — delivered,
// in transit, two parcels, free shipping, a discount — otherwise needs a real
// session and a real order to look at even once.

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={muted ? "text-slate-500" : "font-medium text-brand-ink"}>{value}</span>
    </div>
  );
}

export default function OrderDetailView({
  order,
  tracking,
}: {
  order: ShopifyOrderDetail;
  tracking: ReturnType<typeof buildTracking>;
}) {
  const { addItem } = useCart();
  const badge = fulfillmentBadge(order.fulfillmentStatus);
  const addr = order.shippingAddress;
  const discounts = Number(order.discounts);
  // Shopify's subtotalPrice is already net of discounts, so printing it above
  // a separate "ส่วนลด" line makes the column fail to add up — #4195 showed
  // 1,457 − 313 = 1,457. Adding the discount back gives the pre-discount
  // figure the subtraction is actually from.
  const grossItems = Number(order.subtotal) + discounts;

  return (
    <div className="max-w-3xl">
      <Link
        href="/account/orders"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-800"
      >
        <ChevronLeft size={14} /> คำสั่งซื้อทั้งหมด
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">{order.name}</h1>
          <p className="text-xs text-slate-400">
            สั่งเมื่อ {new Date(order.createdAt).toLocaleDateString("th-TH", { dateStyle: "long" })}
            {order.financialStatus
              ? ` · ${financialLabel[order.financialStatus] || order.financialStatus}`
              : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      <div className="mb-4">
        <ShipmentTracker shipments={tracking.shipments} hasCourierFeed={tracking.hasCourierFeed} />
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-bold text-brand-ink">รายการสินค้า</h2>
        <div className="flex flex-col gap-3">
          {order.items.map((it, i) => {
            const product = it.slug ? getProductBySlug(it.slug) : undefined;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-soft">
                  {product ? (
                    <Image src={product.image} alt={it.title} fill className="object-cover" />
                  ) : (
                    <Package size={18} className="text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-700">{it.title}</p>
                  <p className="text-[11px] text-slate-400">
                    x{it.quantity} · {formatTHB(Number(it.total))}
                  </p>
                </div>
                {product && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => addItem(product.slug, it.quantity)}
                  >
                    ซื้อซ้ำ
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-bold text-brand-ink">สรุปยอด</h2>
        <div className="flex flex-col gap-1.5">
          <Row label="ยอดรวมสินค้า" value={formatTHB(grossItems)} muted />
          {discounts > 0 && <Row label="ส่วนลด" value={`-${formatTHB(discounts)}`} muted />}
          <Row
            label="ค่าจัดส่ง"
            value={Number(order.shipping) === 0 ? "ฟรี" : formatTHB(Number(order.shipping))}
            muted
          />
          <div className="mt-1.5 border-t border-slate-100 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-brand-ink">ยอดรวมทั้งหมด</span>
              <span className="text-sm font-bold text-brand-ink">{formatTHB(Number(order.total))}</span>
            </div>
          </div>
        </div>
      </Card>

      {addr && (
        <Card>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-brand-ink">
            <MapPin size={14} className="text-brand-600" /> ที่อยู่จัดส่ง
          </h2>
          <p className="text-xs leading-relaxed text-slate-600">
            {addr.name && (
              <>
                <span className="font-medium text-brand-ink">{addr.name}</span>
                <br />
              </>
            )}
            {[addr.address1, addr.address2].filter(Boolean).join(" ")}
            <br />
            {[addr.city, addr.province, addr.zip].filter(Boolean).join(" ")}
            {addr.phone && (
              <>
                <br />
                โทร. {addr.phone}
              </>
            )}
          </p>
        </Card>
      )}
    </div>
  );
}
