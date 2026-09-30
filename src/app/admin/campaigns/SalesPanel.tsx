"use client";

// What DENTISTE' has actually sold since the campaign opened, and which of
// those bills their buyer has sent in.
//
// Its own component because the number it shows is the one the campaign team
// quotes, and a preview of it has to be the same markup as the console — a
// copy would be free to drift from what the admin is really looking at.
//
// Laid out the way the order consoles this is read next to are: one row of
// filters, one strip of numbers about what those filters left, then the rows.
// On a phone the table becomes a list of cards — a five-column table on a
// 375px screen is a horizontal scrollbar hiding the two columns that matter.
import { useMemo, useState } from "react";
import { Input, Label, TextField } from "@heroui/react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Panel, adminTable } from "@/components/admin/layout-kit";
import { when } from "./queue-vocab";
import { formatTHB } from "@/lib/format";

export type SaleItem = { title: string; quantity: number; amount: number };
export type ReceiptState = "approved" | "pending_review" | "rejected" | "revoked";
export type SaleReceipt = { state: ReceiptState; at: string; who: string | null; count: number };

/** The claim on a bill, as the person chasing unclaimed ones needs to read it. */
const RECEIPT_CHIP: Record<ReceiptState, [string, string]> = {
  approved: ["ยื่นแล้ว · อนุมัติ", "bg-emerald-50 text-emerald-800"],
  pending_review: ["ยื่นแล้ว · รอตรวจ", "bg-amber-50 text-amber-900"],
  rejected: ["ยื่นแล้ว · ตีกลับ", "bg-rose-50 text-rose-700"],
  revoked: ["ยื่นแล้ว · เพิกถอน", "bg-slate-100 text-slate-600"],
};

export type Sale = {
  orderName: string;
  adminUrl: string;
  paidAt: string | null;
  customer: string | null;
  email: string | null;
  amount: number;
  units: number;
  orderTotal: number;
  items: SaleItem[];
  /** The part of the bill that counts toward entries — VIP and gifts are out. */
  eligible: number;
  entries: number;
  receipt: SaleReceipt | null;
};

export type Sales = {
  since: string;
  /** Which campaign's receipts the claim column was matched against. */
  campaign: string;
  orders: Sale[];
  totals: {
    orders: number;
    units: number;
    amount: number;
    claimed: number;
    unclaimed: number;
    earning: number;
    noEntry: number;
    entries: number;
    threshold: number;
  };
};

const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft";

/** The claim chip, at the one size it is drawn in both layouts. */
function ReceiptChip({ receipt }: { receipt: SaleReceipt | null }) {
  if (!receipt) return <span className="text-[12px] text-slate-400">ยังไม่ยื่น</span>;
  const [label, tone] = RECEIPT_CHIP[receipt.state];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {label}
      {receipt.count > 1 && <span className="ml-1 opacity-60">×{receipt.count}</span>}
    </span>
  );
}

