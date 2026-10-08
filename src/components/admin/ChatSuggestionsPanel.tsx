"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Input } from "@heroui/react";
import FormDrawer from "@/components/flash-sale-demo/FormDrawer";
import { adminTable } from "@/components/admin/layout-kit";
import { Card } from "@/components/ui";

// The questions offered under the AI field on the home page.
//
// It lives with the knowledge base because it is the same job seen from the
// other end: the base is what the assistant can answer, and these are the
// questions customers are nudged towards asking. Keeping them on separate
// screens meant writing a good answer and offering the question that reaches
// it were two errands.
//
// Two kinds in one list. "เขียนเอง" are written here; "จากแชท" come from what
// customers have actually asked, pulled in by the button at the top. Derived
// rows arrive switched off on purpose — the refresh proposes and a person
// publishes, because whatever is on here is shown to every visitor.

type Row = {
  id: string;
  text: string;
  source: "admin" | "auto";
  asked_count: number;
  enabled: boolean;
};

export default function ChatSuggestionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  // Set while editing an existing question; null while writing a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/chat-suggestions");
      const json = await res.json();
      setRows(json.ok ? json.rows : []);
      if (!json.ok) setError(json.error ?? "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditingId(null);
    setDraft("");
    setError(null);
    setOpen(true);
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setDraft(row.text);
    setError(null);
    setOpen(true);
  }

  async function save() {
    const text = draft.trim();
    if (!text) return;
    setBusy("save");
    setError(null);
    const res = await fetch("/api/admin/chat-suggestions", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, text } : { text }),
    });
    const json = await res.json();
    setBusy(null);
    if (!json.ok) {
      setError(json.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setDraft("");
    setEditingId(null);
    setOpen(false);
    load();
  }

  async function toggle(row: Row) {
    setBusy(row.id);
    // Flipped on screen first; load() below is what makes it true.
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: !r.enabled } : r)));
    await fetch("/api/admin/chat-suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, enabled: !row.enabled }),
    });
    setBusy(null);
    load();
  }

  async function remove(row: Row) {
    setBusy(row.id);
    await fetch(`/api/admin/chat-suggestions?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    setBusy(null);
    load();
  }

  async function refresh() {
    setBusy("refresh");
    setError(null);
    setNote(null);
    const res = await fetch("/api/admin/chat-suggestions/refresh", { method: "POST" });
    const json = await res.json();
    setBusy(null);
    if (!json.ok) {
      setError(json.error ?? "ดึงคำถามไม่สำเร็จ");
      return;
    }
    setNote(
      json.added > 0
        ? `พบคำถามที่ถูกถามซ้ำ ${json.added} ข้อ จากข้อความ ${json.scanned} ข้อความ — ขึ้นมาแบบปิดไว้ กดเปิดทีละข้อได้เลย`
        : `ยังไม่มีคำถามที่ถูกถามซ้ำพอจะแนะนำ (อ่าน ${json.scanned} ข้อความ)`
    );
    load();
  }

  const live = rows.filter((r) => r.enabled).length;

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-brand-ink">คำถามแนะนำใต้ช่องถาม AI</h2>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-slate-500">
            ลูกค้าพิมพ์ตัวแรกแล้วคำถามเหล่านี้จะขึ้นมาให้เลือก ช่วยให้ถามได้ตรงกว่าเริ่มจากหน้าว่าง
            {rows.length > 0 && <> · ตอนนี้เปิดอยู่ {live} จาก {rows.length} ข้อ</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={refresh}
            disabled={busy === "refresh"}
            className="flex h-11 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-brand-teal hover:text-brand-800 disabled:opacity-50"
          >
            {busy === "refresh" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            ดึงคำถามยอดฮิตจากแชท
          </button>
          <button
            onClick={startCreate}
            className="flex h-11 items-center gap-1.5 rounded-full bg-brand-gradient px-4 text-sm font-semibold text-white"
          >
            <Plus size={15} /> เพิ่มคำถาม
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
      {note && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">{note}</p>}

      {/* The same drawer and the same label-above-field pattern as the other
          two tabs — three forms on one screen should be one shape. */}
      <FormDrawer
        open={open}
        title={editingId ? "แก้ไขคำถามแนะนำ" : "เพิ่มคำถามแนะนำ"}
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="cs-text" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              คำถาม
            </label>
            <Input
              fullWidth
              id="cs-text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="เช่น ผิวมันเลือกครีมยังไง"
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              เขียนอย่างที่ลูกค้าจะพิมพ์จริง สั้นพอจะอยู่ในชิปได้ — และควรเป็นคำถามที่ฐานความรู้ตอบได้ดีอยู่แล้ว
            </p>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            onClick={save}
            disabled={busy === "save" || !draft.trim()}
            className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {editingId ? "บันทึกการแก้ไข" : "เพิ่มคำถาม"}
          </button>
        </div>
      </FormDrawer>

      {loading ? (
        <p className="mt-3 text-xs text-slate-400">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">ยังไม่มีคำถามแนะนำ</p>
      ) : (
        <Card padded={false} className="mt-4 overflow-hidden">
          <div className="hidden md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>คำถาม</th>
                  <th className="w-44">ที่มา</th>
                  <th className="w-28">สถานะ</th>
                  <th className="w-20 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={`${adminTable.row} ${row.enabled ? "" : "opacity-55"}`}>
                    <td className={adminTable.cell}>
                      <span className="font-semibold text-brand-ink">{row.text}</span>
                    </td>
                    <td className={`${adminTable.cell} text-slate-500`}>
                      {row.source === "auto" ? `จากแชท · ถาม ${row.asked_count} ครั้ง` : "เขียนเอง"}
                    </td>
                    <td className={adminTable.cell}>
                      <button
                        onClick={() => toggle(row)}
                        disabled={busy === row.id}
                        aria-label={row.enabled ? "ปิดคำถามนี้" : "เปิดคำถามนี้"}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          row.enabled ? "bg-brand-gradient" : "bg-slate-200"
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
                    <td className={`${adminTable.cell} text-right`}>
                      <button
                        onClick={() => startEdit(row)}
                        className="mr-1 inline-flex h-11 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-brand-800 hover:bg-surface-soft"
                      >
                        <Pencil size={13} /> แก้ไข
                      </button>
                      <button
                        onClick={() => remove(row)}
                        disabled={busy === row.id}
                        aria-label="ลบคำถามนี้"
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
                className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 ${
                  row.enabled ? "" : "opacity-60"
                }`}
              >
                <button
                  onClick={() => toggle(row)}
                  disabled={busy === row.id}
                  aria-label={row.enabled ? "ปิดคำถามนี้" : "เปิดคำถามนี้"}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    row.enabled ? "bg-brand-gradient" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                      row.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="min-w-0 flex-1 text-sm text-brand-ink">{row.text}</span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {row.source === "auto" ? `จากแชท · ${row.asked_count}` : "เขียนเอง"}
                </span>
                <button
                  onClick={() => startEdit(row)}
                  aria-label="แก้ไขคำถามนี้"
                  className="grid size-11 shrink-0 place-items-center text-slate-400 transition-colors hover:text-brand-800"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(row)}
                  disabled={busy === row.id}
                  aria-label="ลบคำถามนี้"
                  className="-mr-2 grid size-11 shrink-0 place-items-center text-slate-300 transition-colors hover:text-rose-600"
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
