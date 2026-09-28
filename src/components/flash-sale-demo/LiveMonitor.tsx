"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Chip } from "@heroui/react";
import { CreditCard, ExternalLink, Radio } from "lucide-react";
import type { FlashSaleMonitor, FlashSalePaymentStats } from "@/lib/flash-sale";
import type { Monitor } from "./use-monitors";

const STATUS_TH: Record<string, string> = {
  waiting: "เข้าคิว",
  reserved: "ได้สิทธิ์จอง",
  paid: "ชำระเงินแล้ว",
  expired: "หมดเวลา",
  left: "ออกจากคิว",
  closed: "ปิดคิว",
};

const PHASE: Record<FlashSaleMonitor["campaign"]["phase"], { label: string; color: "warning" | "danger" | "default" }> = {
  scheduled: { label: "ยังไม่เปิดขาย", color: "warning" },
  open: { label: "เปิดขายอยู่", color: "danger" },
  ended: { label: "ปิดการขายแล้ว", color: "default" },
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

const ATTEMPT: Record<string, { label: string; color: "success" | "danger" | "warning" | "default" }> = {
  success: { label: "จ่ายสำเร็จ", color: "success" },
  failed: { label: "ไม่สำเร็จ", color: "danger" },
  pending: { label: "เปิดหน้าจ่ายแล้ว", color: "warning" },
};

/**
 * Queue → button → money, as four numbers that only mean anything next to each
 * other. The last one is money that arrived and has nowhere to go, so it is
 * the one allowed to shout.
 */
function funnel(s: FlashSalePaymentStats) {
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : null);
  return [
    { label: "ถึงคิวแล้ว", value: s.turns, of: null as string | null, note: null as string | null, alarm: false },
    { label: "กดชำระเงิน", value: s.pressed_pay, of: pct(s.pressed_pay, s.turns), note: `${s.attempts} ครั้ง`, alarm: false },
    {
      label: "จ่ายสำเร็จ",
      value: s.paid,
      of: pct(s.paid, s.pressed_pay),
      note: s.median_seconds_to_pay !== null ? `ใช้เวลาเฉลี่ย ${mmss(s.median_seconds_to_pay)}` : null,
      alarm: false,
    },
    {
      label: "ค้างอยู่ / ไม่สำเร็จ",
      value: s.open + s.failed,
      of: null,
      note: `ค้าง ${s.open} · ไม่สำเร็จ ${s.failed} · Shopify ${s.via_shopify} · 2C2P ${s.via_2c2p}`,
      alarm: s.failed > 0,
    },
  ];
}

/** Admin: the real queue for one campaign, polled with every other open one. */

