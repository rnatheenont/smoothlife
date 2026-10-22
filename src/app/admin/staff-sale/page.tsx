"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
  CalendarClock,
  Download,
  Lock,
  Package,
  Play,
  Plus,
  ShieldCheck,
  Square,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@heroui/react";
import { Badge } from "@/components/ui";
import AdminField from "@/components/admin/AdminField";
import { PageHeader, Panel, StatCard, adminTable } from "@/components/admin/layout-kit";
import { PHASE_TH, roundPhase, type RoundStatus, type StaffRound } from "@/lib/staff-sale";
import ItemsTab from "./ItemsTab";
import EligibilityTab from "./EligibilityTab";
import OrdersTab from "./OrdersTab";
import type { RoundDetail, RoundWithStats } from "./types";

// The employee shop's console.
//
// Built around one round at a time, because that is how it is run: a round
// opens, a price list is set, people buy, it closes. The tabs are the four
// questions asked of a round in that order — what is it, what is in it, who
// may buy, and what happened — so the page does not need a second screen to
// drill into.

const TABS = [
  { key: "rounds", label: "รอบการซื้อ", icon: CalendarClock },
  { key: "items", label: "สินค้าและราคา", icon: Package },
  { key: "eligibility", label: "สิทธิ์", icon: ShieldCheck },
  { key: "overview", label: "ภาพรวมรอบ", icon: Wallet },
  { key: "orders", label: "ออร์เดอร์", icon: BadgePercent },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * An ISO instant as the value a `datetime-local` input wants.
 *
 * The console is used from Bangkok, so the browser's own offset is the right
 * one — no library, and no second answer about what "09:00" meant.
 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function thaiDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PHASE_TONE: Record<
  ReturnType<typeof roundPhase>,
  "brand" | "neutral" | "success" | "warning" | "info"
> = {
  draft: "neutral",
  upcoming: "info",
  live: "success",
  ended: "warning",
  closed: "neutral",
};

type FormState = {
  name: string;
  starts: string;
  ends: string;
  cap: string;
  window: string;
  maxPerItem: string;
  maxOrders: string;
};

// The defaults are the rules, so a round nobody edits still has them.
const BLANK_FORM: FormState = {
  name: "",
  starts: "",
  ends: "",
  cap: "2000",
  window: "30",
  maxPerItem: "6",
  maxOrders: "1",
};

export default function StaffSalePage() {
  const [tab, setTab] = useState<TabKey>("rounds");
  const [rounds, setRounds] = useState<RoundWithStats[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const loadRounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff-sale/rounds", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "โหลดรอบการซื้อไม่สำเร็จ");
      setRounds(json.rounds);
      setSelected((cur) => cur ?? json.rounds[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรอบการซื้อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/staff-sale/rounds/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "โหลดรอบนี้ไม่สำเร็จ");
      setDetail(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรอบนี้ไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  const round = detail?.round ?? null;
  const selectedSummary = useMemo(
    () => rounds.find((r) => r.id === selected) ?? null,
    [rounds, selected],
  );

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ไม่สำเร็จ");
      if (json.note) setNote(json.note);
      return json as Record<string, unknown>;
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สำเร็จ");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveForm() {
    if (!form) return;
    const starts = fromLocalInput(form.starts);
    const ends = fromLocalInput(form.ends);
    if (!starts || !ends) {
      setError("กรุณากรอกวันเวลาเริ่มและสิ้นสุด");
      return;
    }
    const body = JSON.stringify({
      name: form.name,
      starts_at: starts,
      ends_at: ends,
      cap_thb: Number(form.cap),
      payment_window_min: Number(form.window),
      max_per_item: form.maxPerItem.trim() === "" ? null : Number(form.maxPerItem),
      max_orders: form.maxOrders.trim() === "" ? null : Number(form.maxOrders),
    });
    const json = editing
      ? await send(`/api/admin/staff-sale/rounds/${editing}`, { method: "PATCH", body })
      : await send("/api/admin/staff-sale/rounds", { method: "POST", body });
    if (!json) return;
    setForm(null);
    setEditing(null);
    await loadRounds();
    const created = (json.round as StaffRound | undefined)?.id;
    if (created) {
      // A round with no products is not a round. Creating one lands on its
      // own price list rather than back on the list of rounds, because the
      // next thing to do is always "put the products in" — and each round
      // carries its own products at its own prices.
      setSelected(created);
      setTab("items");
      setNote("สร้างรอบแล้ว (ยังเป็นร่าง) — เลือกสินค้าและตั้งราคาของรอบนี้ต่อได้เลย");
    } else if (editing) {
      await loadDetail(editing);
    }
  }

  async function setStatus(id: string, status: RoundStatus) {
    const json = await send(`/api/admin/staff-sale/rounds/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!json) return;
    await loadRounds();
    if (id === selected) await loadDetail(id);
  }

  async function removeRound(id: string) {
    if (!confirm("ลบรอบนี้? ลบได้เฉพาะรอบที่ยังเป็นร่างและไม่มีคำสั่งซื้อ")) return;
    const json = await send(`/api/admin/staff-sale/rounds/${id}`, { method: "DELETE" });
    if (!json) return;
    if (selected === id) setSelected(null);
    await loadRounds();
  }

  const overview = detail?.overview;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Users className="h-5 w-5 text-brand-700" aria-hidden />}
        title="ร้านพนักงาน"
        subtitle="รอบการซื้อ ราคาพนักงาน วงเงินต่อคน และสิทธิ์ของพนักงาน"
        actions={
          <Button
            size="sm"
            onPress={() => {
              setEditing(null);
              setForm(BLANK_FORM);
            }}
            isDisabled={busy}
          >
            <Plus className="h-4 w-4" aria-hidden />
            เปิดรอบใหม่
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl2 bg-rose-50 p-3 text-[13px] text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}
      {note && (
        <div className="rounded-xl2 bg-sky-50 p-3 text-[13px] text-sky-800">{note}</div>
      )}

      {/* Which round everything else on the page is about. A select rather
          than a sidebar: there is one round a month, and on a phone a list of
          rounds down the side is the whole screen. */}
      {rounds.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[12px] font-medium text-slate-500">
            รอบที่กำลังดู
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value || null)}
              className="h-10 rounded-xl2 border border-slate-200 bg-white px-3 text-[13px] text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {PHASE_TH[roundPhase(r)]}
                </option>
              ))}
            </select>
          </label>
          {round && (
            <div className="flex flex-wrap items-center gap-2 pb-1 text-[12px] text-slate-500">
              <Badge tone={PHASE_TONE[roundPhase(round)]}>{PHASE_TH[roundPhase(round)]}</Badge>
              <span>
                {thaiDateTime(round.starts_at)} – {thaiDateTime(round.ends_at)}
              </span>
              <span>· วงเงิน {baht(round.cap_thb)} บาท/คน</span>
              <span>· ให้เวลาจ่าย {round.payment_window_min} นาที</span>
            </div>
          )}
        </div>
      )}

      {/* Scrolls sideways on a phone rather than wrapping into two rows of
          tabs, which reads as two toolbars. */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="tablist" className="flex min-w-max gap-1 rounded-xl2 bg-surface-soft p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 ${
                  active ? "bg-white text-brand-800 shadow-sm" : "text-slate-500 hover:text-brand-800"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {form && (
        <Panel title={editing ? "แก้ไขรอบการซื้อ" : "รอบการซื้อใหม่"} padded>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField
              label="ชื่อรอบ"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="เช่น ร้านพนักงาน พฤศจิกายน 2569"
              isRequired
              className="sm:col-span-2"
            />
            <AdminField
              label="เริ่มขาย"
              type="datetime-local"
              value={form.starts}
              onChange={(v) => setForm({ ...form, starts: v })}
              isRequired
            />
            <AdminField
              label="ปิดขาย"
              type="datetime-local"
              value={form.ends}
              onChange={(v) => setForm({ ...form, ends: v })}
              isRequired
            />
            <AdminField
              label="วงเงินต่อคน (บาท)"
              type="number"
              inputMode="decimal"
              value={form.cap}
              onChange={(v) => setForm({ ...form, cap: v })}
              hint="แก้แล้วมีผลกับคนที่ยืนยันอีเมลไปแล้วด้วย — ยกเว้นคนที่ใช้หรือกันวงเงินไปเกินตัวเลขใหม่ จะลดลงได้แค่เท่าที่ใช้ไป"
              isRequired
            />
            <AdminField
              label="เวลาที่ให้ชำระเงิน (นาที)"
              type="number"
              value={form.window}
              onChange={(v) => setForm({ ...form, window: v })}
              hint="5–180 นาที · หน้าชำระเงินและการกันสิทธิ์จะหมดอายุพร้อมกัน"
              isRequired
            />
            {/* The two rules, set once for the whole round instead of typed
                on every product. A row in the price list can still be
                stricter; the database takes whichever bites first. */}
            <AdminField
              label="ซื้อได้สูงสุดต่อสินค้า (ชิ้น/คน)"
              type="number"
              value={form.maxPerItem}
              onChange={(v) => setForm({ ...form, maxPerItem: v })}
              hint="ใช้กับทุกสินค้าในรอบนี้ · เว้นว่าง = ไม่จำกัด · ตั้งรายสินค้าให้น้อยกว่านี้ได้"
            />
            <AdminField
              label="ซื้อได้กี่ครั้งต่อรอบ (ต่อคน)"
              type="number"
              value={form.maxOrders}
              onChange={(v) => setForm({ ...form, maxOrders: v })}
              hint="นับเฉพาะที่จ่ายแล้วและที่รอชำระ · ออร์เดอร์ที่ยกเลิกหรือคืนเงินไม่นับ · เว้นว่าง = ไม่จำกัด"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onPress={saveForm} isDisabled={busy}>
              {editing ? "บันทึก" : "สร้างเป็นร่าง"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setForm(null);
                setEditing(null);
              }}
            >
              ยกเลิก
            </Button>
          </div>
        </Panel>
      )}

      {tab === "rounds" && (
        <Panel title="รอบการซื้อทั้งหมด">
          <div className={adminTable.scroll}>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>รอบ</th>
                  <th>ช่วงเวลา</th>
                  <th>วงเงิน/คน</th>
                  <th>ยืนยันแล้ว</th>
                  <th>ซื้อแล้ว</th>
                  <th>ยอดขาย</th>
                  <th>สถานะ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className={adminTable.muted} colSpan={8}>
                      กำลังโหลด…
                    </td>
                  </tr>
                )}
                {!loading && rounds.length === 0 && (
                  <tr>
                    <td className={adminTable.muted} colSpan={8}>
                      ยังไม่มีรอบการซื้อ — กด “เปิดรอบใหม่” เพื่อเริ่ม
                    </td>
                  </tr>
                )}
                {rounds.map((r) => {
                  const phase = roundPhase(r);
                  return (
                    <tr key={r.id} className={adminTable.row}>
                      <td className={adminTable.cell}>
                        <button
                          onClick={() => setSelected(r.id)}
                          className="text-left font-semibold text-brand-800 hover:underline"
                        >
                          {r.name}
                        </button>
                        {r.stats.pending > 0 && (
                          <p className="text-[11px] text-amber-700">
                            รอชำระ {r.stats.pending} รายการ
                          </p>
                        )}
                      </td>
                      <td className={adminTable.muted}>
                        {thaiDateTime(r.starts_at)}
                        <br />
                        {thaiDateTime(r.ends_at)}
                      </td>
                      <td className={adminTable.mono}>{baht(r.cap_thb)}</td>
                      <td className={adminTable.mono}>{r.stats.verified}</td>
                      <td className={adminTable.mono}>{r.stats.buyers}</td>
                      <td className={adminTable.mono}>{baht(r.stats.sold_thb)}</td>
                      <td className={adminTable.cell}>
                        <Badge tone={PHASE_TONE[phase]}>{PHASE_TH[phase]}</Badge>
                      </td>
                      <td className={adminTable.cell}>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {r.status !== "open" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => setStatus(r.id, "open")}
                              isDisabled={busy}
                            >
                              <Play className="h-3.5 w-3.5" aria-hidden />
                              เปิดขาย
                            </Button>
                          )}
                          {r.status === "open" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => setStatus(r.id, "closed")}
                              isDisabled={busy}
                            >
                              <Square className="h-3.5 w-3.5" aria-hidden />
                              ปิดรอบ
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => {
                              setEditing(r.id);
                              setForm({
                                name: r.name,
                                starts: toLocalInput(r.starts_at),
                                ends: toLocalInput(r.ends_at),
                                cap: String(r.cap_thb),
                                window: String(r.payment_window_min),
                                maxPerItem: r.max_per_item == null ? "" : String(r.max_per_item),
                                maxOrders: r.max_orders == null ? "" : String(r.max_orders),
                              });
                            }}
                          >
                            แก้ไข
                          </Button>
                          {r.status === "draft" && r.stats.buyers === 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => removeRound(r.id)}
                              isDisabled={busy}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 p-3 text-[12px] text-slate-500">
            ตั้งรอบถัดไปทิ้งไว้ล่วงหน้าได้ — กด “เปิดขาย” ไว้พร้อมวันเวลาในอนาคต แล้วรอบจะเปิดเองเมื่อถึงเวลา
            ห้ามเฉพาะรอบที่ช่วงเวลาทับกัน เพราะพนักงานจะได้วงเงินสองก้อนพร้อมกัน
          </p>
        </Panel>
      )}

      {tab === "items" &&
        (round ? (
          <ItemsTab
            roundId={round.id}
            items={detail?.items ?? []}
            busy={busy}
            otherRounds={rounds.filter((r) => r.id !== round.id).map((r) => ({ id: r.id, name: r.name }))}
            onError={setError}
            onReload={() => loadDetail(round.id)}
          />
        ) : (
          <Panel padded>
            <p className="text-[13px] text-slate-500">เลือกรอบการซื้อก่อน</p>
          </Panel>
        ))}

      {tab === "eligibility" && <EligibilityTab busy={busy} onError={setError} onNote={setNote} />}

      {tab === "overview" &&
        (round && overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="ยืนยันอีเมลแล้ว"
                value={overview.verified}
                unit="คน"
                icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
              />
              <StatCard label="ซื้อแล้ว" value={overview.buyers} unit="คน" />
              <StatCard label="ยอดขาย" value={baht(overview.sold_thb)} unit="บาท" />
              <StatCard
                label="รอชำระเงิน"
                value={overview.orders_pending}
                unit="รายการ"
                tone={overview.orders_pending > 0 ? "alert" : "plain"}
              />
            </div>

            {(overview.needs_refund > 0 || overview.sync_failed > 0) && (
              <div className="flex items-start gap-2 rounded-xl2 bg-amber-50 p-3 text-[13px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {overview.needs_refund > 0 && <>ต้องคืนเงิน {overview.needs_refund} รายการ </>}
                  {overview.sync_failed > 0 && (
                    <>· สร้างออร์เดอร์ใน Shopify ไม่สำเร็จ {overview.sync_failed} รายการ </>
                  )}
                  — ดูที่แท็บออร์เดอร์
                </p>
              </div>
            )}

            <Panel
              title="วงเงินที่ใช้ต่อคน"
              toolbar={
                <a
                  href={`/api/admin/staff-sale/rounds/${round.id}/export`}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-800 ring-1 ring-surface-line hover:ring-brand-800/50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  ส่งออก CSV
                </a>
              }
            >
              <div className={`${adminTable.scroll} max-h-[420px]`}>
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th>อีเมลพนักงาน</th>
                      <th>ยืนยันเมื่อ</th>
                      <th>วงเงิน</th>
                      <th>ใช้ไป</th>
                      <th>กันไว้</th>
                      <th>เหลือ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.verifications.length === 0 && (
                      <tr>
                        <td className={adminTable.muted} colSpan={6}>
                          ยังไม่มีใครยืนยันอีเมลในรอบนี้
                        </td>
                      </tr>
                    )}
                    {detail.verifications.map((v) => {
                      const e = detail.entitlements.find((x) => x.user_id === v.user_id);
                      const left = e ? e.cap_thb - e.spent_thb - e.reserved_thb : 0;
                      return (
                        <tr key={v.user_id} className={adminTable.row}>
                          <td className={adminTable.cell}>{v.staff_email_canonical}</td>
                          <td className={adminTable.muted}>{thaiDateTime(v.verified_at)}</td>
                          <td className={adminTable.mono}>{e ? baht(e.cap_thb) : "—"}</td>
                          <td className={adminTable.mono}>{e ? baht(e.spent_thb) : "—"}</td>
                          <td className={adminTable.mono}>{e ? baht(e.reserved_thb) : "—"}</td>
                          <td className={adminTable.mono}>{e ? baht(left) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="สินค้าที่ขายได้มากที่สุด">
              <div className={adminTable.scroll}>
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th>สินค้า</th>
                      <th>ตัวเลือก</th>
                      <th>ขายได้</th>
                      <th>ยอดเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.top.length === 0 && (
                      <tr>
                        <td className={adminTable.muted} colSpan={4}>
                          ยังไม่มียอดขายในรอบนี้
                        </td>
                      </tr>
                    )}
                    {overview.top.map((t) => (
                      <tr key={t.variant_id} className={adminTable.row}>
                        <td className={adminTable.cell}>{t.slug}</td>
                        <td className={adminTable.mono}>{t.variant_id.split("/").pop()}</td>
                        <td className={adminTable.mono}>{t.qty}</td>
                        <td className={adminTable.mono}>{baht(t.thb)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        ) : (
          <Panel padded>
            <p className="text-[13px] text-slate-500">เลือกรอบการซื้อก่อน</p>
          </Panel>
        ))}

      {tab === "orders" && (
        <OrdersTab
          roundId={selected}
          roundName={selectedSummary?.name ?? null}
          onReload={() => selected && loadDetail(selected)}
        />
      )}

      <p className="flex items-start gap-1.5 text-[12px] text-slate-400">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        ราคาพนักงานไม่ถูกส่งไปที่เบราว์เซอร์ของลูกค้า และหน้า /staff ไม่ถูกเก็บโดย Google
      </p>
    </div>
  );
}
