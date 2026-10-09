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
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  PageHeader,
  Panel,
  StatCard,
  adminCards,
  adminTable,
} from "@/components/admin/layout-kit";
import CampaignIndex from "./CampaignIndex";
import CampaignSettings from "./CampaignSettings";
import NewCampaign from "./NewCampaign";
import QueueTable from "./QueueTable";
import SalesPanel, { type Sales } from "./SalesPanel";
import { when, type QueueItem } from "./queue-vocab";
import { formatTHB } from "@/lib/format";
import { Button, Spinner } from "@heroui/react";
import AdminSearch from "@/components/admin/AdminSearch";

type Vip = {
  rank: number;
  orderName: string;
  adminUrl: string;
  customer: string | null;
  email: string | null;
  phone: string | null;
  paidAt: string | null;
  total: number;
  quantity: number;
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
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    entrants: number;
    tickets: number;
  };
  queue: QueueItem[];
  pendingBeyondQueue: number;
  decided: QueueItem[];
  decidedTotal: number;
  vipBuyers: Vip[];
  vipSeatsLeft: number;
  winners: Winner[];
  luckyFan: Fan[];
};

const TABS = [
  ["queue", "คิวตรวจ"],
  ["vip", "VIP (มาก่อนได้ก่อน)"],
  ["sales", "ยอดขาย DENTISTE'"],
  ["fan", "สิทธิ์ Lucky Fan"],
  ["decided", "ตรวจแล้ว"],
  ["draw", "ประกาศผล"],
  ["settings", "เงื่อนไข"],
] as const;

const PRIZE_LABEL = {
  vip: "VIP 25 รางวัล",
  lucky_fan: "Lucky Fan 25 รางวัล",
} as const;

const WINNER_STATUS = {
  pending_confirm: "รอยืนยันสิทธิ์",
  confirmed: "ยืนยันแล้ว",
  forfeited: "สละสิทธิ์",
} as const;