export default function SalesPanel({
  sales,
  error,
  busy,
  onRefresh,
}: {
  sales: Sales | null;
  error: string | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"all" | ReceiptState | "none">("all");
  // On by default: this tab is read to chase entries, and a bill that earns
  // none is not a lead. Untick it to see the whole campaign — and the line
  // under the numbers says what the whole campaign is either way, so the
  // headline figure is never hidden, only set aside.
  const [earningOnly, setEarningOnly] = useState(true);
  const needle = query.trim().toLowerCase();

  const shown = useMemo(() => {
    let rows = sales?.orders ?? [];
    if (state !== "all") rows = rows.filter((o) => (state === "none" ? !o.receipt : o.receipt?.state === state));
    if (earningOnly) rows = rows.filter((o) => o.entries > 0);
    if (needle) {
      // Name first, because that is what the team is handed — "ลูกค้าชื่อ …
      // ซื้อหรือยัง" — but the order number and the email match too, since
      // those are the other two things a customer gives when they write in.
      rows = rows.filter((o) => [o.customer, o.email, o.orderName].some((v) => v?.toLowerCase().includes(needle)));
    }
    return rows;
  }, [sales, needle, state, earningOnly]);

  const shownAmount = shown.reduce((sum, o) => sum + o.amount, 0);
  const shownEntries = shown.reduce((sum, o) => sum + o.entries, 0);
  const shownUnits = shown.reduce((sum, o) => sum + o.units, 0);
  const shownClaimed = shown.filter((o) => o.receipt).length;
  /** Whether the strip is showing a slice rather than the whole campaign. */
  const narrowed = Boolean(sales) && shown.length !== sales!.totals.orders;

  /** How many bills each tab holds, before the search box narrows them. */
  const counts = useMemo(() => {
    const rows = (sales?.orders ?? []).filter((o) => !earningOnly || o.entries > 0);
    const of = (k: ReceiptState | "none") =>
      rows.filter((o) => (k === "none" ? !o.receipt : o.receipt?.state === k)).length;
    return {
      all: rows.length,
      approved: of("approved"),
      pending_review: of("pending_review"),
      rejected: of("rejected"),
      none: of("none"),
    };
  }, [sales, earningOnly]);

  const TABS: [keyof typeof counts, string][] = [
    ["all", "ทั้งหมด"],
    ["approved", "อนุมัติ"],
    ["pending_review", "รอตรวจ"],
    ["rejected", "ตีกลับ"],
    ["none", "ยังไม่ยื่น"],
  ];

  const stats: [string, string][] = [
    [narrowed ? "ยอดซื้อในกลุ่มนี้" : "ยอดซื้อรวม", formatTHB(shownAmount)],
    ["จำนวนออร์เดอร์", String(shown.length)],
    ["จำนวนชิ้น", String(shownUnits)],
    ["สิทธิ์รวม", String(shownEntries)],
  ];

  return (
    <Panel
      title="ยอดขาย DENTISTE'"
      toolbar={
        <button type="button" onClick={onRefresh} disabled={busy} className={pill}>
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCw size={13} aria-hidden />}
          รีเฟรช
        </button>
      }
    >
      <p className="max-w-4xl px-3 pt-3 text-[12px] leading-relaxed text-slate-500">
        คำสั่งซื้อที่ <b>ชำระเงินสำเร็จ</b> ตั้งแต่ {sales ? sales.since.split("-").reverse().join("/") : "28/09/2026"}{" "}
        ดึงตรงจาก Shopify · นับเฉพาะยอดของแบรนด์ DENTISTE&apos; ในแต่ละออร์เดอร์
        (ออร์เดอร์ที่มีแบรนด์อื่นปนจะนับแค่ส่วนของ DENTISTE&apos;) · หักส่วนลดและของแถมออกแล้ว
      </p>

      {error && <p className="mx-3 mt-3 rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
      {!sales && !error && (
        <div className="flex justify-center py-12 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {sales && (
        <>
          {/* Tabs and the search sit on one line from md up, because together
              they are one question — which bills am I looking at. The tabs
              scroll rather than wrap on a phone: five wrapped pills push the
              numbers below the fold before a single row has been read. */}
          <div className="mt-3 flex flex-col gap-2 px-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 lg:mx-0 lg:px-0">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setState(key === "all" ? "all" : (key as ReceiptState | "none"))}
                  aria-pressed={state === key}
                  className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors ${
                    state === key
                      ? "bg-brand-ink text-white"
                      : "border border-surface-line text-slate-600 hover:bg-surface-soft"
                  }`}
                >
                  {label}
                  <span className={`ml-1.5 tabular-nums ${state === key ? "text-white/60" : "text-slate-400"}`}>
                    {counts[key]}
                  </span>
                </button>
              ))}
            </div>

            <TextField
              value={query}
              onChange={setQuery}
              aria-label="ค้นหาชื่อลูกค้า อีเมล หรือเลขคำสั่งซื้อ"
              className="w-full lg:w-72 lg:shrink-0"
            >
              <Label className="sr-only">ค้นหาลูกค้า</Label>
              <Input placeholder="ค้นหาชื่อลูกค้า / อีเมล / เลขบิล" />
            </TextField>
          </div>

          <div className="mt-2.5 px-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={earningOnly}
                onChange={(e) => setEarningOnly(e.target.checked)}
                className="size-4 shrink-0 accent-brand-800"
              />
              <span>
                เฉพาะบิลที่ได้สิทธิ์ — ซ่อนบิลที่ยอดไม่ถึง {formatTHB(sales.totals.threshold)}{" "}
                <span className="text-slate-400">({sales.totals.noEntry} บิลไม่ได้สิทธิ์)</span>
              </span>
            </label>
          </div>

          {/* One strip rather than four floating cards: these four numbers are
              one reading of one group, and dividers say that where gaps do
              not. Every one of them counts only what is on screen. */}
          <div className="mx-3 mt-1 grid grid-cols-2 overflow-hidden rounded-l border border-surface-line bg-surface md:grid-cols-4">
            {stats.map(([label, value], i) => (
              <div
                key={label}
                className={`px-4 py-3 ${i % 2 === 0 ? "border-r border-surface-line" : ""} ${
                  i < 2 ? "border-b border-surface-line" : ""
                } ${i < 3 ? "md:border-r md:border-surface-line" : "md:border-r-0"} md:border-b-0`}
              >
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-brand-ink">{value}</p>
              </div>
            ))}
          </div>

          <p className="px-3 pt-2.5 text-[12px] leading-relaxed text-slate-500">
            {narrowed ? (
              <>
                {needle && (
                  <>
                    <Search size={12} className="mr-1 inline" aria-hidden />
                    ค้นหา &ldquo;{query.trim()}&rdquo; ·{" "}
                  </>
                )}
                จากทั้งแคมเปญ <b className="text-brand-ink">{sales.totals.orders}</b> บิล ·{" "}
                <b className="text-brand-ink">{formatTHB(sales.totals.amount)}</b> · {sales.totals.entries} สิทธิ์
              </>
            ) : (
              <>
                ยื่นใบเสร็จแล้ว <b className="text-brand-ink">{shownClaimed}</b> บิล · ยังไม่ยื่นอีก{" "}
                <b className="text-brand-ink">{shown.length - shownClaimed}</b> บิล — ซื้อแล้วแต่ยังไม่ส่งเข้ามาชิงรางวัล
              </>
            )}
          </p>

          {/* Phones: one card per bill. The order number and the claim chip
              lead, because those are what the row is looked up by and what it
              is being checked for. */}
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 md:hidden">
            {shown.map((o) => (
              <li key={o.orderName} className="px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={o.adminUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[13px] font-semibold text-brand-800 underline"
                  >
                    {o.orderName}
                  </a>
                  <ReceiptChip receipt={o.receipt} />
                </div>

                <p className="mt-1.5 text-[13px] font-semibold text-brand-ink">{o.customer ?? "—"}</p>
                {o.email && <p className="text-[11px] text-slate-400">{o.email}</p>}

                <p className="mt-1.5 line-clamp-2 text-[12px] text-slate-600">
                  {o.items.map((it) => `${it.title}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`).join(" · ")}
                </p>

                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
                  <span className="text-[15px] font-bold tabular-nums text-brand-ink">{formatTHB(o.amount)}</span>
                  <span>·</span>
                  <span className={o.entries > 0 ? "font-semibold text-brand-ink" : "text-slate-400"}>
                    {o.entries > 0 ? `${o.entries} สิทธิ์` : "ไม่ได้สิทธิ์"}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400">{when(o.paidAt)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className={`mt-3 hidden md:block ${adminTable.scroll}`}>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>คำสั่งซื้อ</th>
                  <th>ลูกค้า</th>
                  <th>สินค้า DENTISTE&apos;</th>
                  <th className="whitespace-nowrap text-right">ยอด DENTISTE&apos;</th>
                  <th className="whitespace-nowrap text-right">สิทธิ์</th>
                  <th className="whitespace-nowrap">ใบเสร็จ</th>
                  <th className="whitespace-nowrap">ชำระเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.orderName} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <a
                        href={o.adminUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] font-semibold text-brand-800 underline"
                      >
                        {o.orderName}
                      </a>
                    </td>
                    <td className={adminTable.cell}>
                      <span className="font-semibold text-brand-ink">{o.customer ?? "—"}</span>
                      {o.email && <span className="block text-[11px] text-slate-400">{o.email}</span>}
                    </td>
                    <td className={adminTable.cell}>
                      {o.items.map((it, i) => (
                        // Two lines is enough to tell these products apart;
                        // the rest is on hover rather than in a row four
                        // lines tall.
                        <span key={i} title={it.title} className="line-clamp-2 block text-[12px] text-slate-600">
                          {it.title}
                          {it.quantity > 1 && <span className="text-slate-400"> ×{it.quantity}</span>}
                        </span>
                      ))}
                    </td>
                    <td className={`${adminTable.mono} text-right`}>
                      <span className="font-semibold text-brand-ink">{formatTHB(o.amount)}</span>
                      {/* Said out loud only when they differ, so the number
                          above is never mistaken for the whole bill. */}
                      {Math.abs(o.orderTotal - o.amount) >= 0.5 && (
                        <span className="block whitespace-nowrap text-[11px] font-sans text-slate-400">
                          ทั้งบิล {formatTHB(o.orderTotal)}
                        </span>
                      )}
                    </td>
                    <td className={`${adminTable.mono} text-right`}>
                      {o.entries > 0 ? (
                        <span className="font-semibold text-brand-ink">{o.entries}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      <ReceiptChip receipt={o.receipt} />
                      {o.receipt && <span className="mt-0.5 block text-[11px] text-slate-400">{when(o.receipt.at)}</span>}
                    </td>
                    <td className={adminTable.muted}>{when(o.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shown.length === 0 && (
            <p className="border-t border-slate-100 px-3 py-8 text-center text-[13px] text-slate-500">
              {needle ? `ไม่พบบิลที่ตรงกับ "${query.trim()}"` : "ไม่มีบิลในกลุ่มนี้"}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
