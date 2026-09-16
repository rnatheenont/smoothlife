"use client";

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CreditCard, MapPin, PackageCheck, Star, Truck } from "lucide-react";
import { products } from "@/data/products";
import { formatTHB } from "@/lib/format";
import { ORDER_STAGE_LABEL } from "@/lib/order-status";
import { DEMO, DEMO_ORDERS, STAGE_BADGE } from "../demo-data";

// What one demo order looks like when opened: the parcel's progress, what was
// in it, what was paid, where it went, and the buttons that stage would offer.
// Buttons do nothing here — this page exists to be looked at.

const STEPS = [
  { key: "packing", label: "กำลังเตรียมพัสดุ" },
  { key: "shipped", label: "เข้าระบบขนส่งแล้ว" },
  { key: "out", label: "กำลังนำจ่าย" },
  { key: "delivered", label: "ส่งถึงแล้ว" },
] as const;

export default function DemoOrderPage({ params }: { params: { id: string } }) {
  const order = DEMO_ORDERS.find((o) => o.id === params.id);
  if (!order) notFound();

  const lines = order.lines
    .map((l) => ({ ...l, product: products.find((p) => p.slug === l.slug) }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((sum, l) => sum + (l.product!.price ?? 0) * l.qty, 0);
  const total = subtotal + order.shipping - (order.discount?.amount ?? 0);
  const reachedIndex = order.reached ? STEPS.findIndex((s) => s.key === order.reached) : -1;

  return (
    <div className="container-page mx-auto max-w-2xl py-6 md:py-10">
      <p className="mb-5 rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>ตัวอย่างการแสดงผล</strong> — ข้อมูลสมมติ ปุ่มในหน้านี้กดได้แต่ยังไม่ทำงานจริง
      </p>

      <Link href="/account-demo" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800">
        <ArrowLeft size={16} /> กลับไปรายการคำสั่งซื้อ
      </Link>

      <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-brand-ink">{order.id}</h1>
            <p className="text-xs text-slate-500">สั่งซื้อเมื่อ {order.date}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STAGE_BADGE[order.stage]}`}>
            {ORDER_STAGE_LABEL[order.stage]}
          </span>
        </div>

        {/* Parcel progress */}
        {reachedIndex >= 0 && (
          <div className="mt-5 rounded-xl border border-slate-100 p-4">
            {order.courier && (
              <p className="mb-3 text-xs text-slate-500">
                {order.courier.name} · <span className="font-mono text-brand-ink">{order.courier.number}</span>
              </p>
            )}
            {/* One unbroken track behind the dots: the four cells are equal, so
                the first and last dots sit at 12.5% and 87.5% and the line runs
                between them without the gaps a per-cell border leaves. */}
            <div className="relative">
              <span className="absolute left-[12.5%] right-[12.5%] top-3 h-0.5 -translate-y-1/2 bg-slate-200" aria-hidden="true" />
              <span
                className="absolute left-[12.5%] top-3 h-0.5 -translate-y-1/2 bg-brand-emerald transition-[width]"
                style={{ width: `${(reachedIndex / (STEPS.length - 1)) * 75}%` }}
                aria-hidden="true"
              />
              <ol className="relative flex">
                {STEPS.map((step, i) => {
                  const done = i <= reachedIndex;
                  return (
                    <li key={step.key} className="flex flex-1 flex-col items-center text-center">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full ${
                          done ? "bg-brand-emerald text-white" : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span className={`mt-1.5 text-[10px] leading-tight ${done ? "font-semibold text-brand-ink" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}

        {order.note && <p className="mt-4 rounded-lg bg-surface-mist px-3 py-2 text-xs text-slate-600">{order.note}</p>}
        {order.cancelReason && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">เหตุผล: {order.cancelReason}</p>
        )}

        {/* Items */}
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4">
          {lines.map((l) => (
            <div key={l.slug} className="flex items-center gap-3">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-mist">
                <Image src={l.product!.image} alt="" fill sizes="64px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm text-brand-ink">{l.product!.name}</span>
                <span className="text-xs text-slate-500">x{l.qty}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-ink">
                {formatTHB(l.product!.price * l.qty)}
              </span>
            </div>
          ))}
        </div>

        {/* Money */}
        <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between text-slate-500">
            <dt>ราคาสินค้า</dt>
            <dd className="tabular-nums">{formatTHB(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-500">
            <dt>ค่าจัดส่ง</dt>
            <dd className="tabular-nums">{order.shipping === 0 ? "ฟรี" : formatTHB(order.shipping)}</dd>
          </div>
          {order.discount && (
            <div className="flex justify-between text-brand-800">
              <dt>ส่วนลด ({order.discount.code})</dt>
              <dd className="tabular-nums">-{formatTHB(order.discount.amount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-brand-ink">
            <dt>ยอดรวม</dt>
            <dd className="tabular-nums">{formatTHB(total)}</dd>
          </div>
          {order.refund ? (
            <div className="flex justify-between text-slate-600">
              <dt>คืนเงินแล้ว</dt>
              <dd className="tabular-nums">{formatTHB(order.refund)}</dd>
            </div>
          ) : null}
        </dl>

        {/* Where and how */}
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div className="flex gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-brand-ink">{DEMO.address.name}</p>
              {DEMO.address.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <CreditCard size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-600">{order.paidWith ?? "ยังไม่ได้ชำระเงิน"}</p>
          </div>
        </div>

        {/* What this stage offers */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {order.stage === "to_pay" && (
            <button className="rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white">ชำระเงิน</button>
          )}
          {(order.stage === "to_receive" || order.stage === "completed") && (
            <button className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-5 py-2.5 text-sm font-semibold text-brand-ink">
              <Truck size={15} /> ติดตามพัสดุ
            </button>
          )}
          {order.stage === "completed" && (
            <button className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white">
              <Star size={15} /> ให้คะแนน
            </button>
          )}
          {order.stage !== "to_pay" && (
            <button className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-5 py-2.5 text-sm font-semibold text-brand-ink">
              <PackageCheck size={15} /> ซื้อซ้ำ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
