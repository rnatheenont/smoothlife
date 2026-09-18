"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Loader2, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminAction } from "@/components/admin/header-action";
import FormDrawer from "@/components/flash-sale-demo/FormDrawer";
import { CATEGORY_TH, STATUS_TH, type KbArticle, type KbCategory, type KbStatus } from "@/lib/kb";

// Admin → ฐานความรู้ AI. The articles the chat assistant is allowed to answer
// from: it quotes these and nothing else, so what is published here is exactly
// what a customer can be told (see the ai-knowledge-base plan, §B.5).

const EMPTY = { title: "", content: "", category: "faq" as KbCategory, status: "draft" as KbStatus, tags: "" };

const STATUS_TONE: Record<KbStatus, string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-slate-50 text-slate-600 ring-slate-200",
  needs_review: "bg-amber-50 text-amber-700 ring-amber-200",
  archived: "bg-slate-50 text-slate-400 ring-slate-200",
};

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

export default function AdminKnowledgeBasePage() {
  const params = useSearchParams();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embeddings, setEmbeddings] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<KbStatus | "all">("all");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kb/articles", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดฐานความรู้ไม่สำเร็จ");
      setArticles(data.articles);
      setEmbeddings(data.embeddings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดฐานความรู้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Arriving from the AI log with a question nobody could answer: the drawer
  // opens with that question as the title, waiting for the answer.
  const prefill = params.get("new");
  useEffect(() => {
    if (!prefill) return;
    setForm({ ...EMPTY, title: prefill.slice(0, 200) });
    setEditingId(null);
    setOpen(true);
  }, [prefill]);

  const startCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
  }, []);

  useAdminAction({ label: "เพิ่มความรู้ใหม่", icon: <Plus size={15} aria-hidden />, onClick: startCreate });

  const startEdit = (a: KbArticle) => {
    setEditingId(a.id);
    setForm({ title: a.title, content: a.content, category: a.category, status: a.status, tags: a.product_tags.join(", ") });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/admin/kb/articles/${editingId}` : "/api/admin/kb/articles", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          category: form.category,
          status: form.status,
          product_tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  const seedFromHelp = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/kb/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "นำเข้าไม่สำเร็จ");
      await load();
      setError(data.created > 0 ? null : "ศูนย์ช่วยเหลืออยู่ในฐานความรู้ครบแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setSeeding(false);
    }
  };

  const remove = async (a: KbArticle) => {
    if (!window.confirm(`ลบ "${a.title}" ออกจากฐานความรู้?`)) return;
    await fetch(`/api/admin/kb/articles/${a.id}`, { method: "DELETE" });
    await load();
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter(
      (a) =>
        (statusFilter === "all" || a.status === statusFilter) &&
        (!q || `${a.title} ${a.content} ${a.product_tags.join(" ")}`.toLowerCase().includes(q))
    );
  }, [articles, query, statusFilter]);

  const counts = useMemo(
    () => articles.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {}),
    [articles]
  );

  const fieldClass =
    "min-h-11 w-full rounded-xl2 border border-surface-line bg-white px-3 text-sm text-brand-ink focus:border-brand-800 focus:outline-none";

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <BookOpen size={22} className="text-brand-emerald" /> ฐานความรู้ AI
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          น้อง Smoothie ตอบลูกค้าได้เฉพาะจากบทความที่ <strong>เผยแพร่แล้ว</strong> ในหน้านี้เท่านั้น — เรื่องไหนไม่มีในนี้ ระบบจะส่งต่อให้ทีมงานตอบ ไม่เดาคำตอบเอง
        </p>
        <Link
          href="/admin/knowledge-base/log"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 hover:underline"
        >
          <MessageSquare size={14} /> ดู log คำตอบของ AI
        </Link>
        {!embeddings && (
          <p className="mt-2 rounded-xl2 bg-surface-soft px-3 py-2 text-xs text-slate-500">
            ตอนนี้ค้นหาด้วยการจับคู่ข้อความ · ถ้าเพิ่มค่า <code className="rounded-sm bg-white px-1">VOYAGE_API_KEY</code> ใน Vercel ระบบจะเปลี่ยนไปค้นแบบเข้าใจความหมาย (ฝังเวกเตอร์) ให้เองโดยไม่ต้องแก้อะไรเพิ่ม
          </p>
        )}
      </div>

      {error && <p className="mb-4 rounded-xl2 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาหัวข้อหรือเนื้อหา"
          aria-label="ค้นหาบทความ"
          className={`${fieldClass} max-w-xs`}
        />
        <button
          type="button"
          onClick={seedFromHelp}
          disabled={seeding}
          className="min-h-11 rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft disabled:opacity-60"
        >
          {seeding ? "กำลังนำเข้า…" : "นำเข้าจากศูนย์ช่วยเหลือ"}
        </button>
        <div className="inline-flex rounded-full bg-surface-muted p-1">
          {(["all", "published", "draft", "needs_review", "archived"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`min-h-9 rounded-full px-3.5 text-sm font-semibold transition ${
                statusFilter === s ? "bg-white text-brand-ink shadow-card" : "text-slate-600 hover:text-brand-ink"
              }`}
            >
              {s === "all" ? `ทั้งหมด ${articles.length}` : `${STATUS_TH[s]} ${counts[s] ?? 0}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">
          <Loader2 size={18} className="mx-auto animate-spin" />
        </p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-surface-line p-10 text-center">
          <p className="text-sm text-slate-500">{articles.length === 0 ? "ยังไม่มีความรู้ในระบบ" : "ไม่พบบทความที่ตรงกับที่ค้นหา"}</p>
          <button type="button" onClick={startCreate} className="mt-3 text-sm font-semibold text-brand-800 hover:underline">
            + เพิ่มความรู้ใหม่
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((a) => (
            <li key={a.id} className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand-ink">{a.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_TONE[a.status]}`}>{STATUS_TH[a.status]}</span>
                    <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-slate-500">{CATEGORY_TH[a.category]}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.content}</p>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    แก้ไขล่าสุด {thaiDate(a.updated_at)}
                    {a.product_tags.length > 0 && ` · สินค้า: ${a.product_tags.join(", ")}`}
                    {a.source === "chat_promoted" && " · มาจากคำตอบในแชท"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-800 hover:bg-surface-soft"
                  >
                    <Pencil size={14} /> แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    aria-label={`ลบ ${a.title}`}
                    className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDrawer open={open} title={editingId ? "แก้ไขความรู้" : "เพิ่มความรู้ใหม่"} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="kb-title" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              หัวข้อ
            </label>
            <input
              id="kb-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="เช่น ส่งฟรีทุกออเดอร์ไหม"
              className={fieldClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="kb-category" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                หมวดหมู่
              </label>
              <select
                id="kb-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as KbCategory }))}
                className={fieldClass}
              >
                {(Object.keys(CATEGORY_TH) as KbCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_TH[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="kb-status" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                สถานะ
              </label>
              <select
                id="kb-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as KbStatus }))}
                className={fieldClass}
              >
                {(Object.keys(STATUS_TH) as KbStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_TH[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="kb-content" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              เนื้อหา
            </label>
            <textarea
              id="kb-content"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={14}
              placeholder="เขียนคำตอบแบบที่อยากให้ตอบลูกค้าจริง แยกย่อหน้าเมื่อเปลี่ยนประเด็น"
              className={`${fieldClass} min-h-40 py-2 leading-relaxed`}
            />
            <p className="mt-1 text-xs text-slate-500">ระบบจะตัดเป็นท่อนตามย่อหน้าเพื่อใช้ค้นหา — แยกย่อหน้าให้ชัดจะค้นแม่นขึ้น</p>
          </div>

          <div>
            <label htmlFor="kb-tags" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              ผูกกับสินค้า (ไม่บังคับ)
            </label>
            <input
              id="kb-tags"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="slug สินค้า คั่นด้วยจุลภาค เช่น smooth-e-baby-face-foam"
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-slate-500">เว้นว่าง = ใช้ตอบได้ทุกคำถาม</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-12 rounded-full px-5 text-sm font-semibold text-slate-600 ring-1 ring-surface-line"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.title.trim() || !form.content.trim()}
              className="min-h-12 flex-1 rounded-full bg-brand-800 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "เพิ่มเข้าฐานความรู้"}
            </button>
          </div>
        </div>
      </FormDrawer>
    </div>
  );
}
