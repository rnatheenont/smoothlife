"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Play, RotateCcw, SkipForward, Sliders, TriangleAlert } from "lucide-react";
import { Button, Spinner } from "@heroui/react";
import LuckyDrawStage from "@/components/admin/lucky-draw/LuckyDrawStage";
import { ACCENT_UI } from "@/components/admin/lucky-draw/faces";
import {
  BANDS,
  GIFT_EXCHANGE,
  LUCKY_FAN_PRIZES,
  PHONE_IN_PRIZES,
  cryptoRng,
  drawGiftExchange,
  drawLuckyFan,
  drawPhoneIn,
  splitIntoBands,
  type Band,
  type Entrant,
  type Winner,
} from "@/lib/lucky-draw";

// The rehearsal itself, so it can hang in two places: its own page and a
// tab of the campaign console. One implementation, two mounts — the
// alternative is the same six hundred lines twice, drifting apart from the
// first edit onwards.
//
// A rehearsal of the night's draws.
//
// Not linked from the menu, and it writes nothing: the real Lucky Fan draw
// is still the button on the campaign screen, which freezes its result into
// receipt_campaign_winners and refuses to run twice. This exists so the
// rules can be watched working before the night they matter.
//
// Three draws, because the night has three:
//   Lucky Fan     25 prizes, banded by how much somebody entered
//   Phone in       2 more from the middle band, skipping the 25
//   Gift exchange 10 from the VIP list — 8 VIP gifts and 2 Lucky ones
//
// Every number on this page can be changed from this page. A rule that can
// only be argued with by editing a source file is a rule nobody argues with
// until the night, which is the worst time to find out it reads wrong.
//
// Everything is decided before the drum moves. The draws are pure functions
// over the entries; the animation is told the answer and spends three
// seconds not saying it.

const PAUSE_BETWEEN_MS = 1500;

type DrawKey = "lucky" | "phone" | "gift";
const TABS: { key: DrawKey; label: string }[] = [
  { key: "lucky", label: "Lucky Fan" },
  { key: "phone", label: "Phone in" },
  { key: "gift", label: "Gift exchange" },
];

type LuckyFanRow = {
  userId: string;
  customer: string | null;
  email: string | null;
  entries: number;
};
type VipRow = { customer: string | null; email: string | null; orderName: string | null };

type Rules = {
  /** The Lucky Fan bands, thresholds and seats both. */
  bands: Band[];
  prizes: number;
  phoneIn: number;
  gift: { vip: number; lucky: number };
};

const DEFAULT_RULES: Rules = {
  bands: BANDS.map((b) => ({ ...b })),
  prizes: LUCKY_FAN_PRIZES,
  phoneIn: PHONE_IN_PRIZES,
  gift: { ...GIFT_EXCHANGE },
};

const empty = { lucky: [], phone: [], gift: [] } as Record<DrawKey, Winner[]>;
const zero = { lucky: 0, phone: 0, gift: 0 } as Record<DrawKey, number>;

/** A VIP is known by their e-mail here, because the VIP list comes from
 *  Shopify orders and not from our own accounts table. It is also what lets
 *  a Lucky Fan winner be recognised in the VIP list and left out of it. */
const vipKey = (v: VipRow) => (v.email ?? v.orderName ?? "").toLowerCase();

