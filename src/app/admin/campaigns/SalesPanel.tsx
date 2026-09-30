"use client";

// What DENTISTE' has actually sold since the campaign opened.
//
// Its own component because the number it shows is the one the campaign team
// quotes, and a preview of it has to be the same markup as the console — a
// copy would be free to drift from what the admin is really looking at.
import { useMemo, useState } from "react";
import { Input, Label, TextField } from "@heroui/react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Panel, StatCard, adminTable } from "@/components/admin/layout-kit";
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
  receipt: SaleReceipt | null;
};
export type Sales = {
  since: string;
  /** Which campaign's receipts the claim column was matched against. */
  campaign: string;
  orders: Sale[];
  totals: { orders: number; units: number; amount: number; claimed: number; unclaimed: number };
};

const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft";

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
  const needle = query.trim().toLowerCase();
  // Name first, because that is what the team is handed — "ลูกค้าชื่อ …
  // ซื้อหรือยัง" — but the order number and the email match too, since those
  // are the other two things a customer gives when they write in.
  const shown = useMemo(
    () =>
      !needle || !sales
        ? (sales?.orders ?? [])
        : sales.orders.filter((o) =>
            [o.customer, o.email, o.orderName].some((v) => v?.toLowerCase().includes(needle))
          ),
    [sales, needle]
  );
  const shownAmount = shown.reduce((sum, o) => sum + o.amount, 0);

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
      <p className="px-3 pt-3 text-[12px] text-slate-500">
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
          {/* The money gets the full width on a phone: sharing the row puts a
              six-figure number on two lines, and it is the number this tab
              exists to answer. */}
          <div className="mt-4 grid grid-cols-2 gap-3 px-3 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <StatCard label="ยอดซื้อรวม" value={formatTHB(sales.totals.amount)} />
            </div>
            <StatCard label="จำนวนออร์เดอร์" value={String(sales.totals.orders)} />
            <StatCard label="จำนวนชิ้น" value={String(sales.totals.units)} />
            <StatCard
              label="ยื่นใบเสร็จแล้ว"
              value={`${sales.totals.claimed}/${sales.totals.orders}`}
            />
          </div>
          {sales.totals.unclaimed > 0 && (
            <p className="px-3 pt-2 text-[12px] text-slate-500">
              ยังไม่ยื่นใบเสร็จ <b className="text-brand-ink">{sales.totals.unclaimed}</b> บิล — ซื้อแล้วแต่ยังไม่ส่งเข้ามาชิงรางวัล
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 px-3">
            <TextField
              value={query}
              onChange={setQuery}
              aria-label="ค้นหาชื่อลูกค้า อีเมล หรือเลขคำสั่งซื้อ"
              className="w-full sm:w-80"
            >
              <Label className="sr-only">ค้นหาลูกค้า</Label>
              <Input placeholder="ค้นหาชื่อลูกค้า / อีเมล / เลขบิล" />
            </TextField>
            {needle && (
              <p className="text-[12px] text-slate-500">
                <Search size={12} className="mr-1 inline" aria-hidden />
                พบ <b className="text-brand-ink">{shown.length}</b> บิล · รวม{" "}
                <b className="text-brand-ink">{formatTHB(shownAmount)}</b>
              </p>
            )}
          </div>

          <div className={`mt-3 ${adminTable.scroll}`}>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>คำสั่งซื้อ</th>
                  <th>ลูกค้า</th>
                  <th>สินค้า DENTISTE&apos;</th>
                  <th className="text-right whitespace-nowrap">ยอด DENTISTE&apos;</th>
                  <th className="whitespace-nowrap">ใบเสร็จ</th>
                  <th className="whitespace-nowrap">ชำระเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.orderName} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <a href={o.adminUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-800 underline">
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
                        <span className="block whitespace-nowrap text-[11px] text-slate-400">
                          ทั้งบิล {formatTHB(o.orderTotal)}
                        </span>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      {o.receipt ? (
                        <>
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${RECEIPT_CHIP[o.receipt.state][1]}`}
                          >
                            {RECEIPT_CHIP[o.receipt.state][0]}
                          </span>
                          {o.receipt.count > 1 && (
                            <span className="ml-1 text-[11px] text-slate-400">×{o.receipt.count}</span>
                          )}
                          <span className="block text-[11px] text-slate-400">{when(o.receipt.at)}</span>
                        </>
                      ) : (
                        <span className="whitespace-nowrap text-[12px] text-slate-400">ยังไม่ยื่น</span>
                      )}
                    </td>
                    <td className={adminTable.muted}>{when(o.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shown.length === 0 && (
            <p className="px-3 pb-3 pt-4 text-[13px] text-slate-500">
              {needle
                ? `ไม่พบบิลที่ตรงกับ "${query.trim()}"`
                : "ยังไม่มีคำสั่งซื้อ DENTISTE' ที่ชำระเงินสำเร็จในช่วงนี้"}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
