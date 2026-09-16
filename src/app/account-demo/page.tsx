"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, CreditCard, Package, RotateCcw, Truck, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { products } from "@/data/products";
import { formatTHB } from "@/lib/format";
import { ORDER_STAGE_LABEL, type OrderStage } from "@/lib/order-status";
import { DEMO, DEMO_ORDERS, STAGE_BADGE } from "./demo-data";

// A fixed, invented account used to show how the account page reads once a
// customer actually has orders, points and a tier — the real page can only
// ever show whatever the person looking at it has. Nothing here touches the
// database: every number below is written into this file.

const TILES: { stage: OrderStage; icon: LucideIcon }[] = [
  { stage: "to_pay", icon: CreditCard },
  { stage: "to_ship", icon: Package },
  { stage: "to_receive", icon: Truck },
  { stage: "completed", icon: CheckCircle2 },
  { stage: "refunded", icon: RotateCcw },
  { stage: "cancelled", icon: XCircle },
];

export default function AccountDemoPage() {
  const [stage, setStage] = useState<OrderStage | "all">("all");
  const counts = DEMO_ORDERS.reduce(
    (acc, o) => ({ ...acc, [o.stage]: (acc[o.stage] ?? 0) + 1 }),
    {} as Record<OrderStage, number>
  );
  const shown = stage === "all" ? DEMO_ORDERS : DEMO_ORDERS.filter((o) => o.stage === stage);
  const progress = Math.round((DEMO.spend / DEMO.nextAt) * 100);

  return (
    <div className="container-page mx-auto max-w-3xl py-6 md:py-10">
      <p className="mb-5 rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>ตัวอย่างการแสดงผล</strong> — ข้อมูลในหน้านี้เป็นข้อมูลสมมติทั้งหมด ไม่ใช่บัญชีจริงของใคร
        ใช้ดูว่าหน้าบัญชีจะหน้าตาแบบไหนเมื่อลูกค้ามีคำสั่งซื้อและแต้มจริง
      </p>

      {/* Membership */}
      <div className="overflow-hidden rounded-2xl shadow-cardHover ring-1 ring-black/5">
        <div
          className="p-5 text-white"
          style={{ background: "linear-gradient(135deg,#6b7686 0%,#c3cbd6 45%,#4b5563 100%)" }}
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/75">Smoothlife Member</p>
          <p className="mt-1 text-2xl font-extrabold">{DEMO.tier} Member</p>
          <p className="mt-0.5 text-sm text-white/85">{DEMO.name} · สมาชิกตั้งแต่ {DEMO.memberSince}</p>
        </div>
        <div className="bg-white p-4">
          <div className="flex items-baseline justify-between">
            <p className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-brand-ink">{DEMO.points.toLocaleString("th-TH")}</span>
              <span className="text-sm text-slate-500">แต้มสะสม</span>
            </p>
            <span className="text-xs tabular-nums text-slate-500">
              {formatTHB(DEMO.spend)} / {formatTHB(DEMO.nextAt)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            อีก {formatTHB(DEMO.nextAt - DEMO.spend)} ขึ้นระดับ Gold · โบนัสวันเกิด +300 แต้ม พร้อมส่วนลด 20%
          </p>
        </div>
      </div>

      {/* Counters */}
      <div className="mt-5 rounded-xl2 border border-surface-line bg-white shadow-card">
        <div className="border-b border-surface-line px-4 py-3">
          <h2 className="text-sm font-bold text-brand-ink">การซื้อของฉัน</h2>
        </div>
        <div className="grid grid-cols-3 gap-1 px-2 py-4 sm:grid-cols-6">
          {TILES.map((t) => (
            <button
              key={t.stage}
              type="button"
              onClick={() => setStage(t.stage)}
              className="flex flex-col items-center gap-1.5 py-1 text-center"
            >
              <span className="relative">
                <t.icon size={26} strokeWidth={1.6} className="text-brand-800" aria-hidden="true" />
                {counts[t.stage] > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sale px-1 text-[10px] font-bold text-white">
                    {counts[t.stage]}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium leading-tight text-brand-ink">{ORDER_STAGE_LABEL[t.stage]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs + list */}
      <div className="scrollbar-none -mx-4 mb-5 mt-6 flex gap-1 overflow-x-auto border-b border-surface-line px-4">
        {([["all", "ทั้งหมด", DEMO_ORDERS.length]] as [OrderStage | "all", string, number][])
          .concat((Object.keys(ORDER_STAGE_LABEL) as OrderStage[]).map((k) => [k, ORDER_STAGE_LABEL[k], counts[k] ?? 0]))
          .map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStage(key)}
              aria-current={stage === key ? "true" : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors ${
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

      <div className="flex flex-col gap-4">
        {shown.map((o) => (
          <Link
            key={o.id}
            href={`/account-demo/${o.id}`}
            className="block rounded-xl2 border border-slate-100 p-5 shadow-card transition-colors hover:border-brand-teal"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-brand-ink">{o.id}</p>
                <p className="text-xs text-slate-500">{o.date}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_BADGE[o.stage]}`}>
                {ORDER_STAGE_LABEL[o.stage]}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {o.lines.map((line) => {
                const p = products.find((x) => x.slug === line.slug);
                if (!p) return null;
                return (
                  <div key={line.slug} className="flex items-center gap-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-mist">
                      <Image src={p.image} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm text-brand-ink">{p.name}</span>
                      <span className="text-xs text-slate-500">x{line.qty}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-ink">{formatTHB(p.price * line.qty)}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">{o.note ?? "ดูรายละเอียดคำสั่งซื้อ"}</span>
              <span className="text-sm font-bold text-brand-ink">
                รวม {formatTHB(o.lines.reduce((sum, l) => sum + (products.find((p) => p.slug === l.slug)?.price ?? 0) * l.qty, 0) - (o.discount?.amount ?? 0))}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
