"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Download, Loader2, Plus, Trash2 } from "lucide-react";
import ImagePicker from "@/components/admin/pages/ImagePicker";
import { parseSlugList } from "@/lib/pages/edit";
import { joinLText, splitLText, type LText } from "@/lib/i18n/localized";
import type { FieldDef } from "@/lib/pages/types";

// The right-hand panel: one section's settings, built from the field list its
// definition declares.
//
// The form is generated rather than written per section, so adding a section
// to the library cannot leave it without a form — the thing that decides what
// it stores and the thing that asks for it are the same declaration.
//
// The rule every control here follows: edit the value in its own shape. A
// list is edited as a list, not as a comma-joined string that comes back as
// a string and knocks the section out of its schema. A control that destroys
// what it edits is worse than one that looks unfinished.

type Settings = Record<string, unknown>;

const labelCls = "block text-[13px] font-semibold text-brand-ink";
const helpCls = "mt-1 text-[12px] leading-relaxed text-slate-500";
const inputCls =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-hidden transition-colors focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30";

/** The Thai box and the English box, stacked. */
function LocalizedInput({
  id,
  label,
  help,
  placeholder,
  multiline,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  placeholder?: string;
  multiline?: boolean;
  value: unknown;
  onChange: (next: LText) => void;
}) {
  const { th, en } = splitLText(value);
  const common = multiline ? `${inputCls} h-auto py-2.5` : inputCls;

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          value={th}
          placeholder={placeholder}
          onChange={(e) => onChange(joinLText(e.target.value, en))}
          className={common}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={th}
          placeholder={placeholder}
          onChange={(e) => onChange(joinLText(e.target.value, en))}
          className={common}
        />
      )}
      <label htmlFor={`${id}-en`} className="mt-2 block text-[12px] font-semibold text-slate-500">
        English
      </label>
      {multiline ? (
        <textarea
          id={`${id}-en`}
          rows={3}
          value={en}
          onChange={(e) => onChange(joinLText(th, e.target.value))}
          className={`${inputCls} mt-1 h-auto py-2.5`}
        />
      ) : (
        <input
          id={`${id}-en`}
          type="text"
          value={en}
          onChange={(e) => onChange(joinLText(th, e.target.value))}
          className={`${inputCls} mt-1`}
        />
      )}
      {!en.trim() && (
        <p className={helpCls}>ยังไม่มีคำแปล — หน้าภาษาอังกฤษจะใช้ข้อความไทยไปก่อน</p>
      )}
      {help && <p className={helpCls}>{help}</p>}
    </div>
  );
}

/**
 * JSON, held as text while it is being typed.
 *
 * Halfway through editing, JSON is almost always invalid — the moment after
 * you type `[` there is no closing bracket. Committing on every keystroke
 * would throw the value away as soon as editing began, so the text lives
 * here and only reaches the document when it parses. The box says which of
 * the two states it is in, because an edit that is not being saved has to
 * look different from one that is.
 */
function JsonField({
  label,
  help,
  value,
  onCommit,
}: {
  label: string;
  help?: string;
  value: unknown;
  onCommit: (next: unknown) => void;
}) {
  const serialised = JSON.stringify(value ?? null, null, 2);
  const [text, setText] = useState(serialised);
  const [error, setError] = useState<string | null>(null);

  // Follow the document when the selection moves to another section, but not
  // while this one is being typed into — that would overwrite the cursor.
  useEffect(() => {
    setText(serialised);
    setError(null);
  }, [serialised]);

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        rows={12}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onCommit(JSON.parse(e.target.value));
            setError(null);
          } catch {
            setError("ยังไม่ใช่ JSON ที่อ่านได้ — ยังไม่บันทึกจนกว่าจะถูกต้อง");
          }
        }}
        className={`${inputCls} h-auto py-2.5 font-mono text-[12px] leading-relaxed ${
          error ? "border-amber-300 bg-amber-50/40" : ""
        }`}
      />
      {error ? <p className="mt-1 text-[12px] text-amber-700">{error}</p> : help && <p className={helpCls}>{help}</p>}
    </div>
  );
}

/** One row of a banner list. Empty strings rather than undefined, so the
 *  shape of a new row is the shape the schema expects. */
