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
import { PageHeader, Panel, StatCard, adminTable } from "@/components/admin/layout-kit";
import CampaignSettings from "./CampaignSettings";
import QueueTable from "./QueueTable";
import { when, type QueueItem } from "./queue-vocab";
import { formatTHB } from "@/lib/format";

type Vip = {
  rank: number;
  customer: string | null;
  invoiceNo: string | null;
  paidAt: string | null;
  approvedAt: string | null;
  reserve: boolean;
};
type Fan = { userId: string; customer: string | null; entries: number };
type Winner = {
  id: string;
  prizeType: "vip" | "lucky_fan";
  rank: number;
  customer: string | null;
  status: "pending_confirm" | "confirmed" | "forfeited";
  /** Inside the twenty-five that have not been given up — a reserve is not. */
  holding: boolean;
  confirmDeadline: string;
  drawnAt: string;
};
type Data = {
  counts: { pending: number; approved: number; rejected: number; entrants: number; tickets: number };
  queue: QueueItem[];
  pendingBeyondQueue: number;
  decided: QueueItem[];
  decidedTotal: number;
  vip: Vip[];
  winners: Winner[];
  luckyFan: Fan[];
};

const TABS = [
  ["queue", "คิวตรวจ"],
  ["vip", "VIP (มาก่อนได้ก่อน)"],
  ["fan", "สิทธิ์ Lucky Fan"],
  ["decided", "ตรวจแล้ว"],
  ["draw", "ประกาศผล"],
  ["settings", "เงื่อนไข"],
] as const;

const PRIZE_LABEL = { vip: "VIP 25 รางวัล", lucky_fan: "Lucky Fan 25 รางวัล" } as const;

const WINNER_STATUS = {
  pending_confirm: "รอยืนยันสิทธิ์",
  confirmed: "ยืนยันแล้ว",
  forfeited: "สละสิทธิ์",
} as const;

