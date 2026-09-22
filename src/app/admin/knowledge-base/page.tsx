"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Loader2, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAdminAction } from "@/components/admin/header-action";
import { Card } from "@/components/ui";
import { PageHeader, adminSelect, adminTable } from "@/components/admin/layout-kit";
import FormDrawer from "@/components/flash-sale-demo/FormDrawer";
import { CATEGORY_TH, STATUS_TH, type KbArticle, type KbCategory, type KbStatus } from "@/lib/kb";
import { slugifyThai } from "@/lib/kb-public";
import { isReviewDue, reviewLabel } from "@/lib/kb-review";

// Admin → ฐานความรู้ AI. The articles the chat assistant is allowed to answer
// from: it quotes these and nothing else, so what is published here is exactly
// what a customer can be told (see the ai-knowledge-base plan, §B.5).

const EMPTY = {
  title: "",
  content: "",
  category: "faq" as KbCategory,
  status: "draft" as KbStatus,
  tags: "",
  publicSlug: "",
};

const STATUS_TONE: Record<KbStatus, string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-slate-50 text-slate-600 ring-slate-200",
  needs_review: "bg-amber-50 text-amber-700 ring-amber-200",
  archived: "bg-slate-50 text-slate-400 ring-slate-200",
};

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Bangkok",
  });