export type BannerRow = { image: string; mobileImage: string; href: string; title: string };

function asRows(value: unknown): BannerRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      image: typeof r.image === "string" ? r.image : "",
      mobileImage: typeof r.mobileImage === "string" ? r.mobileImage : "",
      href: typeof r.href === "string" ? r.href : "",
      title: typeof r.title === "string" ? r.title : "",
    };
  });
}

/**
 * The banner list: a card per slide, in the order they appear on the page.
 *
 * Reordering is two buttons rather than a drag, unlike the section list on
 * the left. A drag needs somewhere to drag within, and this panel is one
 * column of cards that each hold a picture-picker which opens a dialog of
 * its own; the buttons work the same for a mouse, a keyboard and a thumb,
 * and there are rarely more than four of these.
 */

/** One row of a `list` field, as plain objects. Anything that is not an
 *  object is dropped rather than guessed at — a stored list that has been
 *  hand-edited into the wrong shape should lose the broken row, not the
 *  whole field. */
function asListRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object" && !Array.isArray(r))
    : [];
}

/**
 * A list of rows, edited as rows.
 *
 * The replacement for a JSON box on the shape that is actually common — four
 * branches, five tabs, three cards. The JSON box asked an admin to know
 * where the commas go, and punished a missing brace by dropping the whole
 * section from the page; this cannot be typed into an invalid state at all.
 *
 * Rows are added at the end and never silently reordered, because the order
 * on screen is the order on the page.
 */
