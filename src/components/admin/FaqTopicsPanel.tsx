"use client";

import { useCallback, useEffect, useState } from "react";
import { Tags, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import clsx from "clsx";
import { Panel, adminTable } from "@/components/admin/layout-kit";

// The tabs and chips on /faq, as a list a person can edit.
//
// Order is changed with buttons rather than by dragging. A drag needs a
// pointer, and this list is read and fixed on a phone as often as at a desk;
// two arrows work with a thumb, with a keyboard, and with a screen reader,
// and they say what they do.

type Topic = {
  slug: string;
  kind: "section" | "concern";
  label_th: string;
  label_en: string | null;
  icon: string | null;
  link_href: string | null;
  sort: number;
  enabled: boolean;
  published?: number;
};

const KIND_TH: Record<Topic["kind"], string> = {
  section: "หมวดสินค้า (แท็บ “ตามสินค้า/แบรนด์”)",
  concern: "ปัญหา (แท็บ “ตามปัญหา”)",
};

const blank = (kind: Topic["kind"]): Topic => ({
  slug: "",
  kind,
  label_th: "",
  label_en: null,
  icon: null,
  link_href: null,
  sort: 999,
  enabled: true,
});

export default function FaqTopicsPanel() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Topic | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kb/topics");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดหัวข้อไม่สำเร็จ");
      setTopics(data.topics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดหัวข้อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(topic: Topic, isNew: boolean) {
    const ok = isNew
      ? await send("/api/admin/kb/topics", "POST", topic)
      : await send(`/api/admin/kb/topics/${encodeURIComponent(topic.slug)}`, "PATCH", topic);
    if (ok) {
      setDraft(null);
      setNote(isNew ? "เพิ่มหัวข้อแล้ว" : "บันทึกแล้ว");
    }
  }

  async function move(kind: Topic["kind"], slug: string, by: -1 | 1) {
    const group = topics.filter((t) => t.kind === kind);
    const at = group.findIndex((t) => t.slug === slug);
    const to = at + by;
    if (at < 0 || to < 0 || to >= group.length) return;
    const next = [...group];
    [next[at], next[to]] = [next[to], next[at]];
    await send("/api/admin/kb/topics", "PUT", { order: next.map((t) => t.slug) });
  }

  if (loading) return <p className="p-4 text-sm text-slate-500">กำลังโหลด…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-rose-50 p-3 text-[13px] text-rose-700">{error}</p>}
      {note && <p className="rounded-lg bg-emerald-50 p-3 text-[13px] text-emerald-800">{note}</p>}

      {(["section", "concern"] as const).map((kind) => {
        const group = topics.filter((t) => t.kind === kind);
        return (
          <Panel
            key={kind}
            title={KIND_TH[kind]}
            icon={<Tags size={15} className="text-brand-emerald" />}
            toolbar={
              <button
                type="button"
                onClick={() => setDraft(blank(kind))}
                className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft"
              >
                <Plus size={13} aria-hidden />
                เพิ่ม
              </button>
            }
          >
            <div className={adminTable.scroll}>
              <table className={adminTable.table}>
                <thead className={adminTable.thead}>
                  <tr>
                    <th className="px-3 py-2">ลำดับ</th>
                    <th className="px-3 py-2">ชื่อที่แสดง</th>
                    <th className="px-3 py-2">slug</th>
                    <th className="px-3 py-2">ลิงก์</th>
                    <th className="px-3 py-2">คำถามที่ publish</th>
                    <th className="px-3 py-2">แสดงผล</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {group.map((t, i) => (
                    <tr key={t.slug} className={adminTable.row}>
                      <td className={adminTable.cell}>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy || i === 0}
                            onClick={() => move(kind, t.slug, -1)}
                            aria-label={`เลื่อน ${t.label_th} ขึ้น`}
                            className="grid h-7 w-7 place-items-center rounded-full text-slate-500 ring-1 ring-surface-line hover:text-brand-ink disabled:opacity-30"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={busy || i === group.length - 1}
                            onClick={() => move(kind, t.slug, 1)}
                            aria-label={`เลื่อน ${t.label_th} ลง`}
                            className="grid h-7 w-7 place-items-center rounded-full text-slate-500 ring-1 ring-surface-line hover:text-brand-ink disabled:opacity-30"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      </td>
                      <td className={adminTable.cell}>
                        <button type="button" onClick={() => setDraft(t)} className="font-medium text-brand-ink hover:underline">
                          {t.label_th}
                        </button>
                        {t.label_en && <span className="block text-[11px] text-slate-400">{t.label_en}</span>}
                      </td>
                      <td className={adminTable.mono}>{t.slug}</td>
                      <td className={adminTable.muted}>{t.link_href ?? "—"}</td>
                      <td className={adminTable.cell}>
                        <span className={clsx("tabular-nums", (t.published ?? 0) === 0 && "text-slate-400")}>
                          {t.published ?? 0}
                        </span>
                        {(t.published ?? 0) === 0 && (
                          <span className="ml-1 text-[11px] text-slate-400">(ยังไม่แสดงบนหน้าเว็บ)</span>
                        )}
                      </td>
                      <td className={adminTable.cell}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => save({ ...t, enabled: !t.enabled }, false)}
                          className={clsx(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                            t.enabled
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-slate-200"
                          )}
                        >
                          {t.enabled ? "เปิด" : "ปิด"}
                        </button>
                      </td>
                      <td className={adminTable.cell}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`ลบหัวข้อ "${t.label_th}"?`)) {
                              void send(`/api/admin/kb/topics/${encodeURIComponent(t.slug)}`, "DELETE");
                            }
                          }}
                          aria-label={`ลบ ${t.label_th}`}
                          className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}

      {draft && (
        <Panel title={draft.slug ? `แก้ ${draft.label_th}` : "หัวข้อใหม่"} padded>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="ชื่อภาษาไทย (บังคับ)">
              <input
                value={draft.label_th}
                onChange={(e) => setDraft({ ...draft, label_th: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="ชื่อภาษาอังกฤษ">
              <input
                value={draft.label_en ?? ""}
                onChange={(e) => setDraft({ ...draft, label_en: e.target.value || null })}
                className={inputClass}
              />
            </Field>
            <Field label="slug (เปลี่ยนภายหลังไม่ได้)">
              <input
                value={draft.slug}
                disabled={Boolean(topics.find((t) => t.slug === draft.slug))}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="เช่น sensitive-teeth"
                className={clsx(inputClass, "font-mono disabled:bg-slate-50 disabled:text-slate-500")}
              />
            </Field>
            <Field label="ลิงก์ (ต้องขึ้นต้นด้วย /)">
              <input
                value={draft.link_href ?? ""}
                onChange={(e) => setDraft({ ...draft, link_href: e.target.value || null })}
                placeholder="/collections/toothpaste"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(draft, !topics.find((t) => t.slug === draft.slug))}
              className="inline-flex h-10 items-center rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000 disabled:opacity-50"
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold text-slate-600 ring-1 ring-surface-line hover:bg-surface-soft"
            >
              ยกเลิก
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg px-3 text-sm ring-1 ring-surface-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
