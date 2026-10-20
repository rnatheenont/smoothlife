"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle, Sparkles, Link2, X, Merge, Gauge, Play, MessageSquare } from "lucide-react";
import clsx from "clsx";
import { Panel, adminTable } from "@/components/admin/layout-kit";

// Two things on one screen, because they are two halves of the same loop:
// what customers asked and did not get, and whether the search finds what the
// shop has already written.
//
// A question in the queue is usually one of those two problems, and the
// difference decides what to do about it. No answer exists — write one.
// An answer exists but the search missed it — add the words they used to it.
// The screen puts both buttons on every row for that reason.

type Gap = {
  id: string;
  question: string;
  examples: string[] | null;
  hits: number | null;
  sources: string[] | null;
  status: string;
  article_id: string | null;
  last_seen: string | null;
};

type Suggestion = {
  keepId: string;
  keepQuestion: string;
  mergeIds: string[];
  mergeQuestions: string[];
  hits: number;
  confident: boolean;
};

type EvalGroup = { origin: string; cases: number; hit: number; first: number; pct: number };

type ProductQuestion = {
  id: string;
  product_slug: string;
  author_name: string | null;
  question: string;
  created_at: string;
};

const ORIGIN_TH: Record<string, string> = {
  keyword: "คำค้นสั้น (ของผู้เขียนเอง)",
  manual: "ประโยคแบบที่ลูกค้าพิมพ์",
};

const SOURCE_TH: Record<string, string> = { chat: "แชท", faq: "หน้า FAQ", product: "หน้าสินค้า", line: "LINE" };

