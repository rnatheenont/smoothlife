"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Sparkles, ClipboardList, Plus } from "lucide-react";
import { Button, Input } from "@heroui/react";
import { PageHeader, Panel } from "@/components/admin/layout-kit";

// Whether opening the FAQ to search is working.
//
// Three questions, in the order they get answered in real life. Did the
// crawlers come (days). Did anyone arrive because of it (weeks). And does
// the assistant actually name us when a customer asks — which no API will
// tell us, so somebody asks it once a month and writes down the answer.
//
// Deliberately not a chart. Every number here is small enough to read, and
// a sparkline over three weeks of a new subdomain would be decoration over
// noise.

type Visibility = {
  days: number;
  bots: { bot: string; hits: number; pages: number; lastSeen: string }[];
  pages: { path: string; hits: number }[];
  ai: { orders: number; fromAi: number; engines: { engine: string; orders: number }[] };
};

type GeoRow = {
  id: string;
  month: string;
  question: string;
  engine: string;
  cited: boolean | null;
  linked_url: string | null;
  competitor: string | null;
  note: string | null;
};

type GeoData = {
  month: string;
  months: string[];
  rows: GeoRow[];
  summary: { total: number; checked: number; cited: number };
};

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  copilot: "Copilot",
  google_aio: "Google AI Overviews",
  claude: "Claude",
};

const monthLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default function SeoVisibilityPage() {
  const [data, setData] = useState<Visibility | null>(null);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [questions, setQuestions] = useState("");

  useEffect(() => {
    fetch("/api/admin/seo/visibility")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error || "โหลดข้อมูลไม่สำเร็จ")))
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const loadGeo = useCallback((m: string | null) => {
    fetch(`/api/admin/seo/geo${m ? `?month=${m}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setGeo(d);
        setMonth(d.month);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadGeo(null);
  }, [loadGeo]);

  async function addQuestions() {
    const list = questions
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setAdding(true);
    await fetch("/api/admin/seo/geo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, questions: list }),
    }).catch(() => {});
    setAdding(false);
    setQuestions("");
    loadGeo(month);
  }

  async function saveRow(row: GeoRow, patch: Partial<GeoRow>) {
    setGeo((g) =>
      g ? { ...g, rows: g.rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)) } : g,
    );
    await fetch("/api/admin/seo/geo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, ...patch }),
    }).catch(() => {});
  }

  if (error) return <p className="rounded-lg bg-rose-50 p-3 text-[13px] text-rose-700">{error}</p>;

  // One group per question, so a question reads as a row of engines rather
  // than five unrelated lines that happen to sort next to each other.
  const byQuestion = new Map<string, GeoRow[]>();
  for (const row of geo?.rows ?? []) {
    byQuestion.set(row.question, [...(byQuestion.get(row.question) ?? []), row]);
  }

  return (
    <div className="space-y-4">
      {/* The page opened straight into its first panel, so the only heading
          on screen was that panel's — which names one of the three questions
          and not the page. */}
      <PageHeader
        icon={<Sparkles size={18} className="text-brand-emerald" />}
        title="หน้าเว็บถูกค้นเจอแค่ไหน"
        subtitle="บอทมาเก็บหรือยัง มีใครมาจากตรงนั้นไหม และ AI เอ่ยถึงร้านเราหรือเปล่า"
      />
      <Panel
        title={`ใครมาอ่านหน้า /faq บ้าง (${data?.days ?? 30} วันล่าสุด)`}
        icon={<Bot size={15} className="text-brand-emerald" />}
        padded
      >
        {!data ? (
          <p className="text-sm text-slate-500">กำลังโหลด…</p>
        ) : data.bots.length === 0 ? (
          <p className="text-[13px] text-slate-500">
            ยังไม่มีบอทเข้ามาเลย — ปกติหลังเปิดให้ค้นหาจะใช้เวลาไม่กี่วันกว่า Googlebot จะมารอบแรก
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.bots.map((b) => (
              <li key={b.bot} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-brand-ink">{b.bot}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {b.hits} ครั้ง · {b.pages} หน้า · ล่าสุด {b.lastSeen}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="หน้าที่ถูกอ่านบ่อย" icon={<Bot size={15} className="text-brand-emerald" />} padded>
          {!data?.pages.length ? (
            <p className="text-[13px] text-slate-500">ยังไม่มีข้อมูล</p>
          ) : (
            <ul className="space-y-1.5">
              {data.pages.map((p) => (
                <li key={p.path} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-brand-ink">{p.path}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{p.hits}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={`ออร์เดอร์ที่มาจากคำตอบของ AI (${data?.days ?? 30} วันล่าสุด)`}
          icon={<Sparkles size={15} className="text-brand-emerald" />}
          padded
        >
          {!data ? (
            <p className="text-sm text-slate-500">กำลังโหลด…</p>
          ) : (
            <>
              <p className="text-3xl font-bold tabular-nums text-brand-ink">{data.ai.fromAi}</p>
              <p className="mt-1 text-[13px] text-slate-600">จากทั้งหมด {data.ai.orders} ออร์เดอร์</p>
              {data.ai.engines.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {data.ai.engines.map((e) => (
                    <li key={e.engine} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="text-brand-ink">{ENGINE_LABEL[e.engine] ?? e.engine}</span>
                      <span className="tabular-nums text-slate-500">{e.orders}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[12px] text-slate-500">
                ตัวเลขนี้เป็น “อย่างน้อยเท่านี้” ไม่ใช่ยอดจริง — แอป AI หลายตัว
                โดยเฉพาะบนมือถือ ตัด referrer ทิ้งก่อนเปิดลิงก์ คนที่มาจาก AI
                จำนวนหนึ่งจึงถูกนับเป็น “เข้าตรง”
              </p>
            </>
          )}
        </Panel>
      </div>

      <Panel
        title="ถาม AI เองเดือนละครั้ง"
        icon={<ClipboardList size={15} className="text-brand-emerald" />}
        toolbar={
          geo && geo.months.length > 0 ? (
            <select
              value={month ?? geo.month}
              onChange={(e) => loadGeo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[13px] text-brand-ink"
            >
              {[...new Set([geo.month, ...geo.months])].map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          ) : null
        }
        padded
      >
        <p className="text-[13px] text-slate-600">
          ไม่มี API ไหนบอกได้ว่า ChatGPT แนะนำเราหรือเปล่า — ต้องถามเองแล้วจดไว้
          ใส่คำถามที่ลูกค้าถามจริง (ดึงจาก “คำถามที่ยังไม่มีคำตอบ” และคำค้นในเว็บได้)
          ระบบจะสร้างช่องให้ครบทุก engine
        </p>

        {geo && geo.summary.total > 0 && (
          <p className="mt-2 text-[13px] text-slate-600">
            เดือนนี้ {geo.summary.total} ช่อง · ตรวจแล้ว {geo.summary.checked} · ถูกอ้างถึง{" "}
            <span className="font-semibold text-brand-ink">{geo.summary.cited}</span>
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            placeholder="หนึ่งคำถามต่อบรรทัด เช่น ยาสีฟันฟันขาวยี่ห้อไหนดี"
            className="flex-1"
          />
          <Button onPress={addQuestions} isDisabled={adding || !questions.trim()}>
            <Plus size={14} aria-hidden />
            {adding ? "กำลังเพิ่ม…" : "เพิ่มคำถาม"}
          </Button>
        </div>

        {byQuestion.size > 0 && (
          <div className="mt-4 space-y-4">
            {[...byQuestion.entries()].map(([question, rows]) => (
              <div key={question} className="rounded-xl ring-1 ring-surface-line">
                <p className="border-b border-slate-100 p-3 text-sm font-semibold text-brand-ink">
                  {question}
                </p>
                <ul className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center gap-2 p-3 text-[13px]">
                      <span className="w-40 shrink-0 text-slate-600">
                        {ENGINE_LABEL[row.engine] ?? row.engine}
                      </span>
                      <select
                        value={row.cited === null ? "" : row.cited ? "yes" : "no"}
                        onChange={(e) =>
                          saveRow(row, {
                            cited: e.target.value === "" ? null : e.target.value === "yes",
                          })
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[13px]"
                        aria-label={`ถูกอ้างถึงไหม — ${ENGINE_LABEL[row.engine] ?? row.engine}`}
                      >
                        <option value="">ยังไม่ได้ตรวจ</option>
                        <option value="yes">ถูกอ้างถึง</option>
                        <option value="no">ไม่ถูกอ้างถึง</option>
                      </select>
                      <Input
                        defaultValue={row.linked_url ?? ""}
                        onBlur={(e) => saveRow(row, { linked_url: e.currentTarget.value })}
                        placeholder="ลิงก์ที่ AI ให้ไป"
                        className="min-w-[180px] flex-1"
                        aria-label="ลิงก์ที่ AI ให้ไป"
                      />
                      <Input
                        defaultValue={row.competitor ?? ""}
                        onBlur={(e) => saveRow(row, { competitor: e.currentTarget.value })}
                        placeholder="แนะนำคู่แข่งใคร"
                        className="min-w-[150px] flex-1"
                        aria-label="แนะนำคู่แข่งใคร"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