function ListField({
  label,
  help,
  item,
  columns,
  max,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  item: string;
  columns: Extract<FieldDef, { type: "list" }>["columns"];
  max?: number;
  value: unknown;
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const rows = asListRows(value);
  const full = typeof max === "number" && rows.length >= max;

  const setCell = (i: number, key: string, cell: unknown) =>
    onChange(rows.map((row, j) => (j === i ? { ...row, [key]: cell } : row)));

  const move = (i: number, delta: number) => {
    const to = i + delta;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <div>
      <span className={labelCls}>{label}</span>
      {help && <p className={helpCls}>{help}</p>}

      <div className="mt-2 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl2 border border-slate-200 bg-surface-mist/60 p-3">
            <div className="mb-2 flex items-center gap-1">
              <span className="flex-1 text-[12px] font-semibold text-brand-ink">
                {item} {i + 1}
              </span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`ย้าย${item} ${i + 1} ขึ้น`}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-800 disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                aria-label={`ย้าย${item} ${i + 1} ลง`}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-800 disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`ลบ${item} ${i + 1}`}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {columns.map((col) => {
                const cell = row[col.key];
                const text = typeof cell === "string" ? cell : cell == null ? "" : String(cell);

                // A two-language cell gets its own pair of boxes. It has to
                // come before `text` is used: String({th, en}) is
                // "[object Object]", and an admin who opens this row and
                // saves it would write that into the document.
                if (col.localized) {
                  const { th, en } = splitLText(cell);
                  const box = col.type === "textarea";
                  return (
                    // A div, not a label: two controls cannot share one
                    // label, and the row below names them itself.
                    <div key={col.key} className={col.half ? "" : "col-span-2"}>
                      <span className="block text-[12px] font-medium text-slate-600">{col.label}</span>
                      {box ? (
                        <textarea
                          value={th}
                          rows={3}
                          placeholder={col.placeholder}
                          aria-label={col.label}
                          onChange={(e) => setCell(i, col.key, joinLText(e.target.value, en))}
                          className={`${inputCls} h-auto py-2.5`}
                        />
                      ) : (
                        <input
                          value={th}
                          placeholder={col.placeholder}
                          aria-label={col.label}
                          onChange={(e) => setCell(i, col.key, joinLText(e.target.value, en))}
                          className={inputCls}
                        />
                      )}
                      <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">English</span>
                      {box ? (
                        <textarea
                          value={en}
                          rows={2}
                          aria-label={`${col.label} (English)`}
                          onChange={(e) => setCell(i, col.key, joinLText(th, e.target.value))}
                          className={`${inputCls} mt-1 h-auto py-2.5`}
                        />
                      ) : (
                        <input
                          value={en}
                          aria-label={`${col.label} (English)`}
                          onChange={(e) => setCell(i, col.key, joinLText(th, e.target.value))}
                          className={`${inputCls} mt-1`}
                        />
                      )}
                    </div>
                  );
                }

                return (
                  <label key={col.key} className={col.half ? "" : "col-span-2"}>
                    <span className="block text-[12px] font-medium text-slate-600">{col.label}</span>
                    {col.type === "select" ? (
                      <select
                        value={text}
                        onChange={(e) => setCell(i, col.key, e.target.value)}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {(col.options ?? []).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : col.type === "image" ? (
                      <ImagePicker value={text} onChange={(url) => setCell(i, col.key, url)} />
                    ) : col.type === "textarea" ? (
                      <textarea
                        value={text}
                        rows={3}
                        placeholder={col.placeholder}
                        onChange={(e) => setCell(i, col.key, e.target.value)}
                        className={`${inputCls} h-auto py-2.5`}
                      />
                    ) : (
                      <input
                        value={text}
                        placeholder={col.placeholder}
                        onChange={(e) => setCell(i, col.key, e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!full && (
        <button
          type="button"
          onClick={() => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, ""]))])}
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[13px] font-semibold text-slate-500 hover:border-brand-teal hover:text-brand-800"
        >
          <Plus size={15} /> เพิ่ม{item}
        </button>
      )}
      {full && <p className={helpCls}>ใส่ได้สูงสุด {max} รายการ</p>}
    </div>
  );
}

function BannerListField({
  label,
  help,
  max,
  importFrom,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  max?: number;
  importFrom?: { url: string; label: string; help?: string; also?: Record<string, unknown> };
  value: unknown;
  onChange: (next: BannerRow[], also?: Record<string, unknown>) => void;
}) {
  const rows = asRows(value);
  const full = typeof max === "number" && rows.length >= max;
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  /**
   * Brings in the banners that are being pulled right now.
   *
   * Adds, never replaces: the rows already here were typed by someone, and
   * a button that wipes them is a button nobody can press twice. Anything
   * whose picture is already in the list is skipped, so pressing it again
   * after adding one of your own does not produce the same banner twice.
   */
  async function runImport() {
    if (!importFrom) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(importFrom.url);
      const data = await res.json();
      const incoming = asRows(data?.banners);
      if (!res.ok || !data?.ok || incoming.length === 0) {
        setImportError("ยังดึงแบนเนอร์ไม่ได้ — ลองใหม่อีกครั้ง");
        return;
      }
      const have = new Set(rows.map((r) => r.image));
      const added = incoming.filter((r) => r.image && !have.has(r.image));
      if (added.length === 0) {
        setImportError("แบนเนอร์ที่ดึงมาอยู่ในรายการนี้แล้วทั้งหมด");
        return;
      }
      const next = [...rows, ...added];
      onChange(typeof max === "number" ? next.slice(0, max) : next, importFrom.also);
    } catch {
      setImportError("ยังดึงแบนเนอร์ไม่ได้ — ลองใหม่อีกครั้ง");
    } finally {
      setImporting(false);
    }
  }

  function update(i: number, patch: Partial<BannerRow>) {
    onChange(rows.map((row, j) => (i === j ? { ...row, ...patch } : row)));
  }

  function move(i: number, delta: number) {
    const to = i + delta;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  }

  return (
    <div>
      <span className={labelCls}>{label}</span>
      {help && <p className={helpCls}>{help}</p>}

      {importFrom && !full && (
        <div className="mt-2">
          <button
            type="button"
            onClick={runImport}
            disabled={importing}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-brand-800 hover:border-brand-teal hover:bg-surface-soft disabled:opacity-50"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {importFrom.label}
          </button>
          {importError ? (
            <p className="mt-1 text-[12px] text-amber-700">{importError}</p>
          ) : (
            importFrom.help && <p className={helpCls}>{importFrom.help}</p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl2 border border-slate-200 bg-surface-mist/60 p-3">
            <div className="mb-2 flex items-center gap-1">
              <span className="flex-1 text-[12px] font-semibold text-brand-ink">สไลด์ {i + 1}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`ย้ายสไลด์ ${i + 1} ขึ้น`}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-800 disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                aria-label={`ย้ายสไลด์ ${i + 1} ลง`}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-800 disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`ลบสไลด์ ${i + 1}`}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <ImagePicker
              value={row.image}
              onChange={(url) => update(i, { image: url })}
              // The picture's own description becomes the slide's, unless
              // this slide already says something of its own.
              onPickAlt={(alt) => update(i, { title: row.title || alt })}
            />

            <label className="mt-2.5 block text-[12px] font-semibold text-slate-600">ลิงก์เมื่อกด</label>
            <input
              type="text"
              value={row.href}
              onChange={(e) => update(i, { href: e.target.value })}
              placeholder="/promotions หรือ /collections/sale"
              className={`${inputCls} mt-1 h-10`}
            />

            <label className="mt-2.5 block text-[12px] font-semibold text-slate-600">คำอธิบายภาพ</label>
            <input
              type="text"
              value={row.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="เช่น Winter Festival ลด 50%"
              className={`${inputCls} mt-1 h-10`}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              คนที่ใช้โปรแกรมอ่านหน้าจอได้ยินข้อความนี้แทนรูป และ Google ใช้มันด้วย
            </p>

            {/* Second picture, not a second slide: the wide artwork becomes a
                thin strip on a phone, so a tall crop of the same campaign
                goes here. Left empty, the phone shows the wide one. */}
            <details className="mt-2.5">
              <summary className="cursor-pointer text-[12px] font-semibold text-slate-600">
                รูปสำหรับมือถือ (ไม่ใส่ก็ได้)
              </summary>
              <div className="mt-2">
                <ImagePicker value={row.mobileImage} onChange={(url) => update(i, { mobileImage: url })} />
                <p className="mt-1 text-[11px] text-slate-500">
                  รูปแนวตั้ง/จัตุรัสของแคมเปญเดียวกัน · ไม่ใส่ = ใช้รูปด้านบนทั้งสองขนาด
                </p>
              </div>
            </details>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...rows, { image: "", mobileImage: "", href: "", title: "" }])}
        disabled={full}
        className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[13px] font-semibold text-brand-800 hover:border-brand-teal hover:bg-surface-soft disabled:opacity-40"
      >
        <Plus size={15} /> เพิ่มสไลด์
      </button>
      {full && <p className={helpCls}>ใส่ได้สูงสุด {max} สไลด์</p>}
    </div>
  );
}

export default function SectionForm({
  fields,
  settings,
  onChange,
}: {
  fields: FieldDef[];
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  function set(key: string, value: unknown) {
    onChange({ ...settings, [key]: value });
  }

  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        section นี้ไม่มีอะไรให้ตั้งค่า — เนื้อหาของมันมาจากที่อื่น (เช่น หน้า Widgets หรือฐานความรู้ AI)
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {fields.map((field) => {
        const value = settings[field.key];
        const id = `f-${field.key}`;

        if (field.type === "list") {
          return (
            <ListField
              key={field.key}
              label={field.label}
              help={field.help}
              item={field.item}
              columns={field.columns}
              max={field.max}
              value={value}
              onChange={(next) => set(field.key, next)}
            />
          );
        }

        if (field.type === "json") {
          return (
            <JsonField
              key={field.key}
              label={field.label}
              help={field.help}
              value={value}
              onCommit={(next) => set(field.key, next)}
            />
          );
        }

        if (field.type === "toggle") {
          return (
            <div key={field.key}>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => set(field.key, e.target.checked)}
                  className="h-4 w-4 accent-brand-emerald"
                />
                <span className="text-[13px] font-semibold text-brand-ink">{field.label}</span>
              </label>
              {field.help && <p className={helpCls}>{field.help}</p>}
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.key}>
              <label htmlFor={id} className={labelCls}>
                {field.label}
              </label>
              <select
                id={id}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => set(field.key, e.target.value)}
                className={inputCls}
              >
                {field.options.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              {field.help && <p className={helpCls}>{field.help}</p>}
            </div>
          );
        }

        if (field.type === "number") {
          return (
            <div key={field.key}>
              <label htmlFor={id} className={labelCls}>
                {field.label}
              </label>
              <input
                id={id}
                type="number"
                min={field.min}
                max={field.max}
                value={typeof value === "number" ? value : ""}
                // An empty box is not zero. Writing undefined lets the
                // section's own default stand instead of silently meaning
                // "none of them".
                onChange={(e) => set(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                className={inputCls}
              />
              {field.help && <p className={helpCls}>{field.help}</p>}
            </div>
          );
        }

        if (field.type === "product_slugs" || field.type === "brand_slugs") {
          const list = Array.isArray(value) ? (value as string[]) : [];
          return (
            <div key={field.key}>
              <label htmlFor={id} className={labelCls}>
                {field.label}
              </label>
              <textarea
                id={id}
                rows={Math.min(12, Math.max(3, list.length + 1))}
                value={list.join("\n")}
                // Parsed back into a list on the way out, so what the document
                // stores stays a list however it was typed.
                onChange={(e) => set(field.key, parseSlugList(e.target.value))}
                className={`${inputCls} h-auto py-2.5 font-mono text-[12px] leading-relaxed`}
              />
              <p className={helpCls}>
                {field.help ? `${field.help} · ` : ""}บรรทัดละหนึ่ง{field.max ? ` · ไม่เกิน ${field.max}` : ""}
                {list.length > 0 ? ` · ตอนนี้ ${list.length}` : ""}
              </p>
            </div>
          );
        }

        if (field.type === "banners") {
          return (
            <BannerListField
              key={field.key}
              label={field.label}
              help={field.help}
              max={field.max}
              importFrom={field.importFrom}
              value={value}
              // One change, not two: importing also turns off the automatic
              // mode, and writing the list and the toggle in separate calls
              // would make the second one overwrite the first.
              onChange={(rows, also) => onChange({ ...settings, ...(also ?? {}), [field.key]: rows })}
            />
          );
        }

        if (field.type === "color") {
          // Anything that is not a plain hex is left in the text box and not
          // written to the document: this value ends up in an inline style,
          // and a box an admin types into is not a place to accept arbitrary
          // CSS. The well below always shows something valid.
          const text = typeof value === "string" ? value : "";
          const well = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text.trim()) ? text.trim() : "#ffffff";
          return (
            <div key={field.key}>
              <label htmlFor={id} className={labelCls}>
                {field.label}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={well}
                  aria-label={`${field.label} — เลือกจากจานสี`}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />
                <input
                  id={id}
                  type="text"
                  value={text}
                  placeholder="#0b6b4f"
                  onChange={(e) => set(field.key, e.target.value)}
                  className={`${inputCls} mt-0 font-mono`}
                />
              </div>
              {field.help && <p className={helpCls}>{field.help}</p>}
            </div>
          );
        }

        if (field.type === "image") {
          return (
            <div key={field.key}>
              <span className={labelCls}>{field.label}</span>
              <ImagePicker
                value={typeof value === "string" ? value : ""}
                onChange={(url) => set(field.key, url)}
                // A picture that already has a description brings it with it.
                // The alternative is asking the same question in every
                // section that uses the same picture, and getting a blank
                // answer in most of them.
                onPickAlt={(alt) => {
                  if (!settings.alt) onChange({ ...settings, [field.key]: settings[field.key], alt });
                }}
              />
              {field.help && <p className={helpCls}>{field.help}</p>}
            </div>
          );
        }

        if ((field.type === "text" || field.type === "textarea") && field.localized) {
          return (
            <LocalizedInput
              key={field.key}
              id={id}
              label={field.label}
              help={field.help}
              placeholder={field.placeholder}
              multiline={field.type === "textarea"}
              value={value}
              onChange={(next) => set(field.key, next)}
            />
          );
        }

        return (
          <div key={field.key}>
            <label htmlFor={id} className={labelCls}>
              {field.label}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={id}
                rows={4}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => set(field.key, e.target.value)}
                className={`${inputCls} h-auto py-2.5`}
              />
            ) : (
              <input
                id={id}
                type="text"
                value={typeof value === "string" ? value : ""}
                placeholder={"placeholder" in field ? field.placeholder : undefined}
                onChange={(e) => set(field.key, e.target.value)}
                className={inputCls}
              />
            )}
            {field.help && <p className={helpCls}>{field.help}</p>}
            {field.type === "datetime" && !field.help && (
              <p className={helpCls}>รูปแบบ 2026-11-11T00:00:00+07:00</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
