"use client";

// The campaigns an admin has actually created.
//
// This is why a saved campaign looked lost: the page it lands on after
// saving only ever showed the walk-through demo and a link to the create
// form, so there was nowhere to see what existed, nowhere to open its sale
// page, and no way to tell a scheduled campaign from a live one. The API
// has returned all of this since the create route was written — nothing
// called it.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, PlayCircle, RefreshCw, Trash2 } from "lucide-react";
import { Panel, SectionTitle, adminTable } from "@/components/admin/layout-kit";

/** The whole DTO, because editing sends back everything it did not change. */
type Campaign = {
  id: string;
  title: string;
  mode: "single" | "group";
  kind: "regular" | "special";
  published?: boolean;
  presentation: {
    heroImage: string | null;
    heroHeadline: string | null;
    heroNote: string | null;
    heroAlign: "top" | "center" | "bottom";
    accent: string | null;
    faq: { q: string; a: string }[];
  };
  groupKind: "category" | "brand" | "collection" | null;
  groupKey: string | null;
  productSlugs: string[];
  stockPerProduct: number;
  windowMinutes: number;
  maxRequeue: number;
  startsAt: number;
  endsAt: number | null;
  endedManuallyAt: number | null;
  salePrices: Record<string, number | null>;
};

/** datetime-local reads back Bangkok time, which is the only clock this shop has. */
const toLocalInput = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => {
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * The campaign as the update endpoint wants it back.
 *
 * Everything the dialog does not touch is round-tripped exactly, so editing
 * the closing time cannot quietly drop a banner, a FAQ or a flash price. The
 * prices are either all set or all unset — nothing can produce a mix — so the
 * two cases are the whole of it.
 */
function toUpdateBody(c: Campaign, changes: Partial<Campaign>) {
  const next = { ...c, ...changes };
  const prices = next.salePrices ?? {};
  const fixed = next.productSlugs.every((slug) => typeof prices[slug] === "number");
  return {
    action: "update",
    title: next.title,
    mode: next.mode,
    kind: next.kind,
    heroImage: next.presentation?.heroImage ?? null,
    heroHeadline: next.presentation?.heroHeadline ?? null,
    heroNote: next.presentation?.heroNote ?? null,
    heroAlign: next.presentation?.heroAlign ?? "top",
    accent: next.presentation?.accent ?? null,
    faq: next.presentation?.faq ?? [],
    groupKind: next.groupKind,
    groupKey: next.groupKey,
    productSlugs: next.productSlugs,
    stockPerProduct: next.stockPerProduct,
    windowMinutes: next.windowMinutes,
    maxRequeue: next.maxRequeue,
    startsAt: next.startsAt,
    endsAt: next.endsAt,
    pricing: fixed
      ? { mode: "fixed" as const, prices: Object.fromEntries(next.productSlugs.map((s) => [s, prices[s] as number])) }
      : { mode: "regular" as const },
  };
}

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

/** What the admin needs to know at a glance, in the shop's own words. */
function phaseOf(c: Campaign, now: number) {
  if (c.published === false) return { label: "ปิดเผยแพร่", tone: "bg-slate-100 text-slate-600" };
  if (c.endedManuallyAt) return { label: "ปิดด้วยมือ", tone: "bg-slate-100 text-slate-600" };
  if (c.endsAt && now >= c.endsAt) return { label: "จบแล้ว", tone: "bg-slate-100 text-slate-600" };
  if (now < c.startsAt) return { label: "รอเปิด", tone: "bg-amber-100 text-amber-800" };
  return { label: "กำลังขาย", tone: "bg-emerald-100 text-emerald-800" };
}

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Anchored to the button and rendered fixed: the table scrolls sideways,
  // and a menu positioned inside it gets clipped by that scroll box.
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flash-sale/campaigns", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดรายการแคมเปญไม่สำเร็จ");
      setCampaigns(data.campaigns as Campaign[]);
      // The server's clock decides which campaign is live, not the admin's.
      setNow(typeof data.serverNow === "number" ? data.serverNow : Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายการแคมเปญไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  /** Sends one change and reloads; every row action funnels through here. */
  async function act(c: Campaign, body: unknown, failure: string) {
    setMenu(null);
    setBusy(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/flash-sale/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || failure);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: Campaign) {
    if (!window.confirm(`ลบ "${c.title}" ทิ้ง?\n\nลบแล้วกู้คืนไม่ได้ (แคมเปญที่มีลูกค้าเข้าคิวแล้วจะลบไม่ได้)`)) return;
    setMenu(null);
    setBusy(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/flash-sale/campaigns/${c.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "ลบไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  // Selling again is the one action whose consequence is not obvious: the
  // stock that has already gone stays gone, so a sale reopened without more
  // of it says "ขายหมด" the second it opens.
  function reopen(c: Campaign) {
    if (
      !window.confirm(
        `เปิดขาย "${c.title}" อีกครั้ง?\n\nจะกลับมาขายทันทีจนกว่าของจะหมด — ของที่ขายไปแล้วไม่ได้คืนมา ` +
          `ถ้าอยากเติมสต็อก ให้กดแก้ไขแล้วปรับจำนวนก่อน`
      )
    ) {
      return;
    }
    act(c, { action: "reopen" }, "เปิดขายอีกครั้งไม่สำเร็จ");
  }

  function togglePublished(c: Campaign) {
    const next = c.published === false;
    const message = next
      ? `เผยแพร่ "${c.title}"?\n\nหน้าขายจะเปิดให้ลูกค้าเข้าได้ทันที`
      : `ปิดเผยแพร่ "${c.title}"?\n\nหน้าขายจะขึ้นหน้าไม่พบสำหรับลูกค้า คิวและคำสั่งซื้อที่มีอยู่ยังอยู่ครบ`;
    if (!window.confirm(message)) return;
    act(c, { action: "publish", published: next }, "บันทึกไม่สำเร็จ");
  }

  const sorted = campaigns ? [...campaigns].sort((a, b) => b.startsAt - a.startsAt) : null;

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle>แคมเปญที่สร้างไว้</SectionTitle>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden /> รีเฟรช
        </button>
      </div>

      {error && <p className="rounded-l bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

      {!error && sorted === null && <p className="text-[13px] text-slate-400">กำลังโหลด…</p>}

      {!error && sorted?.length === 0 && (
        <p className="text-[13px] text-slate-500">ยังไม่มีแคมเปญ — กด “สร้างแคมเปญจริง” ด้านบนเพื่อเริ่ม</p>
      )}

      {!error && sorted && sorted.length > 0 && (
        <div className={adminTable.scroll}>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th>แคมเปญ</th>
                <th>สถานะ</th>
                <th>เริ่ม</th>
                <th>ปิด</th>
                <th>สต็อก/ชิ้น</th>
                <th>หน้าขาย</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const phase = phaseOf(c, now);
                return (
                  <tr key={c.id} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <span className="font-semibold text-brand-ink">{c.title}</span>
                      <span className="mt-0.5 block text-[12px] text-slate-400">
                        {c.kind === "special" ? "หน้าแบบมีแบนเนอร์" : "หน้าขายแบบเรียบ"} · {c.productSlugs.length} สินค้า
                      </span>
                    </td>
                    <td className={adminTable.cell}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${phase.tone}`}>
                        {phase.label}
                      </span>
                    </td>
                    <td className={adminTable.muted}>{dateTime(c.startsAt)}</td>
                    <td className={adminTable.muted}>{c.endsAt ? dateTime(c.endsAt) : "จนกว่าของจะหมด"}</td>
                    <td className={adminTable.mono}>{c.stockPerProduct}</td>
                    <td className={adminTable.cell}>
                      <Link
                        href={`/flash-sale/${c.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-800 hover:underline"
                      >
                        เปิดดู <ArrowUpRight size={13} aria-hidden />
                      </Link>
                    </td>
                    <td className={`${adminTable.cell} text-right`}>
                      <span className="relative inline-block">
                        <button
                          type="button"
                          aria-label={`อื่นๆ สำหรับ ${c.title}`}
                          aria-expanded={menu?.id === c.id}
                          disabled={busy === c.id}
                          onClick={(e) => {
                            if (menu?.id === c.id) return setMenu(null);
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenu({ id: c.id, top: r.bottom + 6, right: window.innerWidth - r.right });
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-surface-soft hover:text-brand-ink disabled:opacity-40"
                        >
                          {busy === c.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <MoreHorizontal size={16} aria-hidden />
                          )}
                        </button>
                        {menu?.id === c.id && (
                          <>
                            {/* Anywhere else closes it. */}
                            <button
                              type="button"
                              aria-label="ปิดเมนู"
                              onClick={() => setMenu(null)}
                              className="fixed inset-0 z-20 cursor-default"
                            />
                            <div
                              style={{ top: menu.top, right: menu.right }}
                              className="fixed z-30 w-56 overflow-hidden rounded-l border border-surface-line bg-white py-1 text-left shadow-lg"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setMenu(null);
                                  setEditing(c);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-brand-ink hover:bg-surface-soft"
                              >
                                <Pencil size={14} aria-hidden /> แก้ไข
                              </button>
                              {/* Only where it means something: a sale that
                                  has not finished is already selling. */}
                              {(c.endedManuallyAt || (c.endsAt && now >= c.endsAt)) && (
                                <button
                                  type="button"
                                  onClick={() => reopen(c)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-brand-ink hover:bg-surface-soft"
                                >
                                  <PlayCircle size={14} aria-hidden /> เปิดขายอีกครั้ง
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => togglePublished(c)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-brand-ink hover:bg-surface-soft"
                              >
                                {c.published === false ? (
                                  <>
                                    <Eye size={14} aria-hidden /> เผยแพร่หน้าขาย
                                  </>
                                ) : (
                                  <>
                                    <EyeOff size={14} aria-hidden /> ปิดเผยแพร่
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(c)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 size={14} aria-hidden /> ลบแคมเปญ
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
      )}

      {editing && (
        <EditDialog
          campaign={editing}
          onClose={() => setEditing(null)}
          onSave={async (changes) => {
            const ok = await act(editing, toUpdateBody(editing, changes), "บันทึกไม่สำเร็จ");
            if (ok) setEditing(null);
          }}
        />
      )}
    </Panel>
  );
}

/**
 * Editing the numbers, not the campaign.
 *
 * What goes wrong after a sale is set up is its schedule and its stock —
 * which products it sells and what they cost were decided with the product
 * picker and belong to it. Everything not here is round-tripped untouched, so
 * moving a closing time cannot lose a banner.
 */
function EditDialog({
  campaign,
  onClose,
  onSave,
}: {
  campaign: Campaign;
  onClose: () => void;
  onSave: (changes: Partial<Campaign>) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [startsAt, setStartsAt] = useState(toLocalInput(campaign.startsAt));
  const [endsAt, setEndsAt] = useState(campaign.endsAt ? toLocalInput(campaign.endsAt) : "");
  const [stock, setStock] = useState(String(campaign.stockPerProduct));
  const [windowMinutes, setWindowMinutes] = useState(String(campaign.windowMinutes));
  const [maxRequeue, setMaxRequeue] = useState(String(campaign.maxRequeue));
  const [saving, setSaving] = useState(false);

  const field =
    "mt-1 min-h-10 w-full rounded-l border border-surface-line bg-white px-3 text-[13px] text-brand-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-xl2 bg-white p-5 shadow-lg">
        <h2 className="text-base font-bold text-brand-ink">แก้ไขแคมเปญ</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          สินค้าและราคาแก้ที่นี่ไม่ได้ — ส่วนที่เหลือของแคมเปญจะถูกเก็บไว้เหมือนเดิมทุกอย่าง
        </p>

        <label className="mt-4 block text-[12px] font-semibold text-slate-500">
          ชื่อแคมเปญ
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-semibold text-slate-500">
            เริ่มขาย
            <input type="datetime-local" className={field} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="block text-[12px] font-semibold text-slate-500">
            ปิดการขาย (เว้นว่าง = จนกว่าของจะหมด)
            <input type="datetime-local" className={field} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
          <label className="block text-[12px] font-semibold text-slate-500">
            สต็อกต่อสินค้า
            <input inputMode="numeric" className={field} value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <label className="block text-[12px] font-semibold text-slate-500">
            เวลาชำระเงิน (นาที)
            <input inputMode="numeric" className={field} value={windowMinutes} onChange={(e) => setWindowMinutes(e.target.value)} />
          </label>
          <label className="block text-[12px] font-semibold text-slate-500">
            กลับเข้าคิวได้กี่ครั้ง
            <input inputMode="numeric" className={field} value={maxRequeue} onChange={(e) => setMaxRequeue(e.target.value)} />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-surface-line px-4 py-2 text-[13px] font-semibold text-brand-ink hover:bg-surface-soft"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                title: title.trim(),
                startsAt: fromLocalInput(startsAt) ?? campaign.startsAt,
                endsAt: endsAt ? fromLocalInput(endsAt) : null,
                stockPerProduct: Number(stock),
                windowMinutes: Number(windowMinutes),
                maxRequeue: Number(maxRequeue),
              });
              setSaving(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
