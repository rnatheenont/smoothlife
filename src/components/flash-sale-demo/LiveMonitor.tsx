"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Chip } from "@heroui/react";
import { ArrowDown, CreditCard, ExternalLink, RefreshCw, Store } from "lucide-react";
import { NumberTicker } from "@/components/magicui/number-ticker";
import type { FlashSaleMonitor, FlashSalePaymentStats } from "@/lib/flash-sale";
import type { PaymentAttempt } from "@/lib/flash-sale-monitor-payments";
import type { Monitor } from "./use-monitors";

// Admin: one sale, while it is running.
//
// Everything here used to sit at one visual level — four grey boxes, a bar, two
// lists — on a page whose whole job is to answer "is this working". It is laid
// out now in the order the question is actually asked: is it live, are people
// converting, is there stock, what happened to each payment, who is holding a
// slot right now.

const STATUS_TH: Record<string, string> = {
  waiting: "เข้าคิว",
  reserved: "ได้สิทธิ์จอง",
  paid: "ชำระเงินแล้ว",
  expired: "หมดเวลา",
  left: "ออกจากคิว",
  closed: "ปิดคิว",
};

const STATUS_DOT: Record<string, string> = {
  waiting: "bg-slate-300",
  reserved: "bg-amber-400",
  paid: "bg-emerald-500",
  expired: "bg-slate-200",
  left: "bg-slate-200",
  closed: "bg-slate-200",
};

const PHASE: Record<FlashSaleMonitor["campaign"]["phase"], { label: string; color: "warning" | "danger" | "default" }> = {
  scheduled: { label: "ยังไม่เปิดขาย", color: "warning" },
  open: { label: "เปิดขายอยู่", color: "danger" },
  ended: { label: "ปิดการขายแล้ว", color: "default" },
};

const VIA: Record<PaymentAttempt["via"], string> = {
  shopify: "Shopify",
  "2c2p": "2C2P",
  storefront: "หน้าร้าน",
};

const ATTEMPT: Record<string, { label: string; color: "success" | "danger" | "warning" | "default"; dot: string }> = {
  success: { label: "จ่ายสำเร็จ", color: "success", dot: "bg-emerald-500" },
  failed: { label: "ไม่สำเร็จ", color: "danger", dot: "bg-rose-500" },
  pending: { label: "ค้างอยู่", color: "warning", dot: "bg-amber-400" },
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

/**
 * Queue → button → money, as four numbers that only mean anything next to each
 * other. Each carries what share of the step before it got through, because the
 * gap between two of these is the only thing on this page that says where to go
 * and look.
 */
function funnel(s: FlashSalePaymentStats, shopSold: { count: number; amount: number }) {
  const share = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : null);
  return [
    { key: "turns", label: "ถึงคิวแล้ว", value: s.turns, share: null as number | null, rule: "bg-slate-300", money: null as number | null, note: "ได้สิทธิ์ซื้อ", extra: null as string | null },
    {
      key: "pressed",
      label: "กดชำระเงิน",
      value: s.pressed_pay,
      share: share(s.pressed_pay, s.turns),
      rule: "bg-brand-800",
      money: null,
      note: `${s.attempts} ครั้ง`,
      extra: null,
    },
    {
      key: "paid",
      label: "จ่ายสำเร็จ",
      // The queue's own number, because this row is the queue's story: 141
      // reached their turn, 17 pressed, and what came out the far end. Adding
      // the shop's own sales here produced "2" sitting beside "0%" and
      // "ผ่านคิว 0" — three true numbers that contradicted each other.
      value: s.paid,
      share: share(s.paid, s.pressed_pay),
      rule: "bg-emerald-500",
      // The number everyone actually came for. A count of sales on a page about
      // ฿55,000 a piece was the one thing here nobody could read off it.
      money: s.paid_amount,
      note:
        s.median_seconds_to_pay !== null
          ? `เฉลี่ย ${mmss(s.median_seconds_to_pay)}`
          : s.paid === 0
            ? "ยังไม่มียอดขายผ่านคิว"
            : null,
      // Sold by the shop's own product page, beside the funnel rather than
      // inside it — it is real money and it is not this row's path.
      extra: shopSold.count > 0 ? `+ หน้าร้าน ${shopSold.count} ชิ้น · ${baht(shopSold.amount)}` : null,
    },
    {
      key: "stuck",
      label: "ค้าง / ไม่สำเร็จ",
      value: s.open + s.failed,
      share: null,
      rule: s.failed > 0 ? "bg-rose-500" : "bg-amber-400",
      money: s.open_amount,
      note: `ค้าง ${s.open} · ไม่สำเร็จ ${s.failed}`,
      extra: null,
    },
  ];
}

