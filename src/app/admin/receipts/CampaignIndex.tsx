"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight, Eye, EyeOff, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
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
  published?: boolean;
};

const day = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" })
    : "—";

/** Open, not yet open, or finished — from the dates the customer's page uses. */
function phaseOf(row: CampaignRow): { label: string; className: string } {
  // Not a phase of the schedule, but the first thing to know about a row: the
  // dates of a campaign whose link does not answer are hypothetical.
  if (row.published === false) return { label: "ยังไม่เผยแพร่", className: "bg-slate-100 text-slate-600" };
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
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/receipts/campaigns", { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "โหลดรายการกิจกรรมไม่สำเร็จ");
      setRows(json.campaigns as CampaignRow[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายการกิจกรรมไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  // Publishing is what makes the link answer, so it says which way it is going
  // and what that means before it does it.
  async function togglePublished(row: CampaignRow) {
    const next = row.published === false;
    const message = next
      ? `เผยแพร่ "${row.name}"?\n\nลิงก์ /campaigns/${row.key} จะเปิดให้ลูกค้าเข้าได้ทันที`
      : `ปิดเผยแพร่ "${row.name}"?\n\nลิงก์ /campaigns/${row.key} จะขึ้นหน้าไม่พบสำหรับลูกค้า ใบเสร็จที่ส่งมาแล้วยังอยู่ครบ`;
    if (!window.confirm(message)) return;
    setMenu(null);
    setBusy(row.key);
    try {
      const res = await fetch("/api/admin/receipts/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: row.key, published: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  // The server refuses to delete a campaign anybody has entered; this asks
  // first anyway, because the ones it will delete are gone for good.
  async function remove(row: CampaignRow) {
    if (!window.confirm(`ลบ "${row.name}" ทิ้ง?\n\nลบแล้วกู้คืนไม่ได้ (กิจกรรมที่มีใบเสร็จของลูกค้าแล้วจะลบไม่ได้)`)) return;
    setMenu(null);
    setBusy(row.key);
    try {
      const res = await fetch(`/api/admin/receipts/campaigns?campaign=${encodeURIComponent(row.key)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "ลบไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

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
                  <td className={`${adminTable.cell} text-right`} onClick={(e) => e.stopPropagation()}>
                    <span className="relative inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`อื่นๆ สำหรับ ${row.name}`}
                        aria-expanded={menu === row.key}
                        onClick={() => setMenu(menu === row.key ? null : row.key)}
                        disabled={busy === row.key}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-surface-soft hover:text-brand-ink disabled:opacity-40"
                      >
                        {busy === row.key ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <MoreHorizontal size={16} aria-hidden />
                        )}
                      </button>
                      <ChevronRight size={16} className="text-slate-300" aria-hidden />
                      {menu === row.key && (
                        <>
                          {/* Anywhere else closes it — a menu that only shuts
                              by pressing its own button is one you fight. */}
                          <button
                            type="button"
                            aria-label="ปิดเมนู"
                            onClick={() => setMenu(null)}
                            className="fixed inset-0 z-20 cursor-default"
                          />
                          <div className="absolute end-0 top-9 z-30 w-56 overflow-hidden rounded-l border border-surface-line bg-white py-1 text-left shadow-lg">
                            <button
                              type="button"
                              onClick={() => togglePublished(row)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-brand-ink hover:bg-surface-soft"
                            >
                              {row.published === false ? (
                                <>
                                  <Eye size={14} aria-hidden /> เผยแพร่กิจกรรม
                                </>
                              ) : (
                                <>
                                  <EyeOff size={14} aria-hidden /> ปิดเผยแพร่
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(row)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 size={14} aria-hidden /> ลบกิจกรรม
                            </button>
                          </div>
                        </>
                      )}
                    </span>
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
