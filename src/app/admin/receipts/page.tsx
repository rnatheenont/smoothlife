"use client";

// The receipt campaign, from the inside: the queue to work through, the VIP
// order as it stands, and what a Lucky Fan draw would be drawing from.
//
// The three are one screen because they are one question asked three ways, and
// the person approving a receipt is usually also the one being asked "am I in
// the top 25 yet". Approving here hands out a claim on a ฿55,000 prize, so the
// photo and the order it belongs to sit side by side: the number comes from the
// order, and the photo is what says the order is really theirs.
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { PageHeader, Panel, SectionTitle, StatCard, adminTable } from "@/components/admin/layout-kit";
import { formatTHB } from "@/lib/format";

type QueueItem = {
  id: string;
  customer: string | null;
  invoiceNo: string | null;
  paidAt: string | null;
  orderTotal: number | null;
  dentisteAmount: number;
  keychainAmount: number;
  entries: number;
  sentAt: string;
  photoUrl: string | null;
};
type Vip = {
  rank: number;
  customer: string | null;
  invoiceNo: string | null;
  paidAt: string | null;
  approvedAt: string | null;
  reserve: boolean;
};
type Fan = { userId: string; customer: string | null; entries: number };
type Data = {
  counts: { pending: number; approved: number; rejected: number; entrants: number; tickets: number };
  queue: QueueItem[];
  pendingBeyondQueue: number;
  vip: Vip[];
  luckyFan: Fan[];
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const TABS = [
  ["queue", "คิวตรวจ"],
  ["vip", "VIP (มาก่อนได้ก่อน)"],
  ["fan", "สิทธิ์ Lucky Fan"],
] as const;

export default function Page() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("queue");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/receipts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      setData(json as Data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  async function decide(item: QueueItem, action: "approve" | "reject") {
    // A rejection is the only thing the customer can act on, and they are shown
    // this text word for word.
    const reason = action === "reject" ? window.prompt("เหตุผลที่ตีกลับ (ลูกค้าจะเห็นข้อความนี้)")?.trim() : undefined;
    if (action === "reject" && (!reason || reason.length < 3)) return;

    let entries = item.entries;
    if (action === "approve") {
      const typed = window.prompt(`จำนวนสิทธิ์สำหรับใบเสร็จนี้ (ระบบคำนวณได้ ${item.entries})`, String(item.entries));
      if (typed === null) return;
      const n = Number(typed);
      if (!Number.isInteger(n) || n < 0) return;
      entries = n;
    }

    setBusy(item.id);
    try {
      const res = await fetch(`/api/admin/receipts/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, entries }),
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

  return (
    <div>
      <PageHeader
        title="ใบเสร็จชิงรางวัล"
        subtitle="DENTISTE'S x KENG NAMPING — ตรวจใบเสร็จ ดูลำดับ VIP และสิทธิ์ Lucky Fan"
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft"
          >
            <RefreshCw size={13} aria-hidden /> รีเฟรช
          </button>
        }
      />

      {error && <p className="mb-4 rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
      {!data && !error && (
        <div className="flex justify-center py-12 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="รอตรวจ" value={String(data.counts.pending)} />
            <StatCard label="อนุมัติแล้ว" value={String(data.counts.approved)} />
            <StatCard label="ตีกลับ" value={String(data.counts.rejected)} />
            <StatCard label="ผู้ร่วมสนุก" value={String(data.counts.entrants)} />
            <StatCard label="สิทธิ์รวม" value={String(data.counts.tickets)} />
          </div>

          <div className="scrollbar-none mb-5 flex gap-1 overflow-x-auto border-b border-surface-line">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm ${
                  tab === key ? "border-brand-action font-bold text-brand-ink" : "border-transparent text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "queue" && (
            <Panel>
              <SectionTitle>คิวตรวจ — เก่าสุดก่อน</SectionTitle>
              {data.queue.length === 0 ? (
                <p className="mt-3 text-[13px] text-slate-500">ไม่มีใบเสร็จรอตรวจ</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-4">
                  {data.queue.map((item) => (
                    <li key={item.id} className="grid gap-4 rounded-xl2 border border-surface-line p-4 md:grid-cols-[minmax(0,260px)_1fr]">
                      {item.photoUrl ? (
                        <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
                          <Image
                            src={item.photoUrl}
                            alt={`ใบเสร็จของ ${item.customer ?? "ลูกค้า"}`}
                            width={520}
                            height={700}
                            unoptimized
                            className="h-auto w-full rounded-lg border border-surface-line object-contain"
                          />
                        </a>
                      ) : (
                        <p className="grid place-items-center rounded-lg bg-surface-soft p-6 text-[12px] text-slate-400">
                          เปิดรูปไม่ได้
                        </p>
                      )}

                      <div className="flex flex-col">
                        <p className="text-[15px] font-bold text-brand-ink">{item.customer ?? "—"}</p>
                        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                          <dt className="text-slate-500">เลขที่</dt>
                          <dd className="font-medium text-brand-ink">{item.invoiceNo ?? "—"}</dd>
                          <dt className="text-slate-500">ชำระเมื่อ</dt>
                          <dd className="text-brand-ink">{when(item.paidAt)}</dd>
                          <dt className="text-slate-500">ยอดทั้งบิล</dt>
                          <dd className="text-brand-ink">{item.orderTotal === null ? "—" : formatTHB(item.orderTotal)}</dd>
                          <dt className="text-slate-500">ยอด DENTISTE&apos;</dt>
                          <dd className="font-bold text-brand-ink">{formatTHB(item.dentisteAmount)}</dd>
                          {item.keychainAmount > 0 && (
                            <>
                              <dt className="text-slate-500">Keychain</dt>
                              <dd className="text-brand-ink">{formatTHB(item.keychainAmount)}</dd>
                            </>
                          )}
                          <dt className="text-slate-500">ส่งเมื่อ</dt>
                          <dd className="text-brand-ink">{when(item.sentAt)}</dd>
                        </dl>

                        <p className="mt-3 text-[13px] text-slate-600">
                          ระบบคำนวณได้ <span className="font-bold text-brand-ink">{item.entries} สิทธิ์</span>
                        </p>

                        <div className="mt-auto flex gap-2 pt-4">
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() => decide(item, "approve")}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-800 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                          >
                            <Check size={14} aria-hidden /> อนุมัติ
                          </button>
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() => decide(item, "reject")}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rose-200 px-4 text-[13px] font-semibold text-rose-700 disabled:opacity-50"
                          >
                            <X size={14} aria-hidden /> ตีกลับ
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.pendingBeyondQueue > 0 && (
                <p className="mt-4 text-[12px] text-slate-500">
                  แสดง 50 รายการแรก — เหลืออีก {data.pendingBeyondQueue} รายการ ตรวจชุดนี้ให้หมดแล้วกดรีเฟรช
                </p>
              )}
            </Panel>
          )}

          {tab === "vip" && (
            <Panel>
              <SectionTitle>ลำดับ VIP</SectionTitle>
              <p className="mt-1 text-[12px] text-slate-500">
                เรียงตามเวลาที่ชำระเงิน · 1–25 คือตัวจริง ที่เหลือคือสำรองตามลำดับ · 1 คนมีได้ 1 ที่
                — ยังรอทีมการตลาดยืนยันว่า &quot;มาก่อนได้ก่อน&quot; นับจากเวลาซื้อหรือเวลาอนุมัติ
              </p>
              <div className={`mt-4 ${adminTable.scroll}`}>
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th>#</th>
                      <th>ลูกค้า</th>
                      <th>เลขที่</th>
                      <th>ชำระเมื่อ</th>
                      <th>อนุมัติเมื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vip.map((v) => (
                      <tr key={v.rank} className={adminTable.row}>
                        <td className={adminTable.mono}>
                          {v.rank}
                          {v.reserve && <span className="ml-1 text-[11px] text-slate-400">สำรอง</span>}
                        </td>
                        <td className={adminTable.cell}>{v.customer ?? "—"}</td>
                        <td className={adminTable.muted}>{v.invoiceNo ?? "—"}</td>
                        <td className={adminTable.muted}>{when(v.paidAt)}</td>
                        <td className={adminTable.muted}>{when(v.approvedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.vip.length === 0 && <p className="mt-3 text-[13px] text-slate-500">ยังไม่มีใบเสร็จที่อนุมัติแล้ว</p>}
            </Panel>
          )}

          {tab === "fan" && (
            <Panel>
              <SectionTitle>สิทธิ์ Lucky Fan</SectionTitle>
              <p className="mt-1 text-[12px] text-slate-500">
                ดูเพื่อความโปร่งใส ไม่ใช่การตัดสิน — ผู้ชนะมาจากการสุ่มถ่วงน้ำหนักตามจำนวนสิทธิ์
              </p>
              <div className={`mt-4 ${adminTable.scroll}`}>
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th>ลูกค้า</th>
                      <th>สิทธิ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.luckyFan.map((f) => (
                      <tr key={f.userId} className={adminTable.row}>
                        <td className={adminTable.cell}>{f.customer ?? f.userId.slice(0, 8)}</td>
                        <td className={adminTable.mono}>{f.entries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.luckyFan.length === 0 && <p className="mt-3 text-[13px] text-slate-500">ยังไม่มีสิทธิ์สะสม</p>}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