export default function LiveMonitor({
  campaignId,
  productNames,
  data,
  error,
  reload,
}: {
  campaignId: string;
  productNames: Record<string, string>;
  /** Polled for every open campaign at once by the console (see useMonitors). */
  data: Monitor | null;
  error: string | null;
  reload: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const retryOrders = async () => {
    setRetrying(true);
    setRetryResult(null);
    try {
      const res = await fetch(`/api/admin/flash-sale/campaigns/${campaignId}/retry-orders`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "ลองใหม่ไม่สำเร็จ");
      setRetryResult(`สร้างออเดอร์สำเร็จ ${json.created} · ยังไม่สำเร็จ ${json.failed}`);
      reload();
    } catch (err) {
      setRetryResult(err instanceof Error ? err.message : "ลองใหม่ไม่สำเร็จ");
    } finally {
      setRetrying(false);
    }
  };

  const name = (slug: string) => productNames[slug] ?? slug;
  const totals = data?.products.reduce(
    (t, p) => ({ total: t.total + p.total, sold: t.sold + p.sold, reserved: t.reserved + p.reserved, waiting: t.waiting + p.waiting }),
    { total: 0, sold: 0, reserved: 0, waiting: 0 }
  );

  return (
    <Card className="@container p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <Radio size={18} className="text-sale" aria-hidden /> คิวจริงจากฐานข้อมูล
          </h3>
          <p className="text-xs text-slate-500">ลูกค้าจริงที่เข้าคิวในหน้าขาย อัปเดตทุก 5 วินาที</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Chip size="sm" variant="soft" color={PHASE[data.campaign.phase].color}>
              {PHASE[data.campaign.phase].label}
            </Chip>
          )}
          <Link
            href={`/flash-sale/${campaignId}`}
            target="_blank"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-mist"
          >
            เปิดหน้าขายจริง <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </div>

      {error && (
        <Alert status="danger" className="mt-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}

      {data && totals && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
            {[
              ["รอในคิว", totals.waiting],
              ["กำลังรอชำระเงิน", totals.reserved],
              [`ขายแล้ว / ${totals.total}`, totals.sold],
              ["ลูกค้าที่เข้าคิว", data.totals.customers],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl2 bg-surface-soft p-3">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-brand-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {data.totals.sync_failed > 0 && (
            <Alert status="danger" className="mt-4">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>จ่ายเงินแล้ว {data.totals.sync_failed} ราย แต่ยังสร้างออเดอร์ Shopify ไม่สำเร็จ</Alert.Title>
                <Alert.Description>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="danger" isPending={retrying} onPress={retryOrders}>
                      สร้างออเดอร์อีกครั้ง
                    </Button>
                    {retryResult && <span>{retryResult}</span>}
                  </span>
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {data.sharedSources.length > 0 && (
            // Shown, never enforced. Households share a router, offices share
            // one address and a phone network puts a whole city behind a
            // handful — so this is a place to look, not a verdict. The point
            // is that a queue farmed from one machine is otherwise invisible.
            <Alert status="warning" className="mt-4">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  มีคิวจากที่มาเดียวกัน {data.sharedSources.length} กลุ่ม ·{" "}
                  {data.sharedSources.reduce((n, g) => n + g.accounts.length, 0)} บัญชี
                </Alert.Title>
                <Alert.Description>
                  <span className="mt-1 block text-xs">
                    บ้านเดียวกัน ออฟฟิศ หรือเน็ตมือถือก็ขึ้นแบบนี้ได้ — ไม่ได้แปลว่าผิด แต่เป็นจุดที่ควรดู
                  </span>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {data.sharedSources.map((group) => (
                      <li key={group.source} className="text-xs">
                        <span className="font-mono text-[11px] opacity-60">{group.source}</span>{" "}
                        <b>{group.accounts.length} บัญชี</b>
                        {" — "}
                        {group.accounts
                          .map((a) => `#${a.position} ${a.customer ?? a.userId.slice(0, 8)} (${STATUS_TH[a.status] ?? a.status})`)
                          .join(" · ")}
                      </li>
                    ))}
                  </ul>
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {data.refunds.length > 0 && (
            <Alert status="warning" className="mt-4">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>ต้องคืนเงิน {data.refunds.length} รายการ (เงินเข้าหลังสิทธิ์หมดหรือชำระซ้ำ)</Alert.Title>
                <Alert.Description>
                  <span className="mt-1 block">
                    {data.refunds.map((r) => `${r.invoice_no} ฿${r.amount}`).join(" · ")} — คืนเงินได้ที่หน้า
                    <Link href="/admin/checkout-transactions" className="mx-1 font-semibold underline">
                      รายการซื้อ (2C2P)
                    </Link>
                  </span>
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <ul className="mt-4 flex flex-col gap-3">
            {data.products.map((p) => (
              <li key={p.slug}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-brand-ink">{name(p.slug)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {p.sale_price !== null ? `฿${Number(p.sale_price).toLocaleString("th-TH")} · ` : "ราคาปกติ · "}ขาย {p.sold}/{p.total} · จอง {p.reserved} · รอ {p.waiting}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                  <div className="bg-brand-800" style={{ width: `${(p.sold / p.total) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(p.reserved / p.total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>

          {data.payments && (
            <div className="mt-5 rounded-xl2 ring-1 ring-surface-line">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-line px-4 py-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-brand-ink">
                  <CreditCard size={15} className="text-brand-800" aria-hidden /> การชำระเงิน
                </h4>
                <p className="text-[11px] text-slate-500">
                  ถึงคิวแล้วเกิดอะไรขึ้นต่อ — ตัวเลขนับทั้งแคมเปญ ไม่ใช่เฉพาะตอนนี้
                </p>
              </div>

              {/* Where a queue stops being a queue and starts being money, in the
                  order it actually happens. A drop between two of these is the
                  only thing on this page that says what to go and fix. */}
              <ol className="grid grid-cols-2 gap-px bg-surface-line @2xl:grid-cols-4">
                {funnel(data.payments.stats).map((step) => (
                  <li key={step.label} className="bg-white px-4 py-3">
                    <p className="text-xs text-slate-500">{step.label}</p>
                    <p className="mt-0.5 flex items-baseline gap-1.5">
                      <span className={`text-2xl font-extrabold tabular-nums ${step.alarm ? "text-rose-600" : "text-brand-ink"}`}>
                        {step.value}
                      </span>
                      {step.of !== null && <span className="text-[11px] tabular-nums text-slate-400">{step.of}</span>}
                    </p>
                    {step.note && <p className="mt-0.5 text-[11px] text-slate-500">{step.note}</p>}
                  </li>
                ))}
              </ol>

              {data.payments.stats.no_address > 0 && (
                <p className="border-t border-surface-line bg-amber-50/60 px-4 py-2.5 text-[11px] leading-relaxed text-amber-900">
                  {data.payments.stats.no_address} คนที่ถึงคิวยังไม่มีที่อยู่บันทึกไว้ในระบบ — แคมเปญที่ชำระผ่าน 2C2P
                  ต้องกรอกที่อยู่ให้ครบก่อนจึงกดปุ่มชำระเงินได้ ถ้าคนกลุ่มนี้หลุดเยอะผิดปกติ นี่คือจุดที่ควรดูก่อน
                </p>
              )}

              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  ทุกครั้งที่กดชำระเงิน ({data.payments.attempts.length}
                  {data.payments.stats.attempts > data.payments.attempts.length ? ` จาก ${data.payments.stats.attempts}` : ""})
                </p>
                {data.payments.attempts.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">ยังไม่มีใครกดชำระเงิน</p>
                ) : (
                  <ul className="mt-2 flex max-h-80 flex-col divide-y divide-surface-line overflow-y-auto">
                    {data.payments.attempts.map((a) => (
                      <li key={a.invoice_no} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
                        <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">
                          {new Date(a.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
                        </span>
                        <Chip size="sm" variant="soft" color={ATTEMPT[a.status]?.color ?? "default"}>
                          {ATTEMPT[a.status]?.label ?? a.status}
                        </Chip>
                        <span className="tabular-nums text-brand-ink">฿{a.amount.toLocaleString("th-TH")}</span>
                        <span className="text-[11px] text-slate-500">{a.via === "shopify" ? "Shopify" : "2C2P"}</span>
                        {a.position !== null && <span className="text-[11px] tabular-nums text-slate-400">#{a.position}</span>}
                        {a.order && <span className="text-[11px] font-semibold text-brand-800">{a.order}</span>}
                        <span className="w-full text-[11px] text-slate-400">
                          {a.invoice_no}
                          {a.note ? ` · ${a.note}` : ""}
                          {a.refund_note ? ` · ⚠️ ${a.refund_note}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 @3xl:grid-cols-2">
            <div>
              <h4 className="text-sm font-bold text-brand-ink">กำลังรอชำระเงิน ({data.reserved.length})</h4>
              {data.reserved.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">ยังไม่มี</p>
              ) : (
                <ul className="mt-2 flex max-h-72 flex-col divide-y divide-surface-line overflow-y-auto">
                  {data.reserved.map((r) => (
                    <li key={`${r.product_slug}-${r.position}`} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-10 shrink-0 text-xs tabular-nums text-slate-500">#{r.position}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-brand-ink">{r.name}</span>
                        <span className="block truncate text-[11px] text-slate-400">{name(r.product_slug)}</span>
                      </span>
                      <span className={`shrink-0 tabular-nums ${r.seconds_left < 180 ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                        {mmss(r.seconds_left)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-brand-ink">ความเคลื่อนไหวล่าสุด</h4>
              {data.recent.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">ยังไม่มีลูกค้าเข้าคิว</p>
              ) : (
                <ul className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
                  {data.recent.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="w-12 shrink-0 text-xs leading-5 tabular-nums text-slate-400">
                        {new Date(r.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
                      </span>
                      <span className="min-w-0 text-slate-700">
                        {r.name} {STATUS_TH[r.status] ?? r.status} (#{r.position})
                        <span className="block truncate text-[11px] text-slate-400">{name(r.product_slug)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