export default function FaqGapsPanel() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [embedded, setEmbedded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [evalGroups, setEvalGroups] = useState<EvalGroup[] | null>(null);
  const [evalMisses, setEvalMisses] = useState<{ question: string; origin: string; rank: number | null }[]>([]);
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalAt, setEvalAt] = useState<string | null>(null);

  const [productQuestions, setProductQuestions] = useState<ProductQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [alsoFaq, setAlsoFaq] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, e] = await Promise.all([fetch("/api/admin/kb/gaps"), fetch("/api/admin/kb/eval")]);
      const gd = await g.json();
      if (!g.ok || !gd.ok) throw new Error(gd.error || "โหลดคิวไม่สำเร็จ");
      setGaps(gd.gaps);
      setSuggestions(gd.suggestions);
      setEmbedded(gd.embedded ?? 0);
      const ed = await e.json();
      if (e.ok && ed.ok) {
        setEvalGroups(ed.byOrigin);
        setEvalAt(ed.lastRunAt);
      }
      const pq = await fetch("/api/admin/product-questions").then((r) => r.json());
      if (pq?.ok) setProductQuestions(pq.questions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดคิวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, body: unknown, label: string, path = "") {
    setBusy(id);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/kb/gaps/${id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      setNote(
        data.warnings?.length
          ? `${label} — มีข้อควรดู: ${(data.warnings as string[]).join(" · ")}`
          : label
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function answerProductQuestion(q: ProductQuestion) {
    const answer = (answers[q.id] ?? "").trim();
    if (!answer) return;
    setBusy(q.id);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/product-questions/${q.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, alsoFaq: alsoFaq[q.id] === true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "ตอบไม่สำเร็จ");
      // The reply can succeed while the FAQ copy is refused — say both.
      setNote(
        data.error
          ? data.error
          : data.savedAsFaq
            ? "ตอบลูกค้าแล้ว และเก็บเป็น FAQ (draft) ให้ด้วย"
            : "ตอบลูกค้าแล้ว"
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ตอบไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function runEval() {
    setEvalRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/kb/eval", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "รันทดสอบไม่สำเร็จ");
      setEvalGroups(data.byOrigin);
      setEvalMisses(data.misses ?? []);
      setEvalAt(data.ranAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "รันทดสอบไม่สำเร็จ");
    } finally {
      setEvalRunning(false);
    }
  }

  if (loading) return <p className="p-4 text-sm text-slate-500">กำลังโหลด…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-rose-50 p-3 text-[13px] text-rose-700">{error}</p>}
      {note && <p className="rounded-lg bg-emerald-50 p-3 text-[13px] text-emerald-800">{note}</p>}

      <Panel
        title="ความแม่นของการค้นหา"
        icon={<Gauge size={15} className="text-brand-emerald" />}
        toolbar={
          <button
            type="button"
            onClick={runEval}
            disabled={evalRunning}
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft disabled:opacity-50"
          >
            <Play size={13} aria-hidden />
            {evalRunning ? "กำลังรัน…" : "รันทดสอบ"}
          </button>
        }
        padded
      >
        {evalGroups && evalGroups.length > 0 ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {evalGroups.map((g) => (
                <div key={g.origin} className="rounded-xl2 bg-surface-soft p-3">
                  <p className="text-[12px] text-slate-600">{ORIGIN_TH[g.origin] ?? g.origin}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-brand-ink">{g.pct}%</p>
                  <p className="text-[12px] text-slate-500">
                    เจอใน 3 อันดับแรก {g.hit}/{g.cases} · อันดับ 1 เลย {g.first}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              ตัวเลขที่ตัดสินคือชุด “ประโยคแบบที่ลูกค้าพิมพ์” — ชุดคำค้นสั้นเป็นคำที่ผู้เขียนบทความใส่ไว้เอง จึงสูงโดยธรรมชาติ
              {evalAt && ` · รันล่าสุด ${new Date(evalAt).toLocaleString("th-TH")}`}
            </p>
            {evalMisses.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-brand-800">
                  ที่ยังหาไม่เจอ {evalMisses.length} ข้อ
                </summary>
                <ul className="mt-2 space-y-1">
                  {evalMisses.map((m, i) => (
                    <li key={i} className="text-[12px] text-slate-600">
                      {m.question}
                      <span className="ml-1 text-slate-400">({m.rank === null ? "ไม่เจอเลย" : `อันดับ ${m.rank}`})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="text-[13px] text-slate-500">ยังไม่เคยรัน — กด “รันทดสอบ” เพื่อดูว่าการค้นหาหาคำตอบที่ถูกเจอกี่เปอร์เซ็นต์</p>
        )}
      </Panel>

      {suggestions.length > 0 && (
        <Panel title={`น่าจะเป็นคำถามเดียวกัน ${suggestions.length} กลุ่ม`} icon={<Merge size={15} className="text-brand-emerald" />} padded>
          <p className="mb-2 text-[12px] text-slate-500">
            {embedded === 0
              ? "ตอนนี้เทียบจากตัวอักษรอย่างเดียว ซึ่งแยก “คำถามเดียวกันคนละสำนวน” กับ “คนละคำถามที่เขียนคล้ายกัน” ไม่ได้ จึงเป็นข้อเสนอให้กดรับเอง"
              : "กลุ่มที่เทียบด้วยความหมายแล้วจะขึ้นว่ารวมได้เลย ส่วนที่เทียบจากตัวอักษรให้ตรวจก่อน"}
          </p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.keepId} className="rounded-xl2 bg-surface-soft p-3">
                <p className="text-[13px] font-medium text-brand-ink">{s.keepQuestion}</p>
                <ul className="mt-1 space-y-0.5">
                  {s.mergeQuestions.map((q, i) => (
                    <li key={i} className="text-[12px] text-slate-500">+ {q}</li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === s.keepId}
                    onClick={() => act(s.keepId, { action: "merge", mergeIds: s.mergeIds }, `รวมแล้ว ${s.mergeIds.length} ข้อ`)}
                    className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-white"
                  >
                    <Merge size={13} aria-hidden />
                    รวมเป็นข้อเดียว (รวม {s.hits} ครั้ง)
                  </button>
                  {!s.confident && <span className="text-[11px] text-amber-700">เทียบจากตัวอักษร — ตรวจก่อน</span>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {productQuestions.length > 0 && (
        <Panel
          title={`คำถามจากหน้าสินค้า ${productQuestions.length} ข้อ`}
          icon={<MessageSquare size={15} className="text-brand-emerald" />}
          padded
        >
          <p className="mb-3 text-[12px] text-slate-500">
            ลูกค้าถามไว้ที่หน้าสินค้าและยังรออยู่ตรงนั้น — ตอบแล้วจะขึ้นให้เขาเห็นทันที
          </p>
          <ul className="space-y-3">
            {productQuestions.map((q) => (
              <li key={q.id} className="rounded-xl2 bg-surface-soft p-3">
                <p className="text-[13px] font-medium text-brand-ink">{q.question}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {q.author_name || "ลูกค้า"} · {q.product_slug} · {new Date(q.created_at).toLocaleDateString("th-TH")}
                </p>
                <textarea
                  rows={3}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="พิมพ์คำตอบที่ลูกค้าจะเห็นบนหน้าสินค้า"
                  className="mt-2 w-full rounded-lg bg-white p-2.5 text-[13px] ring-1 ring-surface-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy === q.id || !(answers[q.id] ?? "").trim()}
                    onClick={() => answerProductQuestion(q)}
                    className="inline-flex h-9 items-center rounded-full bg-brand-800 px-4 text-[13px] font-semibold text-white hover:bg-brand-1000 disabled:opacity-50"
                  >
                    ตอบลูกค้า
                  </button>
                  <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={alsoFaq[q.id] === true}
                      onChange={(e) => setAlsoFaq((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                    />
                    เก็บเป็น FAQ ด้วย (เข้าเป็น draft)
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={`คำถามที่ยังไม่มีคำตอบ ${gaps.length} ข้อ`} icon={<HelpCircle size={15} className="text-brand-emerald" />}>
        {gaps.length === 0 ? (
          <p className="p-4 text-[13px] text-slate-500">ยังไม่มีคำถามค้างในคิว</p>
        ) : (
          <div className={adminTable.scroll}>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className="px-3 py-2">ถามกี่ครั้ง</th>
                  <th className="px-3 py-2">คำถาม</th>
                  <th className="px-3 py-2">มาจาก</th>
                  <th className="px-3 py-2">ทำอะไรกับมัน</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.id} className={adminTable.row}>
                    <td className={clsx(adminTable.cell, "tabular-nums font-semibold")}>{g.hits ?? 1}</td>
                    <td className={adminTable.cell}>
                      <span className="font-medium text-brand-ink">{g.question}</span>
                      {(g.examples?.length ?? 0) > 1 && (
                        <span className="block text-[11px] text-slate-400">
                          เขียนมาแบบอื่นอีก {g.examples!.length - 1} แบบ
                        </span>
                      )}
                    </td>
                    <td className={adminTable.muted}>
                      {(g.sources ?? []).map((s) => SOURCE_TH[s] ?? s).join(", ") || "—"}
                    </td>
                    <td className={adminTable.cell}>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy === g.id}
                          onClick={() => act(g.id, {}, "ร่างคำตอบแล้ว — อยู่ในแท็บบทความเป็น draft", "/draft")}
                          className="inline-flex h-8 items-center gap-1 rounded-full bg-brand-800 px-3 text-[12px] font-semibold text-white hover:bg-brand-1000 disabled:opacity-50"
                        >
                          <Sparkles size={13} aria-hidden />
                          ร่างด้วย AI
                        </button>
                        <a
                          href={`/admin/knowledge-base?new=${encodeURIComponent(g.question)}`}
                          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft"
                        >
                          เขียนเอง
                        </a>
                        <button
                          type="button"
                          disabled={busy === g.id}
                          onClick={() => {
                            const articleId = prompt(
                              "วาง id ของบทความที่ตอบคำถามนี้อยู่แล้ว — ระบบจะเพิ่มถ้อยคำที่ลูกค้าพิมพ์เป็นคำค้นให้บทความนั้น"
                            );
                            if (articleId?.trim()) {
                              void act(g.id, { action: "link", articleId: articleId.trim() }, "เพิ่มเป็นคำค้นของบทความแล้ว");
                            }
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-brand-800 ring-1 ring-surface-line hover:bg-surface-soft disabled:opacity-50"
                        >
                          <Link2 size={13} aria-hidden />
                          มีคำตอบแล้ว
                        </button>
                        <button
                          type="button"
                          disabled={busy === g.id}
                          onClick={() => act(g.id, { action: "dismiss" }, "เก็บเข้าที่แล้ว")}
                          aria-label={`ไม่ต้องตอบ ${g.question}`}
                          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