/** Seconds since the numbers on screen were last true, ticking on its own. */
function useAge(updatedAt: number | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return updatedAt === null ? null : Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-surface-line px-4 py-4 md:px-6 md:py-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-bold text-brand-ink">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PaymentRow({ a }: { a: PaymentAttempt }) {
  const look = ATTEMPT[a.status] ?? { label: a.status, color: "default" as const, dot: "bg-slate-300" };
  return (
    <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 py-2.5 @3xl:grid-cols-[3.5rem_7rem_6rem_5rem_3rem_1fr]">
      <span className="text-xs tabular-nums text-slate-400">{clock(a.created_at)}</span>
      <span className="flex items-center gap-1.5 @3xl:order-none">
        <span className={`size-1.5 shrink-0 rounded-full ${look.dot}`} aria-hidden />
        <span className="text-xs font-semibold text-slate-600">{look.label}</span>
      </span>
      <span className="text-sm font-semibold tabular-nums text-brand-ink @3xl:text-right">{baht(a.amount)}</span>
      <span className="text-xs text-slate-500">{VIA[a.via]}</span>
      <span className="text-xs tabular-nums text-slate-400">{a.position !== null ? `#${a.position}` : "—"}</span>
      <span className="col-span-2 min-w-0 text-xs text-slate-400 @3xl:col-span-1">
        {a.order && <span className="font-semibold text-brand-800">{a.order} · </span>}
        {a.invoice_no}
        {a.note ? ` · ${a.note}` : ""}
        {a.refund_note ? <span className="text-rose-600"> · ต้องคืนเงิน</span> : null}
      </span>
    </li>
  );
}

/** Admin: the real queue for one campaign, polled with every other open one. */

