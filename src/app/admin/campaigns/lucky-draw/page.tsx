"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Play, RotateCcw, SkipForward, Sparkles, TriangleAlert } from "lucide-react";
import { Button, Spinner } from "@heroui/react";
import { Badge } from "@/components/ui";
import LuckyDrawStage from "@/components/admin/lucky-draw/LuckyDrawStage";
import { ACCENT_UI } from "@/components/admin/lucky-draw/faces";
import {
  LUCKY_FAN_PRIZES,
  drawLuckyFan,
  type Entrant,
  type Winner,
} from "@/lib/lucky-draw";

// A rehearsal of the Lucky Fan draw.
//
// Not linked from the menu, and it writes nothing: the real draw is still the
// button on the campaign screen, which freezes its result into
// receipt_campaign_winners and refuses to run twice. This exists so the rule
// can be watched working before the night it matters — the bands, the order,
// and twenty-five names coming out of a machine in front of an audience.
//
// Everything is decided before the drum moves. The draw is a pure function
// over the entries; the animation is told the answer and spends three seconds
// not saying it.

const PAUSE_BETWEEN_MS = 1500;

type LuckyFanRow = { userId: string; customer: string | null; entries: number };

export default function LuckyDrawPreviewPage() {
  const [pool, setPool] = useState<Entrant[] | null>(null);
  const [error, setError] = useState("");
  const [campaignName, setCampaignName] = useState<string | null>(null);

  const [winners, setWinners] = useState<Winner[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [target, setTarget] = useState<Winner | null>(null);
  const [auto, setAuto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const campaign = new URLSearchParams(window.location.search).get("campaign");
    const qs = campaign ? `?campaign=${encodeURIComponent(campaign)}` : "";
    let cancelled = false;
    fetch(`/api/admin/receipts${qs}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error ?? "โหลดรายชื่อไม่สำเร็จ");
          setPool([]);
          return;
        }
        setCampaignName(json.campaignName ?? json.campaign ?? null);
        const room: Entrant[] = ((json.luckyFan ?? []) as LuckyFanRow[]).map((r) => ({
          userId: r.userId,
          name: r.customer,
          entries: r.entries,
        }));
        setPool(room);
        // Drawn here rather than in an effect watching the pool: the page
        // should open on a result it is ready to play, and "the room arrived"
        // is the moment there is one to draw.
        if (room.length) setWinners(drawLuckyFan(room));
      })
      .catch(() => {
        if (cancelled) return;
        setError("โหลดรายชื่อไม่สำเร็จ");
        setPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roll = useCallback(() => {
    if (!pool?.length) return;
    if (timer.current) clearTimeout(timer.current);
    setWinners(drawLuckyFan(pool));
    setRevealed(0);
    setTarget(null);
    setAuto(false);
  }, [pool]);

  const onLanded = useCallback(() => {
    setRevealed((n) => n + 1);
  }, []);

  // One name lands, a beat, then the next — for as long as the run is on.
  useEffect(() => {
    if (!auto || revealed >= winners.length) return;
    timer.current = setTimeout(() => setTarget(winners[revealed]), revealed === 0 ? 150 : PAUSE_BETWEEN_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [auto, revealed, winners]);

  const done = winners.length > 0 && revealed >= winners.length;
  /** Derived rather than switched off at the end: the run stops because the
   *  names ran out, which the numbers already say. */
  const running = auto && !done;
  const spinning = Boolean(target) && revealed < winners.length;
  const nowShowing = revealed > 0 ? winners[revealed - 1] : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/campaigns"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-brand-ink"
          >
            <ArrowLeft size={13} aria-hidden /> กลับไปหน้ากิจกรรม
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-extrabold text-brand-ink">
            <Sparkles size={18} className="text-brand-emerald" aria-hidden />
            จับสลาก Lucky Fan · {LUCKY_FAN_PRIZES} รางวัล
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {campaignName ?? "แคมเปญใบเสร็จ"} — ซ้อมก่อนวันจริง
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="warning">
            <TriangleAlert size={12} aria-hidden /> โหมดทดลอง · ยังไม่บันทึกผล
          </Badge>
        </div>
      </div>

      {/* Said plainly and near the top, because everything below it looks
          exactly like the real thing. */}
      <div className="flex items-start gap-2 rounded-xl2 border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          หน้านี้ไม่บันทึกอะไรลงฐานข้อมูล กดสุ่มใหม่ได้ไม่จำกัด ผลที่ประกาศจริงต้องกดจากปุ่ม
          “จับสลาก Lucky Fan” ในหน้ากิจกรรม ซึ่งจับได้ครั้งเดียวและแช่ผลไว้
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-xl2 border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      {pool === null && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Spinner size="sm" color="current" /> กำลังโหลดรายชื่อผู้ร่วมสนุก
        </div>
      )}

      {pool !== null && pool.length === 0 && !error && (
        <p className="text-xs text-slate-400">ยังไม่มีใบเสร็จที่อนุมัติแล้วในแคมเปญนี้</p>
      )}

      {pool !== null && pool.length > 0 && (
        <>
          {/* The machine on the left, the list it is filling on the right.
              They are read against each other — a name lands and you look to
              see where it went — and stacking them put the list under the
              fold for the whole of the draw. */}
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
            <div className="flex min-w-0 flex-col gap-3">
          <div className="relative overflow-hidden rounded-xl2 bg-[#05060b] shadow-card">
            <LuckyDrawStage
              pool={pool}
              target={target}
              onLanded={onLanded}
              className="aspect-[16/9] w-full"
            />

            {/* The name is read off the DOM, not off the drum: the panel is a
                texture on a curved-looking surface under coloured light, and
                the person's own name should be crisp somewhere. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[#0a0f24]/92 via-[#0a0f24]/55 to-transparent p-4 md:p-6">
              <div className="min-w-0">
                {nowShowing && !spinning ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
                      รางวัลที่ {nowShowing.order} / {LUCKY_FAN_PRIZES}
                    </p>
                    <p className="truncate text-2xl font-extrabold text-white md:text-4xl">
                      {nowShowing.name || "(ไม่มีชื่อ)"}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] font-semibold text-white/60">
                    {spinning ? "กำลังจับ…" : done ? "ครบ 25 รางวัลแล้ว" : "พร้อมจับรางวัล"}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-right text-[11px] text-white/40">
                ผู้ร่วมสนุก {pool.length.toLocaleString("th-TH")} คน
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onPress={() => setAuto(true)}
              isDisabled={running || done || winners.length === 0}
            >
              <Play size={14} aria-hidden />
              {revealed === 0 ? "เริ่มจับรางวัล" : "เล่นต่อ"}
            </Button>
            {running && (
              <Button variant="secondary" onPress={() => setAuto(false)}>
                หยุดชั่วคราว
              </Button>
            )}
            <Button
              variant="ghost"
              onPress={() => {
                setAuto(false);
                setTarget(null);
                setRevealed(winners.length);
              }}
              isDisabled={done || winners.length === 0}
            >
              <SkipForward size={14} aria-hidden /> ข้ามไปดูผล
            </Button>
            <Button variant="ghost" onPress={roll} isDisabled={winners.length === 0}>
              <RotateCcw size={14} aria-hidden /> สุ่มใหม่
            </Button>
            <span className="ml-auto text-[12px] text-slate-500">
              จับแล้ว {revealed} / {LUCKY_FAN_PRIZES}
            </span>
          </div>

            </div>

            {/* Sticks while the stage scrolls past on a short window, and
                scrolls inside itself rather than running the page long. */}
            <div className="rounded-xl2 bg-white p-4 shadow-card lg:sticky lg:top-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-brand-ink">ผู้โชคดี</p>
                <p className="text-[11px] text-slate-400">
                  {revealed} / {LUCKY_FAN_PRIZES}
                </p>
              </div>
              {/* Two columns: twenty-five in one ran past the bottom of the
                  stage beside it, so the last few were only ever reached by
                  scrolling the panel while the draw carried on. Filled down
                  the first column and then the second, not across — the list
                  is numbered, and a 1,2 / 3,4 that jumps sides on every name
                  is not a list anybody reads in order. */}
              <ol className="grid max-h-[62vh] grid-flow-col grid-cols-2 gap-x-2 gap-y-1.5 overflow-y-auto pr-1 [grid-template-rows:repeat(13,minmax(0,auto))]">
                {Array.from({ length: LUCKY_FAN_PRIZES }, (_, i) => {
                  const w = i < revealed ? winners[i] : null;
                  return (
                    <li
                      key={i}
                      className={clsx(
                        "flex items-center gap-2 rounded-m px-2.5 py-2 text-[13px] ring-1",
                        w ? "bg-white ring-slate-200" : "bg-surface-soft ring-transparent",
                      )}
                    >
                      <span
                        className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: w ? ACCENT_UI : "#cbd5e1" }}
                      >
                        {i + 1}
                      </span>
                      {w ? (
                        <span className="min-w-0 flex-1 truncate font-semibold text-brand-ink">
                          {w.name || "(ไม่มีชื่อ)"}
                        </span>
                      ) : (
                        <span className="text-slate-300">รอจับ</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
