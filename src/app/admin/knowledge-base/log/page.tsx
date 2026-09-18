"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Loader2, MessageSquare, Plus, RefreshCw } from "lucide-react";
import { useAdminAction } from "@/components/admin/header-action";
import type { AiLogRow } from "@/app/api/admin/kb/logs/route";

// Admin → ฐานความรู้ AI → Log. Every answer the assistant gave from the
// knowledge base, with the articles behind it. A question with no article is
// not a failure to hide — it is the next article to write, so those are one
// click from becoming one.

const CHANNEL_TH: Record<string, string> = { web_chat: "เว็บแชท", line: "LINE", facebook: "Facebook" };

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export default function AdminAiLogPage() {
  const [rows, setRows] = useState<AiLogRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "answered" | "unanswered">("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kb/logs?filter=${filter}&page=${page}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลด log ไม่สำเร็จ");
      setRows(data.rows);
      setTitles(data.titles);
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลด log ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useAdminAction({
    label: "รีเฟรช log",
    icon: <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden />,
    onClick: load,
    disabled: loading,
  });

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/knowledge-base" className="mb-2 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-ink">
          <ArrowLeft size={13} /> กลับไปฐานความรู้
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <MessageSquare size={22} className="text-brand-emerald" /> Log คำตอบ AI
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          คำตอบที่น้อง Smoothie ตอบจากฐานความรู้ พร้อมบทความที่ใช้อ้างอิง — คำถามที่ยังไม่มีความรู้รองรับคือรายการที่ควรเขียนบทความเพิ่ม
        </p>
      </div>

      {error && <p className="mb-4 rounded-xl2 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="mb-4 inline-flex rounded-full bg-surface-muted p-1">
        {(["all", "answered", "unanswered"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
            aria-pressed={filter === f}
            className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${
              filter === f ? "bg-white text-brand-ink shadow-card" : "text-slate-600 hover:text-brand-ink"
            }`}
          >
            {f === "all" ? "ทั้งหมด" : f === "answered" ? "ตอบจากความรู้" : "ยังไม่มีความรู้รองรับ"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center">
          <Loader2 size={18} className="mx-auto animate-spin text-slate-300" />
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-surface-line p-10 text-center text-sm text-slate-500">
          {filter === "unanswered" ? "ไม่มีคำถามที่ตอบไม่ได้ในช่วงนี้" : "ยังไม่มีการตอบจากฐานความรู้"}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const unanswered = r.matched_article_ids.length === 0;
            return (
              <li key={r.id} className={`rounded-xl2 bg-white p-4 ring-1 ${unanswered ? "ring-amber-200" : "ring-surface-line"}`}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span>{stamp(r.created_at)}</span>
                  <span>· {CHANNEL_TH[r.channel] ?? r.channel}</span>
                  {unanswered && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">ยังไม่มีความรู้รองรับ</span>}
                </div>

                <p className="mt-2 text-sm font-semibold text-brand-ink">{r.question}</p>
                {r.ai_answer && <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-sm text-slate-600">{r.ai_answer}</p>}

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {r.matched_article_ids.map((id) => (
                    <Link
                      key={id}
                      href="/admin/knowledge-base"
                      className="flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-[11px] text-slate-600 hover:text-brand-ink"
                    >
                      <BookOpen size={11} /> {titles[id] ?? "บทความที่ถูกลบไปแล้ว"}
                    </Link>
                  ))}
                  {unanswered && (
                    <Link
                      href={`/admin/knowledge-base?new=${encodeURIComponent(r.question)}`}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft"
                    >
                      <Plus size={11} /> เขียนความรู้จากคำถามนี้
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 0 || hasMore) && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="min-h-9 rounded-full px-4 text-sm font-semibold text-slate-600 ring-1 ring-surface-line disabled:opacity-40"
          >
            ก่อนหน้า
          </button>
          <span className="text-xs text-slate-400">หน้า {page + 1}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="min-h-9 rounded-full px-4 text-sm font-semibold text-slate-600 ring-1 ring-surface-line disabled:opacity-40"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}
