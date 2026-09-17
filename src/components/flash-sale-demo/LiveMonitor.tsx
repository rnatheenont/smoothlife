"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Chip } from "@heroui/react";
import { ExternalLink, Radio } from "lucide-react";
import type { FlashSaleMonitor } from "@/lib/flash-sale";

const POLL_MS = 5000;

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

/** Admin: the real queue for one campaign, read from the database every few seconds. */
type Monitor = FlashSaleMonitor & { refunds: { invoice_no: string; amount: number; refund_note: string }[] };

export default function LiveMonitor({ campaignId, productNames }: { campaignId: string; productNames: Record<string, string> }) {
  const [data, setData] = useState<Monitor | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      await load();
    } catch (err) {
      setRetryResult(err instanceof Error ? err.message : "ลองใหม่ไม่สำเร็จ");
    } finally {
      setRetrying(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/flash-sale/campaigns/${campaignId}/monitor`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดข้อมูลคิวไม่สำเร็จ");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลคิวไม่สำเร็จ");
    }
  }, [campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load, then polling
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const name = (slug: string) => productNames[slug] ?? slug;
  const totals = data?.products.reduce(
    (t, p) => ({ total: t.total + p.total, sold: t.sold + p.sold, reserved: t.reserved + p.reserved, waiting: t.waiting + p.waiting }),
    { total: 0, sold: 0, reserved: 0, waiting: 0 }
  );

  return (
    <Card className="p-5 md:p-6">
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
          <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
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
                    ขาย {p.sold}/{p.total} · จอง {p.reserved} · รอ {p.waiting}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                  <div className="bg-brand-800" style={{ width: `${(p.sold / p.total) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(p.reserved / p.total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
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