export default function Page() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("queue");
  // The campaign's own name, from the same row the customer's page reads, so
  // renaming it in the settings tab renames it here.
  const [campaignName, setCampaignName] = useState<string | null>(null);
  // Which campaign this screen is showing, and the rest to switch to. One
  // screen for all of them: the second campaign should need a row in a table,
  // not a copy of this page.
  const [campaign, setCampaign] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<{ key: string; name: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "" for the first campaign keeps the URL clean and the server defaulting.
  const campaignQuery = campaign ? `?campaign=${encodeURIComponent(campaign)}` : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/receipts${campaignQuery}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      setData(json as Data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [campaignQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/receipts/name", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.ok) return;
        if (typeof d.name === "string" && d.name.trim()) setCampaignName(d.name.trim());
        if (Array.isArray(d.campaigns)) setCampaigns(d.campaigns);
        if (typeof d.key === "string") setCampaign((c) => c ?? d.key);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Putting a decided receipt back in the queue, when the decision was wrong.
  async function reopen(item: QueueItem) {
    if (!window.confirm(`ดึงใบเสร็จของ ${item.customer ?? "ลูกค้า"} กลับมาตรวจใหม่?`)) return;
    setBusy(item.id);
    try {
      const res = await fetch(`/api/admin/receipts/${item.id}${campaignQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "ดึงกลับไม่สำเร็จ");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "ดึงกลับไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  // Confirming a prize for someone who replied, or marking one given up.
  // Forfeiting is what calls the next reserve up; nobody is renumbered.
  async function decideWinner(w: Winner, action: "confirm" | "forfeit" | "reset") {
    if (action === "forfeit" && !window.confirm(`ยืนยันว่าลำดับ ${w.rank} สละสิทธิ์? สิทธิ์จะตกไปที่ลำดับสำรองถัดไป`)) return;
    setBusy(w.id);
    try {
      const res = await fetch(`/api/admin/receipts/winners/${w.id}${campaignQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  // Reads the order's line items again and applies today's rules to them.
  async function recalculate(item: QueueItem) {
    setBusy(item.id);
    try {
      const res = await fetch(`/api/admin/receipts/${item.id}${campaignQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "คำนวณใหม่ไม่สำเร็จ");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "คำนวณใหม่ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

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
      const res = await fetch(`/api/admin/receipts/${item.id}${campaignQuery}`, {
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

  async function draw(prizeType: "vip" | "lucky_fan") {
    const label = PRIZE_LABEL[prizeType];
    if (prizeType === "lucky_fan") {
      // A draw cannot be taken back once it has been announced, and the reason
      // this asks rather than just doing it is that the next screen is what the
      // shop will publish.
      if (!window.confirm(`จับสลาก ${label} ตอนนี้?\n\nผลจะถูกบันทึกถาวรและใช้ประกาศจริง จับซ้ำไม่ได้จนกว่าจะล้างผลเดิม`)) return;
    } else if (!window.confirm(`สรุปผล ${label} ตอนนี้?`)) return;

    setBusy(prizeType);
    try {
      const res = await fetch(`/api/admin/receipts/draw${campaignQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "จับสลากไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "จับสลากไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function clearDraw(prizeType: "vip" | "lucky_fan") {
    if (!window.confirm(`ล้างผล ${PRIZE_LABEL[prizeType]} ทิ้ง?\n\nรายชื่อผู้ได้รับรางวัลทั้งหมดจะถูกลบ`)) return;
    setBusy(prizeType);
    try {
      const res = await fetch(`/api/admin/receipts/draw?prizeType=${prizeType}${campaign ? `&campaign=${encodeURIComponent(campaign)}` : ""}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "ล้างผลไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ล้างผลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="กิจกรรมชิงรางวัล"
        subtitle={
          campaignName ? `${campaignName} — ตรวจใบเสร็จ ดูลำดับ VIP และสิทธิ์ Lucky Fan` : "ตรวจใบเสร็จ ดูลำดับ VIP และสิทธิ์ Lucky Fan"
        }
        actions={
          <>
            {/* Only when there is a choice to make. */}
            {campaigns.length > 1 && (
              <select
                value={campaign ?? ""}
                onChange={(e) => {
                  setCampaign(e.target.value);
                  setCampaignName(null);
                }}
                className="min-h-8 rounded-full border border-surface-line bg-white px-3 text-[12px] font-semibold text-brand-ink"
              >
                {campaigns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft"
          >
            <RefreshCw size={13} aria-hidden /> รีเฟรช
          </button>
          </>
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
          {/* Two groups, not five equal boxes. Three of these are the state
              of the queue and two are the size of the campaign, and a row that
              spaces them evenly across a wide screen says they are all the
              same kind of number. */}
          <div className="mb-5 grid gap-3 xl:grid-cols-[3fr_2fr]">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="รอตรวจ" value={String(data.counts.pending)} />
              <StatCard label="อนุมัติแล้ว" value={String(data.counts.approved)} />
              <StatCard label="ตีกลับ" value={String(data.counts.rejected)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="ผู้ร่วมสนุก" value={String(data.counts.entrants)} />
              <StatCard label="สิทธิ์รวม" value={String(data.counts.tickets)} />
            </div>
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
            <Panel title="คิวตรวจ — เก่าสุดก่อน">
              {data.queue.length === 0 ? (
                <p className="px-3 py-6 text-[13px] text-slate-500">ไม่มีใบเสร็จรอตรวจ</p>
              ) : (
                <QueueTable
                  queue={data.queue}
                  busy={busy}
                  onDecide={decide}
                  onRecalculate={recalculate}
                  onReopen={reopen}
                />
              )}
              {data.pendingBeyondQueue > 0 && (
                <p className="px-3 pb-3 pt-2 text-[12px] text-slate-500">
                  แสดง {data.queue.length} รายการแรก · ยังมีอีก {data.pendingBeyondQueue} รายการรอตรวจ
                </p>
              )}
            </Panel>
          )}

          {tab === "decided" && (
            <Panel title="ตรวจแล้ว — ล่าสุดก่อน">
              <p className="px-3 pt-3 text-[12px] text-slate-500">
                เปิดรายการแล้วกด <b>ดึงกลับมาตรวจใหม่</b> ได้ถ้าตัดสินผิด — ใบเสร็จจะกลับไปอยู่ในคิวตรวจ
                และผลเดิมถูกบันทึกไว้ใน audit log
              </p>
              {data.decided.length === 0 ? (
                <p className="px-3 py-6 text-[13px] text-slate-500">ยังไม่มีใบเสร็จที่ตรวจแล้ว</p>
              ) : (
                <div className="mt-2">
                  <QueueTable
                    queue={data.decided}
                    busy={busy}
                    decided
                    onDecide={decide}
                    onRecalculate={recalculate}
                    onReopen={reopen}
                  />
                </div>
              )}
              {data.decidedTotal > data.decided.length && (
                <p className="px-3 pb-3 pt-2 text-[12px] text-slate-500">
                  แสดง {data.decided.length} รายการล่าสุด · ทั้งหมด {data.decidedTotal} รายการ
                </p>
              )}
            </Panel>
          )}

          {tab === "vip" && (
            <Panel title="ลำดับ VIP">
              <p className="px-3 pt-3 text-[12px] text-slate-500">
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
              {data.vip.length === 0 && (
                <p className="px-3 pb-3 text-[13px] text-slate-500">ยังไม่มีใบเสร็จที่อนุมัติแล้ว</p>
              )}
            </Panel>
          )}

          {tab === "draw" && (
            <div className="flex flex-col gap-4">
              {(["vip", "lucky_fan"] as const).map((prize) => {
                const drawn = data.winners.filter((w) => w.prizeType === prize);
                return (
                  <Panel key={prize} title={PRIZE_LABEL[prize]}>
                    <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
                      {drawn.length === 0 ? (
                        <button
                          type="button"
                          disabled={busy === prize}
                          onClick={() => draw(prize)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-800 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                        >
                          {busy === prize && <Loader2 size={14} className="animate-spin" />}
                          {prize === "vip" ? "สรุปผล VIP" : "จับสลาก Lucky Fan"}
                        </button>
                      ) : (
                        <>
                          <span className="text-[13px] text-slate-600">
                            ประกาศผลแล้วเมื่อ {when(drawn[0].drawnAt)} · ยืนยันสิทธิ์ภายใน {when(drawn[0].confirmDeadline)}
                          </span>
                          <button
                            type="button"
                            disabled={busy === prize}
                            onClick={() => clearDraw(prize)}
                            className="inline-flex min-h-9 items-center rounded-full border border-rose-200 px-4 text-[13px] font-semibold text-rose-700 disabled:opacity-50"
                          >
                            ล้างผล
                          </button>
                        </>
                      )}
                    </div>
                    <p className="px-3 pb-1 pt-2 text-[12px] text-slate-500">
                      {prize === "vip"
                        ? "เรียงตามเวลาซื้อ ไม่มีการสุ่ม — ผลเหมือนเดิมทุกครั้งที่คำนวณ"
                        : "สุ่มถ่วงน้ำหนักตามจำนวนสิทธิ์ · บันทึกจำนวนตั๋ว ผู้ร่วม และลำดับที่จับได้ไว้ตรวจย้อนหลัง"}
                    </p>
                    {drawn.length > 0 && (
                      <div className={`mt-2 ${adminTable.scroll}`}>
                        <table className={adminTable.table}>
                          <thead className={adminTable.thead}>
                            <tr>
                              <th>#</th>
                              <th>ลูกค้า</th>
                              <th>สถานะ</th>
                              <th>ยืนยันสิทธิ์</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drawn.map((w) => (
                              <tr key={w.id} className={adminTable.row}>
                                <td className={adminTable.mono}>
                                  {w.rank}
                                  {!w.holding && <span className="ml-1 text-[11px] text-slate-400">สำรอง</span>}
                                </td>
                                <td className={adminTable.cell}>{w.customer ?? "—"}</td>
                                <td className={adminTable.muted}>{WINNER_STATUS[w.status]}</td>
                                <td className={adminTable.cell}>
                                  {/* Only the places actually holding a prize
                                      have anything to confirm; a reserve has
                                      nothing to give up yet. */}
                                  {w.holding ? (
                                    <span className="flex flex-wrap gap-1.5">
                                      {w.status !== "confirmed" && (
                                        <button
                                          type="button"
                                          disabled={busy === w.id}
                                          onClick={() => decideWinner(w, "confirm")}
                                          className="min-h-8 rounded-full bg-brand-800 px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                                        >
                                          ยืนยันแล้ว
                                        </button>
                                      )}
                                      {w.status !== "forfeited" && (
                                        <button
                                          type="button"
                                          disabled={busy === w.id}
                                          onClick={() => decideWinner(w, "forfeit")}
                                          className="min-h-8 rounded-full border border-rose-200 px-3 text-[12px] font-semibold text-rose-700 disabled:opacity-50"
                                        >
                                          สละสิทธิ์
                                        </button>
                                      )}
                                      {w.status !== "pending_confirm" && (
                                        <button
                                          type="button"
                                          disabled={busy === w.id}
                                          onClick={() => decideWinner(w, "reset")}
                                          className="min-h-8 rounded-full border border-surface-line px-3 text-[12px] font-semibold text-slate-600 disabled:opacity-50"
                                        >
                                          ย้อนกลับ
                                        </button>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-[12px] text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Panel>
                );
              })}
            </div>
          )}

          {tab === "fan" && (
            <Panel title="สิทธิ์ Lucky Fan">
              <p className="px-3 pt-3 text-[12px] text-slate-500">
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
              {data.luckyFan.length === 0 && (
                <p className="px-3 pb-3 text-[13px] text-slate-500">ยังไม่มีสิทธิ์สะสม</p>
              )}
            </Panel>
          )}
        </>
      )}

      {tab === "settings" && <CampaignSettings campaignQuery={campaignQuery} />}
    </div>
  );
}
