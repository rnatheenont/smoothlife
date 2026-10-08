"use client";

import { useEffect, useState } from "react";
import { Ban, Loader2, Plus, Trash2 } from "lucide-react";
import { Input, TextArea } from "@heroui/react";
import FormDrawer from "@/components/flash-sale-demo/FormDrawer";
import { adminTable } from "@/components/admin/layout-kit";
import { Card } from "@/components/ui";
import { DEFAULT_BLOCKED_REPLY, type KbBlockedTopic } from "@/lib/kb-blocked-topics";

// The other half of the knowledge base: what the assistant must NOT answer.
//
// The articles above say what it may answer from. These say what it must
// refuse whatever it finds — and they go into every reply it writes, not only
// the ones where something similar was retrieved, because a rule that applies
// sometimes is not a rule.

/** Same shape the articles table prints a date in. */
function thaiDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function BlockedTopicsPanel() {
  const [rows, setRows] = useState<KbBlockedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kb/blocked-topics");
      const json = await res.json();
      if (json.ok) setRows(json.rows);
      else setError(json.error ?? "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    const t = topic.trim();
    if (!t) return;
    setBusy("add");
    setError(null);
    const res = await fetch("/api/admin/kb/blocked-topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: t, reply: reply.trim() }),
    });
    const json = await res.json();
    setBusy(null);
    if (!json.ok) {
      setError(json.error ?? "เพิ่มไม่สำเร็จ");
      return;
    }
    setTopic("");
    setReply("");
    setOpen(false);
    load();
  }

  async function toggle(row: KbBlockedTopic) {
    setBusy(row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: !r.enabled } : r)));
    await fetch("/api/admin/kb/blocked-topics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, enabled: !row.enabled }),
    });
    setBusy(null);
    load();
  }

  async function remove(row: KbBlockedTopic) {
    setBusy(row.id);
    await fetch(`/api/admin/kb/blocked-topics?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    setBusy(null);
    load();
  }

  const live = rows.filter((r) => r.enabled).length;

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-brand-ink">
            <Ban size={16} className="text-rose-500" /> เรื่องที่ห้าม AI ตอบ
          </h2>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-slate-500">
            เรื่องในรายการนี้ น้อง Smoothie จะไม่ตอบเลย ไม่ว่าจะมีข้อมูลอยู่ในฐานความรู้หรือหาเจอจากที่อื่น
            และจะเสนอส่งต่อให้ทีมงานแทน — กฎพวกนี้อยู่ในทุกคำตอบ ไม่ใช่เฉพาะตอนที่ระบบค้นเจอเรื่องใกล้เคียง
            {rows.length > 0 && <> · ตอนนี้เปิดอยู่ {live} จาก {rows.length} เรื่อง</>}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
        >
          <Plus size={15} /> เพิ่มเรื่องที่ห้ามตอบ
        </button>
      </div>

      {/* The same drawer the articles use, with the same label-above-field
          pattern: two forms on one screen that fill in the same kind of thing
          should not be two different shapes. */}
      <FormDrawer open={open} title="เพิ่มเรื่องที่ห้ามตอบ" onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="bt-topic" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              เรื่องที่ห้ามตอบ
            </label>
            <Input
              fullWidth
              id="bt-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="เช่น ให้คำแนะนำทางการแพทย์ วินิจฉัยโรค"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              เขียนเป็นเรื่อง ไม่ใช่คำค้น — AI อ่านเข้าใจเอง ลูกค้าถามด้วยคำไหนก็ครอบคลุม
            </p>
          </div>
          <div>
            <label htmlFor="bt-reply" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              ให้ตอบแทนว่าอะไร <span className="font-normal text-slate-400">(เว้นว่างได้)</span>
            </label>
            <TextArea
              fullWidth
              id="bt-reply"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={DEFAULT_BLOCKED_REPLY}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              ถ้าเว้นว่าง จะใช้ว่า “{DEFAULT_BLOCKED_REPLY}” — AI จะพูดด้วยสำนวนของตัวเอง
              และแปลเป็นภาษาที่ลูกค้าใช้ให้เอง ไม่ได้อ่านออกมาตรงๆ
            </p>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            onClick={add}
            disabled={busy === "add" || !topic.trim()}
            className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "add" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            เพิ่มเรื่องที่ห้ามตอบ
          </button>
        </div>
      </FormDrawer>

      {loading ? (
        <p className="mt-3 text-xs text-slate-400">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          ยังไม่มีเรื่องที่ห้ามตอบ — ตอนนี้ AI ตอบได้ทุกเรื่องที่มีในฐานความรู้
        </p>
      ) : (
        <Card padded={false} className="mt-4 overflow-hidden">
          {/* The same table as the articles tab, because the questions asked
              of this list are the same kind: which ones are on, what will the
              customer hear, when did somebody last touch this. Below md each
              row becomes a card — four columns do not fit a phone. */}
          <div className="hidden md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>เรื่องที่ห้ามตอบ</th>
                  <th>ให้ตอบแทนว่า</th>
                  <th className="w-28">สถานะ</th>
                  <th className="w-40">แก้ไขล่าสุด</th>
                  <th className="w-20 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={`${adminTable.row} ${row.enabled ? "" : "opacity-55"}`}>
                    <td className={adminTable.cell}>
                      <span className="font-semibold text-brand-ink">{row.topic}</span>
                      {row.note && (
                        <span className="mt-0.5 block text-[11px] text-slate-400">{row.note}</span>
                      )}
                    </td>
                    <td className={`${adminTable.cell} text-slate-600`}>
                      {row.reply?.trim() || (
                        <span className="text-slate-400">{DEFAULT_BLOCKED_REPLY}</span>
                      )}
                    </td>
                    <td className={adminTable.cell}>
                      <button
                        onClick={() => toggle(row)}
                        disabled={busy === row.id}
                        aria-label={row.enabled ? "ปิดกฎนี้" : "เปิดกฎนี้"}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          row.enabled ? "bg-rose-500" : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                            row.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span className="ml-2 align-middle text-[11px] font-semibold text-slate-500">
                        {row.enabled ? "เปิดอยู่" : "ปิดอยู่"}
                      </span>
                    </td>
                    <td className={adminTable.muted}>{thaiDateTime(row.updated_at)}</td>
                    <td className={`${adminTable.cell} text-right`}>
                      <button
                        onClick={() => remove(row)}
                        disabled={busy === row.id}
                        aria-label="ลบกฎนี้"
                        className="-mr-1 grid size-11 place-items-center text-slate-300 transition-colors hover:text-rose-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 p-3 md:hidden">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex items-start gap-3 rounded-xl border bg-white px-3.5 py-3 ${
                  row.enabled ? "border-rose-100" : "border-slate-100 opacity-60"
                }`}
              >
                <button
                  onClick={() => toggle(row)}
                  disabled={busy === row.id}
                  aria-label={row.enabled ? "ปิดกฎนี้" : "เปิดกฎนี้"}
                  className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
                    row.enabled ? "bg-rose-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                      row.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-ink">{row.topic}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    ตอบแทนว่า: {row.reply?.trim() || DEFAULT_BLOCKED_REPLY}
                  </p>
                </div>
                <button
                  onClick={() => remove(row)}
                  disabled={busy === row.id}
                  aria-label="ลบกฎนี้"
                  className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center text-slate-300 transition-colors hover:text-rose-600"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

    </section>
  );
}