export default function LiveMonitor({
  campaignId,
  productNames,
  data,
  error,
  updatedAt,
  reload,
}: {
  campaignId: string;
  productNames: Record<string, string>;
  /** Polled for every open campaign at once by the console (see useMonitors). */
  data: Monitor | null;
  error: string | null;
  updatedAt?: number | null;
  reload: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const age = useAge(updatedAt ?? null);

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
  const live = data?.campaign.phase === "open";
  const attempts = data?.payments?.attempts ?? [];
  // Orders for this campaign's products that never touched the queue: the shop
  // sells the same box on its own product page at the same time.
  const shopOrders = (data?.payments?.orders ?? []).filter((o) => !o.viaQueue);
  const shopSold = shopOrders.reduce(
    (t, o) => ({ count: t.count + o.quantity, amount: t.amount + o.amount }),
    { count: 0, amount: 0 }
  );
  // Both doors in one list, newest first. A sale through the shop's own product
  // page is still a sale, and filing it under its own heading left the tab
  // above it saying "จ่ายสำเร็จ 0" on a day two sets had gone out.
  const rows: PaymentAttempt[] = [
    ...attempts,
    ...shopOrders.map((o) => ({
      invoice_no: o.name,
      amount: o.amount,
      status: "success",
      via: "storefront" as const,
      order: o.name,
      note: o.quantity > 1 ? `${o.quantity} ชิ้น` : null,
      refund_note: null,
      created_at: o.createdAt,
      confirmed_at: o.createdAt,
      position: null,
    })),
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const shown = filter === "all" ? rows : rows.filter((a) => a.status === filter);
  const counts = {
    all: rows.length,
    success: rows.filter((a) => a.status === "success").length,
    pending: rows.filter((a) => a.status === "pending").length,
    failed: rows.filter((a) => a.status === "failed").length,
  };

  return (
    <Card className="@container overflow-hidden p-0">
      {/* Whether this page is telling the truth right now comes before anything
          it says. A silent poller and a stopped one look the same. */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 md:px-6">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <span className="relative flex size-2.5 shrink-0" aria-hidden>
              {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-sale opacity-60" />}
              <span className={`relative inline-flex size-2.5 rounded-full ${live ? "bg-sale" : "bg-slate-300"}`} />
            </span>
            คิวจริงจากฐานข้อมูล
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            ลูกค้าจริงที่เข้าคิวในหน้าขาย
            {age !== null && <span className="text-slate-400"> · อัปเดต {age < 10 ? "เมื่อครู่" : `${age} วินาทีที่แล้ว`}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Chip size="sm" variant="soft" color={PHASE[data.campaign.phase].color}>
              {PHASE[data.campaign.phase].label}
            </Chip>
          )}
          <button
            type="button"
            onClick={reload}
            aria-label="โหลดใหม่"
            className="grid size-9 place-items-center rounded-full text-slate-400 ring-1 ring-surface-line hover:bg-surface-mist hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            <RefreshCw size={15} aria-hidden />
          </button>
          <Link
            href={`/flash-sale/${campaignId}`}
            target="_blank"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-mist"
          >
            เปิดหน้าขายจริง <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </header>

      {(error || (data && (data.totals.sync_failed > 0 || data.refunds.length > 0 || data.sharedSources.length > 0))) && (
        <div className="flex flex-col gap-2 border-t border-surface-line px-4 py-4 md:px-6">
          {error && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{error}</Alert.Title>
              </Alert.Content>
            </Alert>
          )}

          {data && data.totals.sync_failed > 0 && (
            <Alert status="danger">
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

          {data && data.refunds.length > 0 && (
            <Alert status="warning">
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

          {data && data.sharedSources.length > 0 && (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  มีคิวจากที่มาเดียวกัน {data.sharedSources.length} กลุ่ม ·{" "}
                  {data.sharedSources.reduce((n, g) => n + g.accounts.length, 0)} บัญชี
                </Alert.Title>
                <Alert.Description>
                  <span className="mt-0.5 block">บ้านเดียวกัน ออฟฟิศ หรือเน็ตมือถือก็ขึ้นแบบนี้ได้ — ไม่ได้แปลว่าผิด แต่เป็นจุดที่ควรดู</span>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {data.sharedSources.map((group) => (
                      <li key={group.source} className="text-[11px]">
                        <span className="font-semibold">{group.source}</span> {group.accounts.length} บัญชี —{" "}
                        {group.accounts.map((a) => `#${a.position} ${a.customer ?? "—"} (${STATUS_TH[a.status] ?? a.status})`).join(" · ")}
                      </li>
                    ))}
                  </ul>
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </div>
      )}

      {data && totals && (
        <>
          {/* The four that matter most, and the only place on the page where a
              number is allowed to be this large. */}
          {data.payments ? (
            <ol className="grid grid-cols-2 border-t border-surface-line @3xl:grid-cols-4">
              {funnel(data.payments.stats, shopSold).map((step, i) => (
                <li
                  key={step.key}
                  className={`relative px-4 py-4 md:px-6 ${i > 0 ? "border-surface-line @3xl:border-l" : ""} ${i < 2 ? "border-b border-surface-line @3xl:border-b-0" : ""} ${i % 2 === 1 ? "border-l border-surface-line @3xl:border-l" : ""}`}
                >
                  <span className={`absolute inset-x-0 top-0 h-[3px] ${step.rule}`} aria-hidden />
                  <p className="text-xs text-slate-500">{step.label}</p>
                  <p className="mt-1 flex items-baseline gap-2">
                    <NumberTicker value={step.value} className="text-3xl font-extrabold tabular-nums text-brand-ink" />
                    {step.share !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
                          step.share < 50 ? "text-rose-600" : "text-slate-400"
                        }`}
                      >
                        {step.share < 50 && <ArrowDown size={11} aria-hidden />}
                        {step.share}%
                      </span>
                    )}
                  </p>
                  {step.money !== null && (
                    <p className={`mt-0.5 text-sm font-bold tabular-nums ${step.key === "paid" ? "text-emerald-600" : "text-slate-500"}`}>
                      {baht(step.money)}
                    </p>
                  )}
                  {step.note && <p className="mt-0.5 text-[11px] text-slate-400">{step.note}</p>}
                  {step.extra && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{step.extra}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <dl className="grid grid-cols-2 border-t border-surface-line @3xl:grid-cols-4">
              {(
                [
                  ["รอในคิว", totals.waiting],
                  ["กำลังรอชำระเงิน", totals.reserved],
                  [`ขายแล้ว / ${totals.total}`, totals.sold],
                  ["ลูกค้าที่เข้าคิว", data.totals.customers],
                ] as const
              ).map(([k, v], i) => (
                <div key={k} className={`px-4 py-4 md:px-6 ${i > 0 ? "border-l border-surface-line" : ""} ${i < 2 ? "border-b border-surface-line @3xl:border-b-0" : ""}`}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="mt-1 text-3xl font-extrabold tabular-nums text-brand-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <Section
            title="สต็อก"
            aside={
              <span className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-brand-800" aria-hidden /> ขายแล้ว</span>
                <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-amber-400" aria-hidden /> ถือสิทธิ์อยู่</span>
                <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-surface-muted ring-1 ring-surface-line" aria-hidden /> เหลือ</span>
              </span>
            }
          >
            <ul className="flex flex-col gap-3.5">
              {data.products.map((p) => (
                <li key={p.slug}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-brand-ink">{name(p.slug)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {p.sale_price !== null ? `${baht(Number(p.sale_price))} · ` : "ราคาปกติ · "}
                      <span className="font-semibold text-brand-ink">{Math.max(0, p.total - p.sold - p.reserved)}</span> เหลือจาก {p.total}
                    </span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    <div className="bg-brand-800 transition-[width] duration-500" style={{ width: `${(p.sold / p.total) * 100}%` }} />
                    <div className="bg-amber-400 transition-[width] duration-500" style={{ width: `${(p.reserved / p.total) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                    ขาย {p.sold} · ถือสิทธิ์ {p.reserved} · รอคิว {p.waiting}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          {data.payments && (
            <Section
              title="การชำระเงิน"
              aside={
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <CreditCard size={13} aria-hidden /> Shopify {data.payments.stats.via_shopify} · 2C2P {data.payments.stats.via_2c2p}
                  {shopSold.count > 0 ? ` · หน้าร้าน ${shopOrders.length}` : ""}
                </span>
              }
            >
              {data.payments.stats.no_address > 0 && (
                <p className="mb-3 rounded-xl2 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900">
                  <b>{data.payments.stats.no_address} คน</b>ที่ถึงคิวยังไม่มีที่อยู่บันทึกไว้ในระบบ — แคมเปญที่ชำระผ่าน 2C2P
                  ต้องกรอกที่อยู่ให้ครบก่อนจึงกดปุ่มชำระเงินได้ ถ้าคนกลุ่มนี้หลุดเยอะผิดปกติ นี่คือจุดที่ควรดูก่อน
                </p>
              )}

              {shopOrders.length > 0 && (
                <p className="mb-3 rounded-xl2 bg-surface-soft px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-600">
                  <b>{shopSold.count} ชิ้น</b> ({baht(shopSold.amount)}) ขายผ่านหน้าสินค้าบน Shopify โดยตรง ไม่ได้ผ่านคิว —
                  ตัดสต็อกจริงและนับรวมในยอดขายแล้ว ถ้าอยากขายทางคิวทางเดียว ต้องเอาสินค้าออกจากช่องทาง Online Store ใน Shopify
                </p>
              )}

              {/* Filter by what you came to look for — usually the ones that did
                  not work. Counts sit on the tabs so the answer is there before
                  the click. */}
              <div className="mb-1 flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "ทั้งหมด"],
                    ["success", "จ่ายสำเร็จ"],
                    ["pending", "ค้างอยู่"],
                    ["failed", "ไม่สำเร็จ"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`min-h-8 rounded-full px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 ${
                      filter === key ? "bg-brand-800 text-white" : "text-slate-600 ring-1 ring-surface-line hover:bg-surface-mist"
                    }`}
                  >
                    {label} {counts[key]}
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">{rows.length === 0 ? "ยังไม่มีใครกดชำระเงิน" : "ไม่มีรายการในหมวดนี้"}</p>
              ) : (
                <ul className="flex max-h-96 flex-col divide-y divide-surface-line overflow-y-auto">
                  {shown.map((a) => (
                    <PaymentRow key={a.invoice_no} a={a} />
                  ))}
                </ul>
              )}
            </Section>
          )}

          <div className="grid border-t border-surface-line @3xl:grid-cols-2">
            <div className="px-4 py-4 md:px-6 md:py-5">
              <h4 className="mb-3 text-sm font-bold text-brand-ink">กำลังรอชำระเงิน ({data.reserved.length})</h4>
              {data.reserved.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มี</p>
              ) : (
                <ul className="flex max-h-72 flex-col divide-y divide-surface-line overflow-y-auto">
                  {data.reserved.map((r) => (
                    <li key={`${r.product_slug}-${r.position}`} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="w-10 shrink-0 text-xs tabular-nums text-slate-400">#{r.position}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-brand-ink">{r.name}</span>
                        <span className="block truncate text-[11px] text-slate-400">{name(r.product_slug)}</span>
                      </span>
                      {/* Under three minutes it goes red: that one is a warning. */}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                          r.seconds_left < 180 ? "bg-rose-50 text-rose-600" : "text-slate-600"
                        }`}
                      >
                        {mmss(r.seconds_left)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-surface-line px-4 py-4 @3xl:border-l @3xl:border-t-0 md:px-6 md:py-5">
              <h4 className="mb-3 text-sm font-bold text-brand-ink">ความเคลื่อนไหวล่าสุด</h4>
              {data.recent.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีลูกค้าเข้าคิว</p>
              ) : (
                <ul className="flex max-h-72 flex-col gap-2.5 overflow-y-auto">
                  {data.recent.map((r, i) => (
                    <li key={i} className="flex items-baseline gap-2.5 text-sm">
                      <span className="w-11 shrink-0 text-xs leading-5 tabular-nums text-slate-400">{clock(r.at)}</span>
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${STATUS_DOT[r.status] ?? "bg-slate-300"}`} aria-hidden />
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