export default function AdminKnowledgeBasePage() {
  const params = useSearchParams();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embeddings, setEmbeddings] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<KbStatus | "all" | "review_due">("all");
  const [categoryFilter, setCategoryFilter] = useState<KbCategory | "all">("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [source, setSource] = useState<"curated" | "shopify_sync" | "all">("curated");
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [truncated, setTruncated] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kb/articles?source=${source}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดฐานความรู้ไม่สำเร็จ");
      setArticles(data.articles);
      setSourceCounts(data.sourceCounts ?? {});
      setTruncated(Boolean(data.truncated));
      setEmbeddings(data.embeddings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดฐานความรู้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [source]);

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
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      status: a.status,
      tags: a.product_tags.join(", "),
      publicSlug: a.public_slug ?? "",
    });
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
          product_tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          public_slug: form.publicSlug.trim(),
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

  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/kb/sync-products")
      .then((r) => r.json())
      .then((d) => d.ok && setLastSyncAt(d.lastSyncAt))
      .catch(() => {});
  }, []);

  // The catalogue is rebuilt from Shopify when a product changes, and a cron
  // pulls it in every morning — this is the "now" button.
  const syncProducts = async () => {
    setSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      // The catalogue is walked in slices; keep asking for the next one.
      const totals = { created: 0, updated: 0, unchanged: 0, archived: 0 };
      let offset: number | null = 0;
      let lastAt: string | null = null;
      while (offset !== null) {
        const res = await fetch("/api/admin/kb/sync-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "ซิงก์ไม่สำเร็จ");
        totals.created += data.created;
        totals.updated += data.updated;
        totals.unchanged += data.unchanged;
        totals.archived += data.archived;
        lastAt = data.lastSyncAt;
        offset = data.nextOffset;
        setSyncNote(
          `กำลังซิงก์… เพิ่มใหม่ ${totals.created} · อัปเดต ${totals.updated} · เหมือนเดิม ${totals.unchanged}`,
        );
      }
      setSyncNote(
        `เพิ่มใหม่ ${totals.created} · อัปเดต ${totals.updated} · เหมือนเดิม ${totals.unchanged}${totals.archived ? ` · เก็บเข้าคลัง ${totals.archived}` : ""}`,
      );
      setLastSyncAt(lastAt);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ซิงก์ไม่สำเร็จ");
    } finally {
      setSyncing(false);
    }
  };

  const [indexing, setIndexing] = useState(false);
  // Only needed once, when an embedding provider is added after the fact.
  const reindexAll = async () => {
    setIndexing(true);
    setSyncNote(null);
    setError(null);
    try {
      let offset: number | null = 0;
      let done = 0;
      while (offset !== null) {
        const res = await fetch("/api/admin/kb/reindex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "สร้าง embedding ไม่สำเร็จ");
        done += data.indexed;
        offset = data.nextOffset;
        setSyncNote(`กำลังสร้าง embedding… ทำแล้ว ${done} · เหลือ ${Math.max(0, data.total - data.indexed)} บทความ`);
      }
      setSyncNote(done > 0 ? `สร้าง embedding ครบแล้ว ${done} บทความ` : "ทุกบทความมี embedding อยู่แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้าง embedding ไม่สำเร็จ");
    } finally {
      setIndexing(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  const seedStarters = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/kb/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "นำเข้าไม่สำเร็จ");
      await load();
      setError(
        data.created > 0 || data.updated > 0 ? null : "บทความตั้งต้นอยู่ในฐานความรู้ครบแล้ว และเนื้อหาตรงกับต้นฉบับ",
      );
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
        (statusFilter === "all" || (statusFilter === "review_due" ? isReviewDue(a) : a.status === statusFilter)) &&
        (categoryFilter === "all" || a.category === categoryFilter) &&
        (!q || `${a.title} ${a.content} ${a.product_tags.join(" ")}`.toLowerCase().includes(q)),
    );
  }, [articles, query, statusFilter, categoryFilter]);

  const reviewDueCount = useMemo(() => articles.filter((a) => isReviewDue(a)).length, [articles]);

  /** Read it, still agree with it: the date moves, the text does not. */
  const confirmReviewed = async (a: KbArticle) => {
    setConfirming(a.id);
    try {
      const res = await fetch(`/api/admin/kb/articles/${a.id}/reviewed`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "ยืนยันไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยันไม่สำเร็จ");
    } finally {
      setConfirming(null);
    }
  };

  const counts = useMemo(
    () => articles.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {}),
    [articles],
  );

  /** Same basis as the status counts: the list the server sent for this source. */
  const categoryCounts = useMemo(
    () =>
      articles.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.category]: (acc[a.category] ?? 0) + 1 }), {}),
    [articles],
  );

  /** Every filter that is not at its default, with the way to switch it off. */
  const activeFilters = [
    source !== "all" && {
      label: `แหล่งที่มา: ${source === "curated" ? "ทีมเขียนเอง" : "จากสินค้า"}`,
      clear: () => setSource("all"),
    },
    statusFilter !== "all" && {
      label: `สถานะ: ${statusFilter === "review_due" ? "ถึงรอบรีวิว" : STATUS_TH[statusFilter]}`,
      clear: () => setStatusFilter("all"),
    },
    categoryFilter !== "all" && {
      label: `ประเภท: ${CATEGORY_TH[categoryFilter]}`,
      clear: () => setCategoryFilter("all"),
    },
    query.trim() !== "" && { label: `ค้นหา: ${query.trim()}`, clear: () => setQuery("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const fieldClass =
    "min-h-11 w-full rounded-xl2 border border-surface-line bg-white px-3 text-sm text-brand-ink focus:border-brand-800 focus:outline-none";

  return (
    <div>
      {/* Five stacked lines of preamble used to stand between the page and
          its articles. What is true of the whole page belongs in the
          subtitle, what is a link belongs in the header's actions, and the
          embeddings note is a setting, so it goes under both. */}
      <PageHeader
        className="mb-4"
        icon={<BookOpen size={20} className="text-brand-emerald" />}
        title="ฐานความรู้ AI"
        subtitle={
          <>
            น้อง Smoothie ตอบลูกค้าได้เฉพาะจากบทความที่ <strong>เผยแพร่แล้ว</strong> ในหน้านี้เท่านั้น —
            เรื่องไหนไม่มีในนี้ ระบบจะส่งต่อให้ทีมงานตอบ ไม่เดาคำตอบเอง
            {lastSyncAt && (
              <span className="mt-0.5 block text-slate-400">
                ซิงก์ข้อมูลสินค้าล่าสุด {thaiDate(lastSyncAt)} · ระบบซิงก์ให้เองทุกเช้า
              </span>
            )}
          </>
        }
        actions={
          <Link
            href="/admin/knowledge-base/log"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-slate-50"
          >
            <MessageSquare size={14} /> log คำตอบของ AI
          </Link>
        }
      />

      {!embeddings && (
        <p className="mb-4 rounded-xl2 bg-surface-soft px-3 py-2 text-xs leading-relaxed text-slate-500">
          ตอนนี้ค้นหาด้วยการจับคู่ข้อความ · ถ้าเพิ่มค่า <code className="rounded-sm bg-white px-1">VOYAGE_API_KEY</code>{" "}
          ใน Vercel ระบบจะเปลี่ยนไปค้นแบบเข้าใจความหมาย (ฝังเวกเตอร์) ให้เองโดยไม่ต้องแก้อะไรเพิ่ม
        </p>
      )}

      {error && <p className="mb-4 rounded-xl2 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {syncNote && (
        <p className="mb-4 rounded-xl2 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ซิงก์สินค้าเรียบร้อย — {syncNote}
        </p>
      )}

      {/* One panel, and inside it the three questions asked of this screen in
          the order they are asked: which article, which kind, and the jobs
          that are run occasionally. They used to share one wrapping row —
          the search box, three maintenance buttons and six status pills — so
          a filter and a "sync every product" button sat side by side. */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาหัวข้อหรือเนื้อหา"
              aria-label="ค้นหาบทความ"
              className={`${fieldClass} min-w-[12rem] max-w-sm flex-1`}
            />
            {/* Run now and then, not while reading: grouped, quiet, and out
                of the way of the filters. */}
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[11px] text-slate-400">เครื่องมือ</span>
              <button
                type="button"
                onClick={syncProducts}
                disabled={syncing}
                title="ดึงคำอธิบาย ส่วนผสม วิธีใช้ และราคา จากแคตตาล็อกสินค้าเข้าฐานความรู้"
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft disabled:opacity-60"
              >
                {syncing ? "กำลังซิงก์สินค้า…" : "ซิงก์ข้อมูลสินค้า"}
              </button>
              <button
                type="button"
                onClick={seedStarters}
                disabled={seeding}
                title="นำศูนย์ช่วยเหลือ และวิธีใช้งานสแกนผิว/ช้อปตามปัญหาผิว เข้าฐานความรู้ — บทความวิธีใช้งานจะอัปเดตตามต้นฉบับในโค้ด ส่วนบทความศูนย์ช่วยเหลือที่นำเข้าแล้วจะไม่ถูกเขียนทับ"
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft disabled:opacity-60"
              >
                {seeding ? "กำลังนำเข้า…" : "นำเข้าบทความตั้งต้น"}
              </button>
              {embeddings && (
                <button
                  type="button"
                  onClick={reindexAll}
                  disabled={indexing}
                  title="สร้าง embedding ให้บทความที่ยังไม่มี (หลังเพิ่ม VOYAGE_API_KEY)"
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft disabled:opacity-60"
                >
                  {indexing ? "กำลังสร้าง embedding…" : "สร้าง embedding ที่ยังขาด"}
                </button>
              )}
            </span>
          </div>

          {/* Three axes, three named controls. As chips they were three rows
              of identical pills where nothing said which row meant what, and
              the counts came from two different places: "จากสินค้า 941" is
              everything on the server, "ทุกสถานะ 300" is what it sent us.
              Counts now sit inside the menu they belong to, and vanish when
              the list is truncated rather than contradicting the one above. */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              แหล่งที่มา
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as typeof source)}
                className={adminSelect}
              >
                <option value="all">ทั้งหมด</option>
                <option value="curated">
                  ทีมเขียนเอง ({(sourceCounts.manual ?? 0) + (sourceCounts.chat_promoted ?? 0)})
                </option>
                <option value="shopify_sync">จากสินค้า ({sourceCounts.shopify_sync ?? 0})</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              สถานะ
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className={adminSelect}
              >
                <option value="all">ทั้งหมด</option>
                {(["published", "draft", "needs_review", "archived"] as const).map((st) => (
                  <option key={st} value={st}>
                    {STATUS_TH[st]}
                    {truncated ? "" : ` (${counts[st] ?? 0})`}
                  </option>
                ))}
                <option value="review_due">ถึงรอบรีวิว{truncated ? "" : ` (${reviewDueCount})`}</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              ประเภท
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                className={adminSelect}
              >
                <option value="all">ทั้งหมด</option>
                {(Object.keys(CATEGORY_TH) as KbCategory[])
                  .filter((c) => (categoryCounts[c] ?? 0) > 0 || categoryFilter === c)
                  .map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_TH[c]}
                      {truncated ? "" : ` (${categoryCounts[c] ?? 0})`}
                    </option>
                  ))}
              </select>
            </label>

            {/* What is actually on, and one click to take it off. With three
                menus it is otherwise possible to filter to nothing and not
                see why. */}
            {activeFilters.length > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                {activeFilters.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={f.clear}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
                  >
                    {f.label}
                    <X size={11} aria-hidden />
                  </button>
                ))}
                {activeFilters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSource("all");
                      setStatusFilter("all");
                      setCategoryFilter("all");
                      setQuery("");
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-brand-800"
                  >
                    ล้างทั้งหมด
                  </button>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="p-3">
          {!loading && (
            <p className="mb-2 text-xs text-slate-400">
              แสดง {shown.length.toLocaleString("th-TH")} จาก {articles.length.toLocaleString("th-TH")} บทความ
              {truncated && " · ระบบโหลดมาล่าสุด 300 รายการ ใช้ช่องค้นหาเพื่อหาที่เหลือ"}
            </p>
          )}
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">
              <Loader2 size={18} className="mx-auto animate-spin" />
            </p>
          ) : shown.length === 0 ? (
            <div className="rounded-xl2 border border-dashed border-surface-line p-10 text-center">
              <p className="text-sm text-slate-500">
                {articles.length === 0 ? "ยังไม่มีความรู้ในระบบ" : "ไม่พบบทความที่ตรงกับตัวกรองนี้"}
              </p>
              <button
                type="button"
                onClick={startCreate}
                className="mt-3 text-sm font-semibold text-brand-800 hover:underline"
              >
                + เพิ่มความรู้ใหม่
              </button>
            </div>
          ) : (
            /* Two to a row once there is genuinely room for two. Each card is
               a title, two lines of the answer and its buttons — past 1280px
               a single column sets that answer in 180-character lines with
               half a screen of white space beside it. Editing happens in the
               drawer, so the narrower card costs nothing. */
            <>
              {/* A table on a desktop: the questions asked of this list are
                  comparisons — which category, which status, what has not
                  been touched in months — and cards made each of those a
                  hunt across a grid. Below md the same row is a card, since
                  five columns do not fit a phone. */}
              <div className="hidden md:block">
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th>หัวข้อ</th>
                      <th className="w-40">ประเภท</th>
                      <th className="w-40">สถานะ</th>
                      <th className="w-48">แก้ไขล่าสุด</th>
                      <th className="w-64 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.id} className={adminTable.row}>
                        <td className={adminTable.cell}>
                          <p className="font-semibold text-brand-ink">{a.title}</p>
                          <p className="mt-0.5 line-clamp-1 max-w-[70ch] text-[12px] text-slate-500">{a.content}</p>
                        </td>
                        <td className={adminTable.cell}>
                          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-slate-500">
                            {CATEGORY_TH[a.category]}
                          </span>
                        </td>
                        <td className={adminTable.cell}>
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_TONE[a.status]}`}
                          >
                            {STATUS_TH[a.status]}
                          </span>
                          {reviewLabel(a) && (
                            <span
                              className={`mt-1 block text-[11px] font-semibold ${isReviewDue(a) ? "text-amber-700" : "text-slate-400"}`}
                            >
                              {reviewLabel(a)}
                            </span>
                          )}
                        </td>
                        <td className={adminTable.cell}>
                          <span className="block text-[12px] text-slate-500">{thaiDate(a.updated_at)}</span>
                          {(a.product_tags.length > 0 || a.source === "chat_promoted") && (
                            <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                              {a.product_tags.length > 0 ? `สินค้า: ${a.product_tags.join(", ")}` : "มาจากคำตอบในแชท"}
                            </span>
                          )}
                        </td>
                        <td className={adminTable.cell}>
                          <span className="flex flex-wrap items-center justify-end gap-1">
                            {isReviewDue(a) && (
                              <button
                                type="button"
                                onClick={() => confirmReviewed(a)}
                                disabled={confirming === a.id}
                                className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
                              >
                                {confirming === a.id ? "กำลังบันทึก…" : "ยังถูกต้องอยู่"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(a)}
                              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-soft"
                            >
                              <Pencil size={13} /> แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(a)}
                              aria-label={`ลบ ${a.title}`}
                              className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="flex flex-col gap-2 md:hidden">
                {shown.map((a) => (
                  <li key={a.id} className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-brand-ink">{a.title}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_TONE[a.status]}`}
                          >
                            {STATUS_TH[a.status]}
                          </span>
                          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-slate-500">
                            {CATEGORY_TH[a.category]}
                          </span>
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.content}</p>
                        {reviewLabel(a) && (
                          <p
                            className={`mt-1.5 text-[11px] font-semibold ${isReviewDue(a) ? "text-amber-700" : "text-slate-400"}`}
                          >
                            {reviewLabel(a)}
                            {a.last_reviewed_at ? ` · ตรวจล่าสุด ${thaiDate(a.last_reviewed_at)}` : ""}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          แก้ไขล่าสุด {thaiDate(a.updated_at)}
                          {a.product_tags.length > 0 && ` · สินค้า: ${a.product_tags.join(", ")}`}
                          {a.source === "chat_promoted" && " · มาจากคำตอบในแชท"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isReviewDue(a) && (
                          <button
                            type="button"
                            onClick={() => confirmReviewed(a)}
                            disabled={confirming === a.id}
                            className="min-h-9 rounded-full px-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            {confirming === a.id ? "กำลังบันทึก…" : "ยังถูกต้องอยู่"}
                          </button>
                        )}
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
            </>
          )}
        </div>
      </Card>

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
            <p className="mt-1 text-xs text-slate-500">
              ระบบจะตัดเป็นท่อนตามย่อหน้าเพื่อใช้ค้นหา — แยกย่อหน้าให้ชัดจะค้นแม่นขึ้น
            </p>
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

          {/* Publishing to the assistant and publishing to the web are two
              decisions. Most of these articles are written about customers
              ("ถ้าลูกค้า…") because the assistant is the reader; on a public
              page the reader is the customer, and that wording reads wrong.
              So this is off unless someone types a slug, and the warning
              below fires on exactly the phrasing that gives it away. */}
          <div>
            <label htmlFor="kb-public-slug" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              แสดงเป็นหน้าเว็บสาธารณะ (ไม่บังคับ)
            </label>
            <div className="flex gap-2">
              <input
                id="kb-public-slug"
                value={form.publicSlug}
                onChange={(e) => setForm((f) => ({ ...f, publicSlug: e.target.value }))}
                placeholder="เว้นว่าง = ไม่แสดงเป็นหน้าเว็บ"
                className={fieldClass}
                disabled={form.status !== "published"}
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, publicSlug: slugifyThai(f.title) }))}
                disabled={form.status !== "published" || !form.title.trim()}
                className="min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft disabled:opacity-50"
              >
                สร้างจากหัวข้อ
              </button>
            </div>
            {form.status !== "published" ? (
              <p className="mt-1 text-xs text-slate-500">ต้องเผยแพร่บทความก่อนจึงจะทำเป็นหน้าเว็บได้</p>
            ) : form.publicSlug.trim() ? (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  จะเปิดได้ที่ /knowledge/questions/{form.publicSlug.trim()}
                </p>
                {/\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32/.test(form.content) && (
                  <p className="mt-1 text-xs text-amber-600">
                    เนื้อหามีคำว่า &ldquo;ลูกค้า&rdquo; — บทความนี้อาจเขียนไว้สั่งงาน AI ไม่ได้เขียนคุยกับลูกค้าโดยตรง
                    ตรวจสำนวนก่อนเผยแพร่เป็นหน้าเว็บ
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">เว้นว่าง = ใช้ตอบในแชทอย่างเดียว ไม่ขึ้นหน้าเว็บ</p>
            )}
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