export default function Page() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("queue");
  // Which campaign this screen is showing, and the rest to switch to. One
  // screen for all of them: the second campaign should need a row in a table,
  // not a copy of this page.
  const [campaign, setCampaign] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<{ key: string; name: string }[]>(
    [],
  );
  // The campaign's own name, from the same row the customer's page reads, so
  // renaming it in the settings tab renames it here.
  const campaignName = campaigns.find((c) => c.key === campaign)?.name ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  // Sales come from Shopify, not from our own rows, and walking a date range
  // that only grows should not be part of opening the console. Loaded the
  // first time the tab is opened, and again only when asked.
  const [sales, setSales] = useState<Sales | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesBusy, setSalesBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Searching is done by the server, over every entry in the campaign rather
  // than the fifty on screen — see the note in api/admin/receipts. Typing is
  // held for a moment first: a request per keystroke would have the queue
  // flickering through four wrong answers on the way to the right one.
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  /**
   * The same search over the two lists that arrive whole.
   *
   * Queue and decided are filtered by the server, because only fifty of them
   * are ever sent. These two are not: the VIP order list comes in full and
   * Lucky Fan arrives as a tally capped at two hundred, which is far more
   * names than a campaign of this size has. So they are filtered here, where
   * it costs no request at all.
   */
  const needle = query.trim().toLowerCase();
  const needleDigits = needle.replace(/\D/g, "");
  const hit = (...fields: (string | null | undefined)[]) => {
    if (!needle) return true;
    const text = fields.filter(Boolean).join(" ").toLowerCase();
    if (text.includes(needle)) return true;
    if (!needleDigits) return false;
    return text.replace(/\D/g, "").includes(needleDigits);
  };
  const vipShown =
    data?.vipBuyers.filter((v) => hit(v.customer, v.email, v.orderName)) ?? [];
  const fanShown =
    data?.luckyFan.filter((f) => hit(f.customer, f.userId)) ?? [];

  // "" for the first campaign keeps the URL clean and the server defaulting.
  const campaignQuery = campaign
    ? `?campaign=${encodeURIComponent(campaign)}`
    : "";

  const load = useCallback(async () => {
    if (!campaign) return;
    try {
      const params = new URLSearchParams();
      if (campaign) params.set("campaign", campaign);
      if (query) params.set("q", query);
      const res = await fetch(
        `/api/admin/receipts${params.size ? `?${params}` : ""}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      setData(json as Data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [campaign, query]);

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
        if (Array.isArray(d.campaigns)) setCampaigns(d.campaigns);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSales = useCallback(async () => {
    setSalesBusy(true);
    try {
      const res = await fetch(
        `/api/admin/campaigns/dentiste-sales${campaignQuery}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok)
        throw new Error(json.error || "โหลดยอดขายไม่สำเร็จ");
      setSales(json as Sales);
      setSalesError(null);
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : "โหลดยอดขายไม่สำเร็จ");
    } finally {
      setSalesBusy(false);
    }
  }, [campaignQuery]);

  // Putting a decided receipt back in the queue, when the decision was wrong.
  async function reopen(item: QueueItem) {
    if (
      !window.confirm(
        `ดึงใบเสร็จของ ${item.customer ?? "ลูกค้า"} กลับมาตรวจใหม่?`,
      )
    )
      return;
    setBusy(item.id);
    try {
      const res = await fetch(
        `/api/admin/receipts/${item.id}${campaignQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reopen" }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok)
        throw new Error(json.error || "ดึงกลับไม่สำเร็จ");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "ดึงกลับไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  // Confirming a prize for someone who replied, or marking one given up.
  // Forfeiting is what calls the next reserve up; nobody is renumbered.
  async function decideWinner(
    w: Winner,
    action: "confirm" | "forfeit" | "reset",
  ) {
    if (
      action === "forfeit" &&
      !window.confirm(
        `ยืนยันว่าลำดับ ${w.rank} สละสิทธิ์? สิทธิ์จะตกไปที่ลำดับสำรองถัดไป`,
      )
    )
      return;
    setBusy(w.id);
    try {
      const res = await fetch(
        `/api/admin/receipts/winners/${w.id}${campaignQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
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
      const res = await fetch(
        `/api/admin/receipts/${item.id}${campaignQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recalculate" }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok)
        throw new Error(json.error || "คำนวณใหม่ไม่สำเร็จ");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "คำนวณใหม่ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Correct the order number on a claim, then recompute from it.
   *
   * The customer's own words stay on the record; this writes the reviewer's
   * reading alongside. The server does the lookup, so a number that still
   * finds nothing comes back as an error rather than a silent save.
   */
  async function setOrderNumber(item: QueueItem, orderNumber: string) {
    setBusy(item.id);
    try {
      const res = await fetch(`/api/admin/receipts/${item.id}${campaignQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "order-number", orderNumber }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "แก้เลขคำสั่งซื้อไม่สำเร็จ");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "แก้เลขคำสั่งซื้อไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  // Permanent, so it takes the photos with it — see the DELETE handler. The
  // confirmation is in the panel, beside the receipt it is about to destroy.
  async function removeEntry(item: QueueItem) {
    setBusy(item.id);
    try {
      const res = await fetch(
        `/api/admin/receipts/${item.id}${campaignQuery}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "ลบไม่สำเร็จ");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function decide(item: QueueItem, action: "approve" | "reject") {
    // A rejection is the only thing the customer can act on, and they are shown
    // this text word for word.
    const reason =
      action === "reject"
        ? window.prompt("เหตุผลที่ตีกลับ (ลูกค้าจะเห็นข้อความนี้)")?.trim()
        : undefined;
    if (action === "reject" && (!reason || reason.length < 3)) return;

    let entries = item.entries;
    if (action === "approve") {
      // A manual receipt has no order to compute from, so the prompt says so
      // rather than offering a zero that looks like an answer.
      const typed = window.prompt(
        item.manual
          ? `เคสพิเศษ — ไม่มีคำสั่งซื้อในระบบให้คำนวณ\n\nตรวจใบเสร็จกับหลักฐานการชำระเงินแล้วระบุจำนวนสิทธิ์เอง` +
              `\nลูกค้าแจ้งยอด ${item.declared.total ?? "—"} บาท`
          : `จำนวนสิทธิ์สำหรับใบเสร็จนี้ (ระบบคำนวณได้ ${item.entries})`,
        String(item.entries),
      );
      if (typed === null) return;
      const n = Number(typed);
      if (!Number.isInteger(n) || n < 0) return;
      entries = n;
    }

    setBusy(item.id);
    try {
      const res = await fetch(
        `/api/admin/receipts/${item.id}${campaignQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason, entries }),
        },
      );
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
      if (
        !window.confirm(
          `จับสลาก ${label} ตอนนี้?\n\nผลจะถูกบันทึกถาวรและใช้ประกาศจริง จับซ้ำไม่ได้จนกว่าจะล้างผลเดิม`,
        )
      )
        return;
    } else if (!window.confirm(`สรุปผล ${label} ตอนนี้?`)) return;

    setBusy(prizeType);
    try {
      const res = await fetch(`/api/admin/receipts/draw${campaignQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok)
        throw new Error(json.error || "จับสลากไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "จับสลากไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function clearDraw(prizeType: "vip" | "lucky_fan") {
    if (
      !window.confirm(
        `ล้างผล ${PRIZE_LABEL[prizeType]} ทิ้ง?\n\nรายชื่อผู้ได้รับรางวัลทั้งหมดจะถูกลบ`,
      )
    )
      return;
    setBusy(prizeType);
    try {
      const res = await fetch(
        `/api/admin/receipts/draw?prizeType=${prizeType}${campaign ? `&campaign=${encodeURIComponent(campaign)}` : ""}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "ล้างผลไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ล้างผลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  /** The three decisions a drawn place can carry, wherever it is drawn. */
  function WinnerActions({ w }: { w: Winner }) {
    // Only the places actually holding a prize have anything to confirm; a
    // reserve has nothing to give up yet.
    if (!w.holding)
      return <span className="text-[12px] text-slate-400">—</span>;
    return (
      <span className="flex flex-wrap gap-1.5">
        {w.status !== "confirmed" && (
          <Button
            variant="primary"
            size="sm"
            isDisabled={busy === w.id}
            onPress={() => decideWinner(w, "confirm")}
          >
            ยืนยันแล้ว
          </Button>
        )}
        {w.status !== "forfeited" && (
          <Button
            variant="danger-soft"
            size="sm"
            isDisabled={busy === w.id}
            onPress={() => decideWinner(w, "forfeit")}
          >
            สละสิทธิ์
          </Button>
        )}
        {w.status !== "pending_confirm" && (
          <Button
            variant="outline"
            size="sm"
            isDisabled={busy === w.id}
            onPress={() => decideWinner(w, "reset")}
          >
            ย้อนกลับ
          </Button>
        )}
      </span>
    );
  }

  const pill =
    "inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft";

  // Nothing is chosen yet: the list comes first, and the console is what
  // opening a row gets you.
  if (!campaign) {
    return (
      <div>
        <PageHeader
          title="กิจกรรม"
          subtitle="เลือกกิจกรรมที่ต้องการดู — ตรวจใบเสร็จ ดูลำดับ VIP และสิทธิ์ Lucky Fan"
          actions={
            <NewCampaign
              onCreated={(key) => {
                // Straight into the new one, on the tab that finishes setting
                // it up — a campaign with default dates is not one to leave.
                setCampaign(key);
                setTab("settings");
              }}
            />
          }
        />
        <CampaignIndex
          onOpen={(key, to) => {
            setCampaign(key);
            setTab(to ?? "queue");
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={campaignName ?? "กิจกรรมชิงรางวัล"}
        subtitle="ตรวจใบเสร็จ ดูลำดับ VIP และสิทธิ์ Lucky Fan"
        actions={
          <span className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCampaign(null);
                setData(null);
                setTab("queue");
              }}
              className={pill}
            >
              <ArrowLeft size={13} aria-hidden /> ทุกกิจกรรม
            </button>
            <button type="button" onClick={load} className={pill}>
              <RefreshCw size={13} aria-hidden /> รีเฟรช
            </button>
          </span>
        }
      />

      {error && (
        <p className="mb-4 rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          {error}
        </p>
      )}
      {!data && !error && (
        <div className="flex justify-center py-12 text-slate-400">
          <Spinner size="md" color="current" />
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
              <StatCard
                label="อนุมัติแล้ว"
                value={String(data.counts.approved)}
              />
              <StatCard label="ตีกลับ" value={String(data.counts.rejected)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="ผู้ร่วมสนุก"
                value={String(data.counts.entrants)}
              />
              <StatCard label="สิทธิ์รวม" value={String(data.counts.tickets)} />
            </div>
          </div>

          <div className="scrollbar-none mb-5 flex gap-1 overflow-x-auto border-b border-surface-line">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  // Opening the tab is what pays for the Shopify query; after
                  // that it is the รีเฟรช button's job.
                  // Refetched when the console is switched to another
                  // campaign, since the claim column is matched against that
                  // campaign's receipts.
                  if (
                    key === "sales" &&
                    sales?.campaign !== campaign &&
                    !salesBusy
                  )
                    loadSales();
                }}
                className={`shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm ${
                  tab === key
                    ? "border-brand-action font-bold text-brand-ink"
                    : "border-transparent text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {(tab === "queue" ||
            tab === "decided" ||
            tab === "vip" ||
            tab === "fan" ||
            tab === "sales") && (
            <div className="mb-3 flex items-center gap-2">
              <AdminSearch
                className="flex-1"
                value={search}
                onChange={setSearch}
                placeholder="ค้นหาชื่อลูกค้า เลขคำสั่งซื้อ เบอร์โทร หรืออีเมล"
              />
              {query && tab !== "sales" && (
                <span className="shrink-0 text-[12px] text-slate-500">
                  พบ{" "}
                  {tab === "queue"
                    ? data.queue.length
                    : tab === "decided"
                      ? data.decided.length
                      : tab === "vip"
                        ? vipShown.length
                        : fanShown.length}{" "}
                  รายการ
                </span>
              )}
            </div>
          )}

          {tab === "queue" && (
            <Panel title="คิวตรวจ — เก่าสุดก่อน">
              {data.queue.length === 0 ? (
                <p className="px-3 py-6 text-[13px] text-slate-500">
                  {query
                    ? `ไม่พบใบเสร็จรอตรวจที่ตรงกับ “${query}”`
                    : "ไม่มีใบเสร็จรอตรวจ"}
                </p>
              ) : (
                <QueueTable
                  queue={data.queue}
                  busy={busy}
                  onDecide={decide}
                  onRecalculate={recalculate}
                  onSetOrderNumber={setOrderNumber}
                  onReopen={reopen}
                  onDelete={removeEntry}
                />
              )}
              {data.pendingBeyondQueue > 0 && (
                <p className="px-3 pb-3 pt-2 text-[12px] text-slate-500">
                  แสดง {data.queue.length} รายการแรก · ยังมีอีก{" "}
                  {data.pendingBeyondQueue} รายการรอตรวจ
                </p>
              )}
            </Panel>
          )}

          {tab === "decided" && (
            <Panel title="ตรวจแล้ว — ล่าสุดก่อน">
              <p className="px-3 pt-3 text-[12px] text-slate-500">
                เปิดรายการแล้วกด <b>ดึงกลับมาตรวจใหม่</b> ได้ถ้าตัดสินผิด —
                ใบเสร็จจะกลับไปอยู่ในคิวตรวจ และผลเดิมถูกบันทึกไว้ใน audit log
              </p>
              {data.decided.length === 0 ? (
                <p className="px-3 py-6 text-[13px] text-slate-500">
                  {query
                    ? `ไม่พบใบเสร็จที่ตรวจแล้วที่ตรงกับ “${query}”`
                    : "ยังไม่มีใบเสร็จที่ตรวจแล้ว"}
                </p>
              ) : (
                <div className="mt-2">
                  <QueueTable
                    queue={data.decided}
                    busy={busy}
                    decided
                    onDecide={decide}
                    onRecalculate={recalculate}
                    onSetOrderNumber={setOrderNumber}
                    onReopen={reopen}
                    onDelete={removeEntry}
                  />
                </div>
              )}
              {data.decidedTotal > data.decided.length && (
                <p className="px-3 pb-3 pt-2 text-[12px] text-slate-500">
                  แสดง {data.decided.length} รายการล่าสุด · ทั้งหมด{" "}
                  {data.decidedTotal} รายการ
                </p>
              )}
            </Panel>
          )}

          {tab === "sales" && (
            <SalesPanel
              sales={sales}
              error={salesError}
              busy={salesBusy}
              query={query}
              onRefresh={loadSales}
            />
          )}

          {tab === "vip" && (
            <Panel title="ผู้ซื้อเซ็ต VIP">
              <p className="px-3 pt-3 text-[12px] text-slate-500">
                คนที่ซื้อ <b>[Pre-Order] Early Bird VIP 25 Set Only</b>{" "}
                และชำระเงินแล้ว เรียงตามเวลาที่ซื้อ · 1–25 คือตัวจริง
                ที่เหลือคือสำรองตามลำดับ · ดึงจาก Shopify ทุกครั้งที่เปิดหน้านี้
                {data.vipBuyers.length > 0 && (
                  <>
                    {" · "}
                    <b className="text-brand-ink">
                      ซื้อแล้ว {data.vipBuyers.length} · เหลืออีก{" "}
                      {data.vipSeatsLeft} ที่
                    </b>
                  </>
                )}
              </p>
              {/* A phone gets the same five facts stacked: the rank and the
                  order lead, because that is what the list is read for. */}
              <ul className={`mt-4 ${adminCards.list}`}>
                {vipShown.map((v) => (
                  <li key={v.orderName} className={adminCards.item}>
                    <div className={adminCards.head}>
                      <span className="font-mono text-[13px] font-bold text-brand-ink">
                        #{v.rank}
                        {v.reserve && (
                          <span className="ml-1 font-sans text-[11px] font-normal text-slate-400">
                            สำรอง
                          </span>
                        )}
                      </span>
                      <a
                        href={v.adminUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[13px] font-semibold text-brand-800 underline"
                      >
                        {v.orderName}
                        {v.quantity > 1 && (
                          <span className="ml-1 text-[11px] text-slate-400">
                            ×{v.quantity}
                          </span>
                        )}
                      </a>
                    </div>
                    <p className="mt-1.5 text-[13px] font-semibold text-brand-ink">
                      {v.customer ?? "—"}
                    </p>
                    {v.email && (
                      <p className="text-[11px] text-slate-400">{v.email}</p>
                    )}
                    <div className={adminCards.foot}>
                      <span className="text-[15px] font-bold tabular-nums text-brand-ink">
                        {formatTHB(v.total)}
                      </span>
                      <span className="ml-auto text-[11px] text-slate-400">
                        {when(v.paidAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div
                className={`mt-4 ${adminCards.forTable} ${adminTable.scroll}`}
              >
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th>#</th>
                      <th>ลูกค้า</th>
                      <th>คำสั่งซื้อ</th>
                      <th className="text-right">ยอด</th>
                      <th>ชำระเมื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vipShown.map((v) => (
                      <tr key={v.orderName} className={adminTable.row}>
                        <td className={adminTable.mono}>
                          {v.rank}
                          {v.reserve && (
                            <span className="ml-1 text-[11px] text-slate-400">
                              สำรอง
                            </span>
                          )}
                        </td>
                        <td className={adminTable.cell}>
                          <span className="font-semibold text-brand-ink">
                            {v.customer ?? "—"}
                          </span>
                          {v.email && (
                            <span className="block text-[11px] text-slate-400">
                              {v.email}
                            </span>
                          )}
                        </td>
                        <td className={adminTable.cell}>
                          <a
                            href={v.adminUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-800 underline"
                          >
                            {v.orderName}
                          </a>
                          {v.quantity > 1 && (
                            <span className="ml-1.5 text-[11px] text-slate-400">
                              ×{v.quantity}
                            </span>
                          )}
                        </td>
                        <td className={`${adminTable.mono} text-right`}>
                          {formatTHB(v.total)}
                        </td>
                        <td className={adminTable.muted}>{when(v.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vipShown.length === 0 && (
                <p className="px-3 pb-3 text-[13px] text-slate-500">
                  {query
                    ? `ไม่พบผู้ซื้อเซ็ต VIP ที่ตรงกับ “${query}”`
                    : "ยังไม่มีใครซื้อเซ็ต VIP — หรือเชื่อมต่อ Shopify ไม่ได้ในขณะนี้"}
                </p>
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
                        <Button
                          variant="primary"
                          size="sm"
                          isPending={busy === prize}
                          onPress={() => draw(prize)}
                        >
                          {busy === prize && (
                            <Spinner size="sm" color="current" />
                          )}
                          {prize === "vip" ? "สรุปผล VIP" : "จับสลาก Lucky Fan"}
                        </Button>
                      ) : (
                        <>
                          <span className="text-[13px] text-slate-600">
                            ประกาศผลแล้วเมื่อ {when(drawn[0].drawnAt)} ·
                            ยืนยันสิทธิ์ภายใน {when(drawn[0].confirmDeadline)}
                          </span>
                          <Button
                            variant="danger-soft"
                            size="sm"
                            isDisabled={busy === prize}
                            onPress={() => clearDraw(prize)}
                          >
                            ล้างผล
                          </Button>
                        </>
                      )}
                    </div>
                    <p className="px-3 pb-1 pt-2 text-[12px] text-slate-500">
                      {prize === "vip"
                        ? "เรียงตามเวลาซื้อ ไม่มีการสุ่ม — ผลเหมือนเดิมทุกครั้งที่คำนวณ"
                        : "สุ่มถ่วงน้ำหนักตามจำนวนสิทธิ์ · บันทึกจำนวนตั๋ว ผู้ร่วม และลำดับที่จับได้ไว้ตรวจย้อนหลัง"}
                    </p>
                    {drawn.length > 0 && (
                      <ul className={`mt-2 ${adminCards.list}`}>
                        {drawn.map((w) => (
                          <li key={w.id} className={adminCards.item}>
                            <div className={adminCards.head}>
                              <span className="font-mono text-[13px] font-bold text-brand-ink">
                                #{w.rank}
                                {!w.holding && (
                                  <span className="ml-1 font-sans text-[11px] font-normal text-slate-400">
                                    สำรอง
                                  </span>
                                )}
                              </span>
                              <span className="text-[12px] text-slate-500">
                                {WINNER_STATUS[w.status]}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[13px] font-semibold text-brand-ink">
                              {w.customer ?? "—"}
                            </p>
                            <div className="mt-2">
                              <WinnerActions w={w} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {drawn.length > 0 && (
                      <div
                        className={`mt-2 ${adminCards.forTable} ${adminTable.scroll}`}
                      >
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
                                  {!w.holding && (
                                    <span className="ml-1 text-[11px] text-slate-400">
                                      สำรอง
                                    </span>
                                  )}
                                </td>
                                <td className={adminTable.cell}>
                                  {w.customer ?? "—"}
                                </td>
                                <td className={adminTable.muted}>
                                  {WINNER_STATUS[w.status]}
                                </td>
                                <td className={adminTable.cell}>
                                  <WinnerActions w={w} />
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
                ดูเพื่อความโปร่งใส ไม่ใช่การตัดสิน —
                ผู้ชนะมาจากการสุ่มถ่วงน้ำหนักตามจำนวนสิทธิ์
              </p>
              {/* Two columns is a list, not a table, once the screen is a
                  phone: the name on the left and the number on the right. */}
              <ul className={`mt-4 ${adminCards.list}`}>
                {fanShown.map((f) => (
                  <li
                    key={f.userId}
                    className={`${adminCards.item} flex items-center justify-between gap-3`}
                  >
                    <span className="text-[13px] text-brand-ink">
                      {f.customer ?? f.userId.slice(0, 8)}
                    </span>
                    <span className="font-mono text-[13px] font-bold tabular-nums text-brand-ink">
                      {f.entries}
                    </span>
                  </li>
                ))}
              </ul>

              <div
                className={`mt-4 ${adminCards.forTable} ${adminTable.scroll}`}
              >
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th>ลูกค้า</th>
                      <th>สิทธิ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fanShown.map((f) => (
                      <tr key={f.userId} className={adminTable.row}>
                        <td className={adminTable.cell}>
                          {f.customer ?? f.userId.slice(0, 8)}
                        </td>
                        <td className={adminTable.mono}>{f.entries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fanShown.length === 0 && (
                <p className="px-3 pb-3 text-[13px] text-slate-500">
                  {query
                    ? `ไม่พบลูกค้าที่ตรงกับ “${query}”`
                    : "ยังไม่มีสิทธิ์สะสม"}
                </p>
              )}
            </Panel>
          )}
        </>
      )}

      {tab === "settings" && <CampaignSettings campaignQuery={campaignQuery} />}
    </div>
  );
}
