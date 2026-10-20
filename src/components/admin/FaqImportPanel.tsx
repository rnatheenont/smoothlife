"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Link2, Undo2, ClipboardPaste } from "lucide-react";
import clsx from "clsx";
import { Panel, adminTable } from "@/components/admin/layout-kit";
import type { PreviewRow, RowStatus } from "@/lib/faq-import/preview";
import type { ImportFormat } from "@/lib/faq-import/parse";

// Bringing a document in, one decision at a time.
//
// The shape of the screen is the shape of the plan's five steps: pick a
// source, look at what it would do, tick the rows, confirm, and be able to
// undo it. The middle step is the one that matters — the whole reason the
// parse and the commit are different requests is so a person can stand
// between them.

type PreviewResponse = {
  ok: boolean;
  error?: string;
  format?: ImportFormat;
  fileName?: string | null;
  sourceUrl?: string | null;
  skipped?: string[];
  counts?: Record<string, number>;
  rows?: PreviewRow[];
};

type CommitResult = { batchId: string; created: number; updated: number; indexed: number; total: number };

const STATUS: Record<RowStatus, { label: string; className: string }> = {
  new: { label: "ใหม่", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  update: { label: "อัปเดต", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  duplicate: { label: "อาจซ้ำ", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  conflict: { label: "ขัดแย้ง", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  invalid: { label: "ใช้ไม่ได้", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const FIELD_TH: Record<string, string> = {
  question_th: "คำถาม",
  answer_th: "คำตอบ",
  question_en: "คำถาม EN",
  answer_en: "คำตอบ EN",
  keywords: "คำค้น",
  topic: "หัวข้อ",
  concerns: "ปัญหา",
  brands: "แบรนด์",
  product_slugs: "สินค้า",
  cta_label: "ปุ่ม",
  cta_href: "ลิงก์ปุ่ม",
};

export default function FaqImportPanel() {
  const [mode, setMode] = useState<"link" | "paste" | "file">("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CommitResult | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function readDocument() {
    setBusy(true);
    setError(null);
    setPreview(null);
    setResult(null);
    setUndone(null);
    try {
      const res = await fetch("/api/admin/kb/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "link" ? { url } : { text }),
      });
      const data: PreviewResponse = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "อ่านเอกสารไม่สำเร็จ");
      setPreview(data);
      // Pre-ticked is the parser's recommendation, not a decision: new rows
      // and real changes only.
      setPicked(new Set((data.rows ?? []).filter((r) => r.selected).map((r) => r.item.source_ref)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "อ่านเอกสารไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setText(await file.text());
    setMode("paste");
  }

  async function commit() {
    if (!preview?.rows) return;
    const items = preview.rows.filter((r) => picked.has(r.item.source_ref)).map((r) => r.item);
    if (items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/kb/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, sourceUrl: preview.sourceUrl, fileName: preview.fileName, format: preview.format }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "นำเข้าไม่สำเร็จ");
      setResult(data);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/kb/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: result.batchId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "ย้อนกลับไม่สำเร็จ");
      setUndone(
        `ย้อนกลับแล้ว — ลบ ${data.deleted} ข้อ · คืนค่า ${data.restored} ข้อ` +
          (data.keptPublished ? ` · เก็บไว้ ${data.keptPublished} ข้อที่ถูก publish ไปแล้ว` : "")
      );
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ย้อนกลับไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const rows = preview?.rows ?? [];
  const usable = rows.filter((r) => r.status !== "invalid");
  const allPicked = usable.length > 0 && usable.every((r) => picked.has(r.item.source_ref));

  return (
    <div className="space-y-4">
      <Panel title="นำเข้าคำถาม" icon={<FileUp size={15} className="text-brand-emerald" />} padded>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(
            [
              { key: "link", label: "ลิงก์ Google Docs / Sheets", icon: Link2 },
              { key: "paste", label: "วางข้อความ", icon: ClipboardPaste },
              { key: "file", label: "อัปโหลดไฟล์ CSV / JSON", icon: FileUp },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={clsx(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                mode === key ? "bg-brand-800 text-white" : "bg-white text-slate-600 ring-1 ring-surface-line hover:text-brand-ink"
              )}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {mode === "link" && (
          <div className="space-y-1.5">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/…"
              className="h-10 w-full rounded-lg px-3 text-sm ring-1 ring-surface-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            />
            <p className="text-[12px] text-slate-500">
              เอกสารต้องตั้งเป็น “ทุกคนที่มีลิงก์ดูได้” ก่อน ระบบรับเฉพาะลิงก์จาก docs.google.com
            </p>
          </div>
        )}

        {mode === "paste" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="วางเนื้อหาจาก Google Docs, Word, CSV หรือ JSON ที่นี่ — ระบบตรวจรูปแบบให้เอง"
            className="w-full rounded-lg p-3 font-mono text-[12px] ring-1 ring-surface-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          />
        )}

        {mode === "file" && (
          <div className="space-y-1.5">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,.txt,text/csv,application/json,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
              className="block w-full text-sm file:mr-3 file:h-9 file:rounded-full file:border-0 file:bg-brand-800 file:px-4 file:text-[13px] file:font-semibold file:text-white"
            />
            <a href="/api/admin/kb/export?format=csv" className="text-[12px] font-semibold text-brand-800 hover:underline">
              ดาวน์โหลดไฟล์ตัวอย่าง (ส่งออกของที่มีอยู่เป็น CSV)
            </a>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={readDocument}
            disabled={busy || (mode === "link" ? !url.trim() : !text.trim())}
            className="inline-flex h-10 items-center rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000 disabled:opacity-50"
          >
            {busy ? "กำลังอ่าน…" : "อ่านเอกสาร"}
          </button>
          <span className="text-[12px] text-slate-500">อ่านอย่างเดียว ยังไม่เขียนอะไรลงระบบ</span>
        </div>

        {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-[13px] text-rose-700">{error}</p>}
      </Panel>

      {result && (
        <Panel title="นำเข้าแล้ว" padded>
          <p className="text-[13px] text-brand-ink">
            สร้างใหม่ {result.created} ข้อ · อัปเดต {result.updated} ข้อ · สร้าง index ให้ AI แล้ว {result.indexed} ข้อ
            <br />
            <span className="text-slate-500">ทุกข้อเข้าเป็น draft — ยังไม่มีอะไรถึงลูกค้าจนกว่าจะกด publish</span>
          </p>
          <button
            type="button"
            onClick={rollback}
            disabled={busy}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
          >
            <Undo2 size={14} aria-hidden />
            ย้อนกลับการนำเข้าครั้งนี้
          </button>
        </Panel>
      )}

      {undone && <p className="rounded-lg bg-emerald-50 p-3 text-[13px] text-emerald-800">{undone}</p>}

      {preview && (
        <Panel
          title={`พรีวิว ${rows.length} ข้อ`}
          toolbar={
            <span className="text-[12px] text-slate-500">
              {preview.format} · ใหม่ {preview.counts?.new ?? 0} · อัปเดต {preview.counts?.update ?? 0} · อาจซ้ำ{" "}
              {preview.counts?.duplicate ?? 0} · ขัดแย้ง {preview.counts?.conflict ?? 0} · ใช้ไม่ได้{" "}
              {preview.counts?.invalid ?? 0}
            </span>
          }
        >
          {(preview.skipped?.length ?? 0) > 0 && (
            <div className="border-b border-slate-100 p-3 text-[12px] text-amber-700">
              ข้ามไป {preview.skipped!.length} บรรทัด: {preview.skipped!.slice(0, 3).join(" · ")}
              {preview.skipped!.length > 3 && " …"}
            </div>
          )}

          <div className={clsx(adminTable.scroll, "max-h-[60vh]")}>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      aria-label="เลือกทั้งหมดที่นำเข้าได้"
                      onChange={(e) =>
                        setPicked(new Set(e.target.checked ? usable.map((r) => r.item.source_ref) : []))
                      }
                    />
                  </th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2">คำถาม</th>
                  <th className="px-3 py-2">จะเปลี่ยนอะไร</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUS[r.status];
                  const on = picked.has(r.item.source_ref);
                  return (
                    <tr key={r.item.source_ref} className={adminTable.row}>
                      <td className={adminTable.cell}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={r.status === "invalid"}
                          aria-label={`เลือก ${r.item.question_th}`}
                          onChange={(e) =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(r.item.source_ref);
                              else next.delete(r.item.source_ref);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className={adminTable.cell}>
                        <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", s.className)}>
                          {s.label}
                        </span>
                      </td>
                      <td className={adminTable.cell}>
                        <span className="font-medium text-brand-ink">{r.item.question_th || "—"}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{r.item.source_ref}</span>
                        {r.note && <span className="block text-[11px] text-amber-700">{r.note}</span>}
                      </td>
                      <td className={adminTable.cell}>
                        {r.issues.length > 0 && (
                          <ul className="mb-1 space-y-0.5">
                            {r.issues.map((i, n) => (
                              <li
                                key={n}
                                className={clsx("text-[11px]", i.level === "block" ? "text-rose-700" : "text-amber-700")}
                              >
                                {i.level === "block" ? "⛔" : "⚠"} {i.message}
                              </li>
                            ))}
                          </ul>
                        )}
                        {r.status === "update" && (
                          <span className="text-[11px] text-slate-500">
                            {r.changed.length === 0
                              ? "ไม่มีฟิลด์ไหนเปลี่ยน"
                              : r.changed.map((f) => FIELD_TH[f] ?? f).join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={commit}
              disabled={busy || picked.size === 0}
              className="inline-flex h-10 items-center rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000 disabled:opacity-50"
            >
              {busy ? "กำลังนำเข้า…" : `นำเข้า ${picked.size} ข้อเป็น draft`}
            </button>
            <span className="text-[12px] text-slate-500">ย้อนกลับได้หลังนำเข้า</span>
          </div>
        </Panel>
      )}

      <Panel title="ส่งออก" icon={<Download size={15} className="text-brand-emerald" />} padded>
        <p className="mb-2 text-[13px] text-slate-600">
          ใช้สำรองข้อมูล หรือส่งให้ทีมคอนเทนต์แก้ใน Google Sheets แล้วนำกลับเข้ามาทางแท็บนี้ — คอลัมน์ตรงกับที่ตัวนำเข้าอ่าน
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/admin/kb/export?format=csv"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft"
          >
            <Download size={14} aria-hidden />
            CSV
          </a>
          <a
            href="/api/admin/kb/export?format=json"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft"
          >
            <Download size={14} aria-hidden />
            JSON
          </a>
        </div>
      </Panel>
    </div>
  );
}
