"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Eye, Plus, RefreshCw } from "lucide-react";
import type { AiLogRow } from "@/app/api/admin/kb/logs/route";
import { Button, Spinner, TextArea } from "@heroui/react";
import AdminSearch from "@/components/admin/AdminSearch";
import FormDrawer from "@/components/flash-sale-demo/FormDrawer";
import { adminTable } from "@/components/admin/layout-kit";
import AdminSelect from "@/components/admin/AdminSelect";
import { Card } from "@/components/ui";

// Admin → ฐานความรู้ AI → Log. Every answer the assistant gave from the
// knowledge base, with the articles behind it. A question with no article is
// not a failure to hide — it is the next article to write, so those are one
// click from becoming one.

const CHANNEL_TH: Record<string, string> = {
  web_chat: "เว็บแชท",
  line: "LINE",
  facebook: "Facebook",
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

export default function AiAnswerLogPanel() {
  const [rows, setRows] = useState<AiLogRow[]>([]);
  const [query, setQuery] = useState("");
  // The row being read in full. The table shows one line of each answer; the
  // whole thing, its sources and the box for fixing it live in here.
  const [detail, setDetail] = useState<AiLogRow | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "answered" | "unanswered">(
    "all",
  );
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Correcting an answer: which row is open, what has been typed, and which
  // rows were saved in this session.
  const [correction, setCorrection] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [corrected, setCorrected] = useState<string[]>([]);

  // Filters the page that is loaded, not the whole log — the list is paged
  // on the server, and the placeholder says so rather than implying a search
  // across everything.
  const q = query.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) => `${r.question} ${r.ai_answer ?? ""}`.toLowerCase().includes(q))
    : rows;

  function openDetail(r: AiLogRow) {
    setDetail(r);
    setCorrection(r.ai_answer ?? "");
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/kb/logs?filter=${filter}&page=${page}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data.error || "โหลด log ไม่สำเร็จ");
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

  const saveCorrection = async (row: AiLogRow) => {
    setSavingCorrection(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/kb/logs/${row.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correction }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data.error || "บันทึกคำแก้ไม่สำเร็จ");
      setCorrected((ids) => [...ids, row.id]);
      setCorrection("");
      // Close the drawer: what it was open to do is done, and the row it
      // came from now says so.
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกคำแก้ไม่สำเร็จ");
    } finally {
      setSavingCorrection(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Same header shape as the other three tabs. The back link and the
          page title are gone with the page they belonged to — this is a tab
          now, and the tab strip is the way back. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-brand-ink">Log คำตอบของ AI</h2>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-slate-500">
            คำตอบที่น้อง Smoothie ตอบจากฐานความรู้ พร้อมบทความที่ใช้อ้างอิง —
            คำถามที่ยังไม่มีความรู้รองรับคือรายการที่ควรเขียนบทความเพิ่ม
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-brand-teal hover:text-brand-800 disabled:opacity-50"
        >
          {loading ? <Spinner size="sm" color="current" /> : <RefreshCw size={15} aria-hidden />}
          รีเฟรช log
        </button>
      </div>

      {error && (
        <p className="rounded-xl2 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* Same chrome as the other three tabs: one row of named controls at
          the top of one panel, rather than a floating group of pills above a
          loose grid. The rows below stay cards and not a table — a question,
          an answer and a correction are paragraphs, and a 200-character
          answer in a table cell is the one shape this content cannot take. */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <AdminSearch
            className="min-w-[14rem] flex-1 basis-56"
            value={query}
            onChange={setQuery}
            label="ค้นหาใน log"
            placeholder="ค้นในหน้านี้ — คำถามหรือคำตอบ"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            แสดง
            <AdminSelect
              label="สถานะคำตอบ"
              value={filter}
              onChange={(v) => {
                setFilter(v as typeof filter);
                setPage(0);
              }}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "answered", label: "ตอบจากความรู้" },
                { value: "unanswered", label: "ยังไม่มีความรู้รองรับ" },
              ]}
            />
          </label>
          {q && (
            <span className="text-[11px] text-slate-400">
              เจอ {shown.length} จาก {rows.length} รายการในหน้านี้
            </span>
          )}
        </div>

        <div className="p-3">
      {loading ? (
        <p className="py-10 text-center">
          <Spinner
            size="md"
            color="current"
            className="mx-auto text-slate-300"
          />
        </p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-surface-line p-10 text-center text-sm text-slate-500">
          {q
            ? `ไม่พบรายการที่ตรงกับ “${query.trim()}” ในหน้านี้`
            : filter === "unanswered"
              ? "ไม่มีคำถามที่ตอบไม่ได้ในช่วงนี้"
              : "ยังไม่มีการตอบจากฐานความรู้"}
        </div>
      ) : (
        <>
          {/* A table, like the other three tabs. The answer is clamped to one
              line here and read in full in the drawer: a log is scanned for
              the one row worth opening — which question, was it answered,
              has somebody already fixed it — and four lines of answer per
              row turns that scan into scrolling. */}
          <div className="hidden md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className="w-36">เวลา</th>
                  <th>คำถาม</th>
                  <th>คำตอบของ AI</th>
                  <th className="w-40">อ้างอิง</th>
                  <th className="w-20 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const unanswered = r.matched_article_ids.length === 0;
                  const fixed = Boolean(r.staff_correction) || corrected.includes(r.id);
                  return (
                    <tr key={r.id} className={adminTable.row}>
                      <td className={adminTable.muted}>
                        {stamp(r.created_at)}
                        <span className="mt-0.5 block">{CHANNEL_TH[r.channel] ?? r.channel}</span>
                      </td>
                      <td className={adminTable.cell}>
                        <span className="line-clamp-1 font-semibold text-brand-ink">{r.question}</span>
                      </td>
                      <td className={adminTable.cell}>
                        <span className="line-clamp-1 text-slate-600">{r.ai_answer || "—"}</span>
                        {fixed && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <Check size={11} /> ทีมงานแก้คำตอบแล้ว
                          </span>
                        )}
                      </td>
                      <td className={adminTable.cell}>
                        {unanswered ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            ยังไม่มีความรู้รองรับ
                          </span>
                        ) : (
                          <span className="line-clamp-2 text-[12px] text-slate-500">
                            {r.matched_article_ids
                              .map((id) => titles[id] ?? "บทความที่ถูกลบไปแล้ว")
                              .join(", ")}
                          </span>
                        )}
                      </td>
                      <td className={`${adminTable.cell} text-right`}>
                        <button
                          type="button"
                          onClick={() => openDetail(r)}
                          className="inline-flex h-11 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-brand-800 hover:bg-surface-soft"
                        >
                          <Eye size={13} /> ดู
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Below md the same row is a card, same as the other tabs. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {shown.map((r) => {
              const unanswered = r.matched_article_ids.length === 0;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(r)}
                    className={`w-full rounded-xl2 bg-white p-3.5 text-left ring-1 ${unanswered ? "ring-amber-200" : "ring-surface-line"}`}
                  >
                    <span className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>{stamp(r.created_at)}</span>
                      <span>· {CHANNEL_TH[r.channel] ?? r.channel}</span>
                      {unanswered && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                          ยังไม่มีความรู้รองรับ
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 line-clamp-1 block text-sm font-semibold text-brand-ink">
                      {r.question}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-sm text-slate-600">
                      {r.ai_answer || "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {(page > 0 || hasMore) && (
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-slate-100 pt-3">
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
      </Card>

      {/* The same drawer the other tabs edit in. Everything the card used to
          show at once is here, where there is room for it. */}
      <FormDrawer open={Boolean(detail)} title="คำตอบของ AI" onClose={() => setDetail(null)}>
        {detail && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-400">
              {stamp(detail.created_at)} · {CHANNEL_TH[detail.channel] ?? detail.channel}
            </p>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-brand-ink">คำถามของลูกค้า</p>
              <p className="rounded-xl2 bg-surface-soft p-3 text-sm text-brand-ink">{detail.question}</p>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-brand-ink">คำตอบของ AI</p>
              <p className="whitespace-pre-wrap rounded-xl2 bg-surface-soft p-3 text-sm text-slate-700">
                {detail.ai_answer || "— ไม่มีคำตอบบันทึกไว้"}
              </p>
            </div>

            {(detail.staff_correction || corrected.includes(detail.id)) && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-emerald-800">คำตอบที่ถูกต้อง (ทีมงานแก้)</p>
                <p className="whitespace-pre-wrap rounded-xl2 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {detail.staff_correction}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-sm font-semibold text-brand-ink">บทความที่ใช้อ้างอิง</p>
              {detail.matched_article_ids.length === 0 ? (
                <p className="rounded-xl2 bg-amber-50 p-3 text-sm text-amber-800">
                  ยังไม่มีความรู้รองรับคำถามนี้ — คำถามแบบนี้คือรายการที่ควรเขียนบทความเพิ่ม
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.matched_article_ids.map((id) => (
                    <span
                      key={id}
                      className="flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-[11px] text-slate-600"
                    >
                      <BookOpen size={11} /> {titles[id] ?? "บทความที่ถูกลบไปแล้ว"}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {!detail.staff_correction && !corrected.includes(detail.id) && (
              <div className="rounded-xl2 bg-surface-soft p-3">
                <label htmlFor={`fix-${detail.id}`} className="mb-1.5 block text-sm font-semibold text-brand-ink">
                  ตอบแบบนี้ไม่ถูก — เขียนคำตอบที่ถูกต้อง
                </label>
                <TextArea
                  fullWidth
                  id={`fix-${detail.id}`}
                  aria-label="เขียนคำตอบที่อยากให้ AI ใช้ตอบคำถามแบบนี้ครั้งหน้า"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  rows={5}
                  placeholder="เขียนคำตอบที่อยากให้ AI ใช้ตอบคำถามแบบนี้ครั้งหน้า"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    onPress={() => saveCorrection(detail)}
                    isPending={savingCorrection}
                    isDisabled={!correction.trim()}
                  >
                    {savingCorrection ? <Spinner size="sm" color="current" /> : <Check size={13} />}
                    บันทึกคำแก้เป็นความรู้ใหม่
                  </Button>
                  <span className="text-[11px] text-slate-500">
                    บันทึกเป็นฉบับร่างในฐานความรู้ ต้องกดเผยแพร่ก่อน AI จึงจะใช้ตอบ
                  </span>
                </div>
              </div>
            )}

            {detail.matched_article_ids.length === 0 && (
              <Link
                href={`/admin/knowledge-base?new=${encodeURIComponent(detail.question)}`}
                className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white"
              >
                <Plus size={15} /> เขียนความรู้จากคำถามนี้
              </Link>
            )}
          </div>
        )}
      </FormDrawer>
    </div>
  );
}
