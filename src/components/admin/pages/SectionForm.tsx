"use client";

import { useEffect, useState } from "react";
import ImagePicker from "@/components/admin/pages/ImagePicker";
import { parseSlugList } from "@/lib/pages/edit";
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