export default function DrawRehearsal({ campaign }: { campaign?: string }) {
  const [pool, setPool] = useState<Entrant[] | null>(null);
  const [vips, setVips] = useState<Entrant[]>([]);
  const [emailOf, setEmailOf] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState("");

  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [showRules, setShowRules] = useState(false);
  const [tab, setTab] = useState<DrawKey>("lucky");
  const [winners, setWinners] = useState<Record<DrawKey, Winner[]>>(empty);
  const [revealed, setRevealed] = useState<Record<DrawKey, number>>(zero);
  const [target, setTarget] = useState<Winner | null>(null);
  const [auto, setAuto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The console passes the campaign it is showing; opened on its own
    // page it comes from the address bar instead.
    const key = campaign ?? new URLSearchParams(window.location.search).get("campaign");
    const qs = key ? `?campaign=${encodeURIComponent(key)}` : "";
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
        const rows = (json.luckyFan ?? []) as LuckyFanRow[];
        setPool(rows.map((r) => ({ userId: r.userId, name: r.customer, entries: r.entries })));
        setEmailOf(new Map(rows.filter((r) => r.email).map((r) => [r.userId, r.email!.toLowerCase()])));
        setVips(
          ((json.vipBuyers ?? []) as VipRow[])
            .filter((v) => vipKey(v))
            .map((v) => ({ userId: vipKey(v), name: v.customer, entries: 1 })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setError("โหลดรายชื่อไม่สำเร็จ");
        setPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  /**
   * Every draw of the night, in the order it runs.
   *
   * Drawn together rather than one tab at a time, because they are not
   * independent: phone in may not call a name the twenty-five already
   * called, and the gift exchange may not call one either of them did.
   * Working them out in one pass is what makes that true by construction
   * instead of by a check somebody has to remember to add.
   */
  const rollAll = useCallback(
    (room: Entrant[], vipList: Entrant[], r: Rules, emails: Map<string, string>) => {
      const lucky = drawLuckyFan(room, cryptoRng, r.prizes, r.bands);
      const phone = drawPhoneIn(
        room,
        lucky.map((w) => w.userId),
        r.phoneIn,
        cryptoRng,
        r.bands,
      );
      // The two id spaces meet at the e-mail address: ours are account ids,
      // the VIP list's are the addresses the orders were placed with.
      const spoken = [...lucky, ...phone]
        .map((w) => emails.get(w.userId))
        .filter((e): e is string => Boolean(e));
      const gift = drawGiftExchange(vipList, spoken, r.gift, cryptoRng);
      return { lucky, phone, gift };
    },
    [],
  );

  const reroll = useCallback(
    (next: Rules = rules) => {
      if (!pool?.length) return;
      if (timer.current) clearTimeout(timer.current);
      setWinners(rollAll(pool, vips, next, emailOf));
      setRevealed(zero);
      setTarget(null);
      setAuto(false);
    },
    [pool, vips, rules, emailOf, rollAll],
  );

  // The first draw lands as soon as there is a room to draw from.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    if (pool?.length) setWinners(rollAll(pool, vips, rules, emailOf));
    // Rules get their own re-draw through reroll(); this is the arrival of
    // the data, and running it again on every rule edit would fight the
    // explicit one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, vips, emailOf, rollAll]);

  const onLanded = useCallback(() => {
    setRevealed((n) => ({ ...n, [tab]: n[tab] + 1 }));
  }, [tab]);

  const list = winners[tab];
  const seen = revealed[tab];

  // One name lands, a beat, then the next — for as long as the run is on.
  useEffect(() => {
    if (!auto || seen >= list.length) return;
    timer.current = setTimeout(() => setTarget(list[seen]), seen === 0 ? 150 : PAUSE_BETWEEN_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [auto, seen, list]);

  const bands = useMemo(() => splitIntoBands(pool ?? [], rules.bands), [pool, rules.bands]);

  /** The names the reel is filled with while this tab is spinning. */
  const reelPool = tab === "gift" ? vips : pool ?? [];
  const seats = list.length;
  const done = seats > 0 && seen >= seats;
  const running = auto && !done;
  const spinning = Boolean(target) && seen < seats;
  const nowShowing = seen > 0 ? list[seen - 1] : null;

  function editRules(change: (r: Rules) => Rules) {
    setRules((prev) => {
      const next = change(prev);
      reroll(next);
      return next;
    });
  }

  const num = (value: number, onChange: (n: number) => void, min = 0, max = 99) => (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
      className="h-8 w-16 rounded-m border border-slate-200 px-2 text-[13px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-800/25"
    />
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Said plainly and near the top, because everything below it looks
          exactly like the real thing. */}
      <div className="flex items-start gap-2 rounded-xl2 border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          หน้านี้ไม่บันทึกอะไรลงฐานข้อมูล แก้เงื่อนไขและกดสุ่มใหม่ได้ไม่จำกัด
          ผลที่ประกาศจริงต้องกดจากปุ่มในหน้ากิจกรรม ซึ่งจับได้ครั้งเดียวและแช่ผลไว้
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
          {/* Switching tab leaves each draw where it was: three results that
              were worked out together, and comparing them means being able
              to look at one after the other. */}
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setAuto(false);
                  setTarget(null);
                  setTab(t.key);
                }}
                className={clsx(
                  "h-9 rounded-full px-4 text-[13px] transition-colors",
                  tab === t.key
                    ? "bg-brand-gradient font-semibold text-white"
                    : "bg-surface-soft font-medium text-slate-600 hover:text-brand-ink",
                )}
              >
                {t.label}
                <span className="ml-1.5 text-[11px] opacity-70">({winners[t.key].length})</span>
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onPress={() => setShowRules((v) => !v)}
            >
              <Sliders size={14} aria-hidden /> เงื่อนไข
            </Button>
          </div>

          {showRules && (
            <div className="rounded-xl2 bg-white p-4 text-[13px] shadow-card">
              <p className="mb-3 text-sm font-bold text-brand-ink">เงื่อนไขการจับ</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-2 font-semibold text-brand-ink">Lucky Fan</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">รางวัลทั้งหมด</span>
                      {num(rules.prizes, (n) =>
                        editRules((r) => ({ ...r, prizes: n })),
                      )}
                    </label>
                    {rules.bands.map((b, i) => (
                      <div key={b.key} className="rounded-m bg-surface-soft p-2">
                        <p className="mb-1.5 font-semibold text-brand-ink">{b.label}</p>
                        <label className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">สิทธิ์ขั้นต่ำ</span>
                          {num(b.min, (n) =>
                            editRules((r) => {
                              const next = r.bands.map((x) => ({ ...x }));
                              next[i].min = n;
                              // The band above ends where this one starts,
                              // so moving a floor moves the ceiling over it
                              // and the two can never overlap or leave a gap.
                              if (i > 0) next[i - 1].max = Math.max(n - 1, next[i - 1].min);
                              return { ...r, bands: next };
                            }),
                          )}
                        </label>
                        <label className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-slate-600">
                            {b.seats === null ? "ได้ทุกคน" : "เลือกกี่คน"}
                          </span>
                          {b.seats === null ? (
                            <span className="text-[12px] text-slate-400">
                              {bands[b.key].length} คน
                            </span>
                          ) : (
                            num(b.seats, (n) =>
                              editRules((r) => {
                                const next = r.bands.map((x) => ({ ...x }));
                                next[i].seats = n;
                                return { ...r, bands: next };
                              }),
                            )
                          )}
                        </label>
                        <p className="mt-1 text-[11px] text-slate-400">
                          ตอนนี้ {bands[b.key].length} คนอยู่ในกลุ่มนี้
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-semibold text-brand-ink">Phone in</p>
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">จับกี่คน</span>
                    {num(rules.phoneIn, (n) => editRules((r) => ({ ...r, phoneIn: n })))}
                  </label>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                    จับจากกลุ่มกลาง ({rules.bands[1].label}) และข้ามคนที่ได้รางวัลจาก Lucky Fan
                    ไปแล้ว
                  </p>
                </div>

                <div>
                  <p className="mb-2 font-semibold text-brand-ink">Gift exchange</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">ของ VIP กี่ชิ้น</span>
                      {num(rules.gift.vip, (n) =>
                        editRules((r) => ({ ...r, gift: { ...r.gift, vip: n } })),
                      )}
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">ของ Lucky กี่ชิ้น</span>
                      {num(rules.gift.lucky, (n) =>
                        editRules((r) => ({ ...r, gift: { ...r.gift, lucky: n } })),
                      )}
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                    จับจากรายชื่อ VIP {vips.length} คน คนหนึ่งได้ชิ้นเดียว และคนที่ได้ Lucky Fan
                    หรือ Phone in ไปแล้วจะไม่ถูกจับซ้ำ
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" variant="ghost" onPress={() => editRules(() => DEFAULT_RULES)}>
                  คืนค่าเริ่มต้น
                </Button>
                <span className="text-[11px] text-slate-400">
                  แก้ค่าแล้วสุ่มใหม่ให้ทันทีทั้งสามรายการ
                </span>
              </div>
            </div>
          )}

          {/* The machine on the left, the list it is filling on the right.
              They are read against each other — a name lands and you look to
              see where it went — and stacking them put the list under the
              fold for the whole of the draw. */}
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="relative overflow-hidden rounded-xl2 bg-[#05060b] shadow-card">
                <LuckyDrawStage
                  pool={reelPool}
                  target={target}
                  onLanded={onLanded}
                  className="aspect-[16/9] w-full"
                />

                {/* The name is read off the DOM, not off the drum: the panel
                    is a texture on a curved-looking surface under coloured
                    light, and the person's own name should be crisp
                    somewhere. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[#0a0f24]/92 via-[#0a0f24]/55 to-transparent p-4 md:p-6">
                  <div className="min-w-0">
                    {nowShowing && !spinning ? (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
                          รางวัลที่ {nowShowing.order} / {seats}
                        </p>
                        <p className="truncate text-2xl font-medium tracking-tight text-white md:text-4xl">
                          {nowShowing.name || "(ไม่มีชื่อ)"}
                        </p>
                      </>
                    ) : (
                      <p className="text-[13px] font-semibold text-white/60">
                        {spinning
                          ? "กำลังจับ…"
                          : done
                            ? `ครบ ${seats} รางวัลแล้ว`
                            : "พร้อมจับรางวัล"}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-right text-[11px] text-white/40">
                    {tab === "gift" ? "รายชื่อ VIP" : "ผู้ร่วมสนุก"}{" "}
                    {reelPool.length.toLocaleString("th-TH")} คน
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onPress={() => setAuto(true)} isDisabled={running || done || seats === 0}>
                  <Play size={14} aria-hidden />
                  {seen === 0 ? "เริ่มจับรางวัล" : "เล่นต่อ"}
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
                    setRevealed((n) => ({ ...n, [tab]: seats }));
                  }}
                  isDisabled={done || seats === 0}
                >
                  <SkipForward size={14} aria-hidden /> ข้ามไปดูผล
                </Button>
                <Button variant="ghost" onPress={() => reroll()} isDisabled={seats === 0}>
                  <RotateCcw size={14} aria-hidden /> สุ่มใหม่ทั้งหมด
                </Button>
                <span className="ml-auto text-[12px] text-slate-500">
                  จับแล้ว {seen} / {seats}
                </span>
              </div>
            </div>

            {/* Sticks while the stage scrolls past on a short window, and
                scrolls inside itself rather than running the page long. */}
            <div className="rounded-xl2 bg-white p-4 shadow-card lg:sticky lg:top-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-brand-ink">ผู้โชคดี</p>
                <p className="text-[11px] text-slate-400">
                  {seen} / {seats}
                </p>
              </div>
              {seats === 0 ? (
                <p className="text-xs text-slate-400">
                  {tab === "gift"
                    ? "ยังไม่มีรายชื่อ VIP ในแคมเปญนี้"
                    : "ไม่มีใครเข้าเงื่อนไขของรายการนี้"}
                </p>
              ) : (
                /* Two columns once the list is long: twenty-five in one ran
                   past the bottom of the stage beside it. Filled down the
                   first column and then the second, not across — the list is
                   numbered, and a 1,2 / 3,4 that jumps sides on every name is
                   not a list anybody reads in order. */
                <ol
                  className={clsx(
                    "grid max-h-[62vh] gap-x-2 gap-y-1.5 overflow-y-auto pr-1",
                    seats > 6 && "grid-flow-col grid-cols-2",
                  )}
                  style={
                    seats > 6
                      ? { gridTemplateRows: `repeat(${Math.ceil(seats / 2)}, minmax(0, auto))` }
                      : undefined
                  }
                >
                  {Array.from({ length: seats }, (_, i) => {
                    const w = i < seen ? list[i] : null;
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
                        {/* Gift exchange hands out two different things, so
                            which one is the only thing worth saying here. */}
                        {w && tab === "gift" && (
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {w.band === "gold" ? "VIP" : "Lucky"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
