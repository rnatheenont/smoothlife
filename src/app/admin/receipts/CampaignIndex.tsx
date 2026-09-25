"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight, Loader2 } from "lucide-react";
import { Panel, adminTable } from "@/components/admin/layout-kit";

// Every campaign, before any one of them.
//
// The console opened straight into the first campaign and offered the rest in
// a dropdown, which answers "show me this one" but never "which one needs me".
// That question is answered by the queue lengths, so they are what the list is
// built around: a row per campaign, the number waiting first, and the link the
// customer sees beside it.

export type CampaignRow = {
  key: string;
  name: string;
  opensAt?: string | null;
  closesAt?: string | null;
  pending?: number;
  approved?: number;
  total?: number;
  entrants?: number;
};

const day = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" })
    : "—";

/** Open, not yet open, or finished — from the dates the customer's page uses. */
function phaseOf(row: CampaignRow): { label: string; className: string } {
  const now = Date.now();
  const opens = row.opensAt ? Date.parse(row.opensAt) : NaN;
  const closes = row.closesAt ? Date.parse(row.closesAt) : NaN;
  if (Number.isFinite(opens) && now < opens) return { label: "ยังไม่เปิด", className: "bg-amber-50 text-amber-800" };
  if (Number.isFinite(closes) && now > closes) return { label: "ปิดรับแล้ว", className: "bg-slate-100 text-slate-600" };
  return { label: "เปิดรับอยู่", className: "bg-emerald-50 text-emerald-800" };
}

export default function CampaignIndex({ onOpen }: { onOpen: (key: string) => void }) {
  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/receipts/campaigns", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.ok) throw new Error(json?.error || "โหลดรายการกิจกรรมไม่สำเร็จ");
        setRows(json.campaigns as CampaignRow[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดรายการกิจกรรมไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>;
  if (!rows)
    return (
      <div className="flex justify-center py-12 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );

  return (
    <Panel title="กิจกรรมทั้งหมด">
      <div className="overflow-x-auto">
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th >กิจกรรม</th>
              <th >สถานะ</th>
              <th >ช่วงรับใบเสร็จ</th>
              <th className="text-right">รอตรวจ</th>
              <th className="text-right">อนุมัติแล้ว</th>
              <th className="text-right">ผู้ร่วมสนุก</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const phase = phaseOf(row);
              return (
                <tr
                  key={row.key}
                  onClick={() => onOpen(row.key)}
                  className={`${adminTable.row} cursor-pointer hover:bg-surface-soft`}
                >
                  <td className={adminTable.cell}>
                    <span className="block font-bold text-brand-ink">{row.name}</span>
                    {/* The link as the customer will type it — the one field
                        that cannot be changed once a poster is printed. */}
                    <a
                      href={`/campaigns/${row.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-brand-ink hover:underline"
                    >
                      /campaigns/{row.key} <ArrowUpRight size={12} aria-hidden />
                    </a>
                  </td>
                  <td className={adminTable.cell}>
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${phase.className}`}>
                      {phase.label}
                    </span>
                  </td>
                  <td className={`${adminTable.cell} text-[13px] text-slate-600`}>
                    {day(row.opensAt)} – {day(row.closesAt)}
                  </td>
                  {/* The number that decides where to go first, so it is the
                      one written like it matters. */}
                  <td className={`${adminTable.cell} text-right`}>
                    <span
                      className={`text-[15px] font-bold tabular-nums ${
                        row.pending ? "text-brand-ink" : "text-slate-300"
                      }`}
                    >
                      {row.pending ?? 0}
                    </span>
                  </td>
                  <td className={`${adminTable.cell} text-right text-[13px] tabular-nums text-slate-600`}>
                    {row.approved ?? 0}
                  </td>
                  <td className={`${adminTable.cell} text-right text-[13px] tabular-nums text-slate-600`}>
                    {row.entrants ?? 0}
                  </td>
                  <td className={`${adminTable.cell} text-right text-slate-400`}>
                    <ChevronRight size={16} aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
