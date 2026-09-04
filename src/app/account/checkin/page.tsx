"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Gift, Coins, CheckCircle2, X, Sparkles, Flame, CalendarCheck } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import ProductCard from "@/components/ProductCard";
import { useAuth } from "@/lib/auth-context";
import { products } from "@/data/products";
import { REWARDS_ACTIVITIES_ENABLED } from "@/lib/feature-flags";
import { Button } from "@/components/ui";

type DayInfo = {
  date: string;
  dayNumber: number;
  status: "normal" | "recovery" | "recoverable" | "missed" | "today" | "upcoming";
};

type StatusResponse = {
  loggedIn: boolean;
  businessDate?: string;
  checkedInToday?: boolean;
  cycle: null | {
    id: string;
    status: string;
    completedDays: number;
    targetDays: number;
    dates: DayInfo[];
    day3RewardClaimed: boolean;
    day7RewardClaimed: boolean;
    day7CouponCode: string | null;
  };
  previousCycle?: { status: string; completedDays: number } | null;
  recovery: { costPerDay: number; pointBalance: number; recoverableDates: string[] };
  config: { cycleLength: number; day3Points: number; day7Points: number };
  monthlyAttendance?: { yearMonth: string; completedDays: number; requiredDays: number; rewarded: boolean };
  challenge?: { active: boolean; title: string; endDate: string; multiplier: number } | null;
};

const dayCircleStyle: Record<DayInfo["status"], string> = {
  normal: "bg-white text-brand-emerald shadow-sm",
  recovery: "bg-white text-brand-emerald shadow-sm",
  today: "bg-white text-brand-emerald shadow-lg ring-4 ring-amber-300/70 scale-110",
  recoverable: "bg-white text-amber-600 border-2 border-amber-400 shadow-sm",
  missed: "bg-white/10 text-white/40",
  upcoming: "bg-white/5 text-white/30 border border-dashed border-white/20",
};

function CheckinContent() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; body: string; coupon?: string | null } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/checkin");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMilestones(json: {
    day3Awarded?: boolean;
    day7Awarded?: boolean;
    day7Coupon?: string | null;
    challengeBonus?: number;
    monthlyAttendanceAwarded?: boolean;
  }) {
    const bonusText = json.challengeBonus ? ` (+${json.challengeBonus} แต้มโบนัส Challenge)` : "";
    if (json.day7Awarded) {
      setCelebration({
        title: "ครบ 7 วันแล้ว! 🎉",
        body: `รับ ${data?.config.day7Points ?? 100} แต้ม${bonusText}${json.day7Coupon ? " และคูปองส่วนลดพิเศษ" : ""}`,
        coupon: json.day7Coupon,
      });
    } else if (json.day3Awarded) {
      setCelebration({ title: "ครบ 3 วันแล้ว! 🎉", body: `รับ ${data?.config.day3Points ?? 30} แต้ม${bonusText}` });
    } else if (json.monthlyAttendanceAwarded) {
      setCelebration({ title: "เช็กอินครบทุกวันของเดือนแล้ว! 🎉", body: "รับ 200 แต้มพิเศษประจำเดือนค่ะ" });
    }
  }

  async function doCheckin() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setMessage(json.error || "เช็กอินไม่สำเร็จค่ะ");
      } else {
        handleMilestones(json);
        await load();
        refreshUser();
      }
    } catch {
      setMessage("เช็กอินไม่สำเร็จค่ะ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function doRecover(date: string) {
    setBusy(true);
    setMessage(null);
    setConfirmDate(null);
    try {
      const res = await fetch("/api/checkin/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage(json.error || "กู้วันเช็กอินไม่สำเร็จค่ะ");
      } else {
        handleMilestones(json);
        await load();
        refreshUser();
      }
    } catch {
      setMessage("กู้วันเช็กอินไม่สำเร็จค่ะ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const cycle = data.cycle;
  // Same cascading fallback as SearchContent's recommendedProducts — the
  // catalogue doesn't always have "Bestseller"-badged items in stock, so
  // fall through to Sale-badged, then any in-stock product, rather than
  // silently rendering an empty cross-sell section.
  const bestSellers = products
    .filter((p) => p.inStock && p.badges?.includes("Bestseller"))
    .concat(products.filter((p) => p.inStock && p.badges?.includes("Sale")))
    .concat(products.filter((p) => p.inStock))
    .filter((p, i, arr) => arr.findIndex((x) => x.slug === p.slug) === i)
    .slice(0, 4);

  const nextRewardDay = !cycle ? null : !cycle.day3RewardClaimed ? 3 : !cycle.day7RewardClaimed ? 7 : null;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-ink mb-1">เช็กอินรายวัน</h1>
      <p className="text-sm text-slate-500 mb-6">เช็กอินทุกวัน สะสมแต้ม ครบ 7 วันรับคูปองส่วนลดพิเศษ</p>

      {data.challenge?.active && (
        <div className="mb-6 rounded-xl2 bg-gradient-to-r from-amber-400 to-orange-400 p-[1px] shadow-card">
          <div className="rounded-[calc(theme(borderRadius.xl2)-1px)] bg-white flex items-center gap-3 px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
              <Flame size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand-ink truncate">{data.challenge.title}</p>
              <p className="text-xs text-amber-700">
                รับแต้มวันที่ 3 และ 7 <span className="font-bold">x{data.challenge.multiplier}</span> ถึงวันที่{" "}
                {new Date(data.challenge.endDate).toLocaleDateString("th-TH", { day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl2 bg-brand-gradient text-white p-5 md:p-7 mb-6 shadow-cardHover">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center justify-between mb-5 gap-3">
          <div>
            <p className="text-xs text-white/75 mb-0.5">แต้มสะสมของคุณ</p>
            <p className="text-3xl font-extrabold tracking-tight">
              {data.recovery.pointBalance.toLocaleString()} <span className="text-base font-semibold text-white/80">แต้ม</span>
            </p>
          </div>
          {!data.checkedInToday ? (
            <button
              onClick={doCheckin}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white text-brand-emerald font-bold px-5 py-2.5 text-sm shadow-card transition-transform active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {busy ? "กำลังเช็กอิน..." : "เช็กอินวันนี้"}
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-4 py-2.5 text-sm font-bold">
              <CheckCircle2 size={16} /> เช็กอินแล้ววันนี้
            </span>
          )}
        </div>

        {cycle ? (
          <div className="relative">
            <div className="flex items-center justify-between text-xs text-white/80 mb-3">
              <span className="inline-flex items-center gap-1.5 font-bold text-white">
                <Flame size={14} className="text-amber-300" />
                ความคืบหน้ารอบนี้ {cycle.completedDays}/{cycle.targetDays} วัน
              </span>
              {cycle.status === "recovery_available" && (
                <span className="rounded-full bg-amber-400/20 px-2.5 py-1 font-semibold text-amber-200">มีวันที่พลาด — กู้คืนได้</span>
              )}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute left-[18px] right-[18px] top-[18px] md:left-[22px] md:right-[22px] md:top-[22px] h-0.5 bg-white/20" />
              <div className="relative grid grid-cols-7 gap-1.5 md:gap-2">
                {cycle.dates.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={() => d.status === "recoverable" && setConfirmDate(d.date)}
                      disabled={d.status !== "recoverable"}
                      className={`relative z-10 grid h-9 w-9 md:h-11 md:w-11 place-items-center rounded-full text-xs font-bold transition-transform ${dayCircleStyle[d.status]} ${
                        d.status === "recoverable" ? "active:scale-95 cursor-pointer" : ""
                      }`}
                    >
                      {d.status === "normal" || d.status === "recovery" ? <CheckCircle2 size={16} /> : d.dayNumber}
                      {(d.dayNumber === 3 || d.dayNumber === 7) && (
                        <span className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-white shadow-sm">
                          <Gift size={9} />
                        </span>
                      )}
                    </button>
                    <span className={`text-[10px] ${d.status === "today" ? "font-bold text-white" : "text-white/60"}`}>
                      วัน {d.dayNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="relative text-sm text-white/90">เช็กอินวันนี้เพื่อเริ่มรอบใหม่ 7 วันค่ะ</p>
        )}
      </div>

      {message && (
        <div className="mb-6 rounded-xl2 bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600">{message}</div>
      )}

      <p className="text-xs font-bold uppercase text-brand-emerald tracking-wide mb-2.5">รางวัลตามเป้าหมาย</p>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div
          className={`relative rounded-xl2 border p-5 shadow-card transition-colors ${
            cycle?.day3RewardClaimed
              ? "border-brand-teal/40 bg-brand-gradient-soft"
              : nextRewardDay === 3
                ? "border-brand-emerald/50 bg-white ring-2 ring-brand-emerald/20"
                : "border-slate-100 bg-white"
          }`}
        >
          {nextRewardDay === 3 && (
            <span className="absolute -top-2.5 left-4 rounded-full bg-brand-gradient px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              เป้าหมายถัดไป
            </span>
          )}
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                cycle?.day3RewardClaimed ? "bg-brand-gradient text-white shadow-sm" : "bg-brand-gradient-soft text-brand-emerald"
              }`}
            >
              <Gift size={20} />
            </span>
            <div>
              <p className="font-bold text-brand-ink leading-tight">รางวัลวันที่ 3</p>
              <p className="text-lg font-bold text-brand-emerald leading-tight">
                +{data.config.day3Points} แต้ม
                {data.challenge?.active && (
                  <span className="ml-1 text-xs font-bold text-amber-600 align-middle">x{data.challenge.multiplier}</span>
                )}
              </p>
            </div>
          </div>
          {cycle?.day3RewardClaimed ? (
            <p className="flex items-center gap-1 text-xs font-semibold text-brand-emerald">
              <CheckCircle2 size={13} /> รับแล้ว
            </p>
          ) : (
            <p className="text-xs text-slate-400">เช็กอินครบ 3 วันติดต่อกันเพื่อรับรางวัล</p>
          )}
        </div>
        <div
          className={`relative rounded-xl2 border p-5 shadow-card transition-colors ${
            cycle?.day7RewardClaimed
              ? "border-brand-teal/40 bg-brand-gradient-soft"
              : nextRewardDay === 7
                ? "border-brand-emerald/50 bg-white ring-2 ring-brand-emerald/20"
                : "border-slate-100 bg-white"
          }`}
        >
          {nextRewardDay === 7 && (
            <span className="absolute -top-2.5 left-4 rounded-full bg-brand-gradient px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              เป้าหมายถัดไป
            </span>
          )}
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                cycle?.day7RewardClaimed ? "bg-brand-gradient text-white shadow-sm" : "bg-brand-gradient-soft text-brand-emerald"
              }`}
            >
              <Sparkles size={20} />
            </span>
            <div>
              <p className="font-bold text-brand-ink leading-tight">รางวัลวันที่ 7</p>
              <p className="text-lg font-bold text-brand-emerald leading-tight">
                +{data.config.day7Points} แต้ม
                {data.challenge?.active && (
                  <span className="ml-1 text-xs font-bold text-amber-600 align-middle">x{data.challenge.multiplier}</span>
                )}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-1">+ คูปองส่วนลด 10%</p>
          {cycle?.day7RewardClaimed ? (
            cycle.day7CouponCode ? (
              <p className="inline-block rounded-lg bg-white/70 px-2.5 py-1 font-mono text-xs font-bold text-brand-emerald border border-brand-teal/30">
                {cycle.day7CouponCode}
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs font-semibold text-brand-emerald">
                <CheckCircle2 size={13} /> รับแล้ว
              </p>
            )
          ) : (
            <p className="text-xs text-slate-400">เช็กอินครบ 7 วันเพื่อรับรางวัล</p>
          )}
        </div>
      </div>

      {data.monthlyAttendance && (
        <div>
          <p className="text-xs font-bold uppercase text-brand-emerald tracking-wide mb-2.5">เป้าหมายประจำเดือน</p>
          <div
            className={`rounded-xl2 border p-5 mb-8 shadow-card ${
              data.monthlyAttendance.rewarded ? "border-brand-teal/40 bg-brand-gradient-soft" : "border-slate-100 bg-white"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                  data.monthlyAttendance.rewarded ? "bg-brand-gradient text-white shadow-sm" : "bg-brand-gradient-soft text-brand-emerald"
                }`}
              >
                <CalendarCheck size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-brand-ink">เช็กอินครบทุกวันของเดือน</p>
                  <span className="shrink-0 text-lg font-bold text-brand-emerald">+200 แต้ม</span>
                </div>
                <p className="text-xs text-slate-400">รับ 200 แต้มพิเศษ เมื่อเช็กอินครบทุกวันที่มีสิทธิ์ในเดือนนี้</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span className="font-semibold text-brand-ink">
                  {data.monthlyAttendance.completedDays}/{data.monthlyAttendance.requiredDays} วัน
                </span>
                {data.monthlyAttendance.rewarded ? (
                  <span className="flex items-center gap-1 font-semibold text-brand-emerald">
                    <CheckCircle2 size={13} /> รับรางวัลแล้ว
                  </span>
                ) : (
                  <span className="text-slate-400">
                    เหลืออีก {Math.max(0, data.monthlyAttendance.requiredDays - data.monthlyAttendance.completedDays)} วัน
                  </span>
                )}
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div
                  className="h-full bg-brand-gradient rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (data.monthlyAttendance.completedDays / Math.max(1, data.monthlyAttendance.requiredDays)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {bestSellers.length > 0 && (
        <div>
          <h2 className="font-bold text-brand-ink mb-3">สินค้าขายดี ระหว่างรอครบรอบ</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {bestSellers.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}

      {confirmDate && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-brand-ink">ยืนยันกู้วันเช็กอิน</p>
              <button onClick={() => setConfirmDate(null)} aria-label="ปิด" className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              กู้วันที่ {new Date(confirmDate).toLocaleDateString("th-TH", { day: "numeric", month: "long" })}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold mb-4">
              <Coins size={14} /> ใช้ {data.recovery.costPerDay} แต้ม (คงเหลือ {data.recovery.pointBalance} แต้ม)
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmDate(null)} className="flex-1">
                ยกเลิก
              </Button>
              <Button
                onClick={() => doRecover(confirmDate)}
                disabled={busy || data.recovery.pointBalance < data.recovery.costPerDay}
                className="flex-1"
              >
                ยืนยัน
              </Button>
            </div>
            {data.recovery.pointBalance < data.recovery.costPerDay && (
              <p className="mt-2 text-xs text-rose-500">แต้มของคุณไม่พอสำหรับกู้วันนี้ค่ะ</p>
            )}
          </div>
        </div>
      )}

      {celebration && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl animate-fadeUp">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-brand-gradient-soft text-3xl">🎁</div>
            <p className="text-lg font-bold text-brand-ink mb-1">{celebration.title}</p>
            <p className="text-sm text-slate-600 mb-4">{celebration.body}</p>
            {celebration.coupon && (
              <div className="mb-4 rounded-xl border border-dashed border-brand-teal bg-brand-gradient-soft px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">โค้ดส่วนลดของคุณ</p>
                <p className="font-mono text-lg font-bold text-brand-emerald">{celebration.coupon}</p>
              </div>
            )}
            <div className="flex gap-2">
              {celebration.coupon && (
                <Button href="/cart" className="flex-1" onClick={() => setCelebration(null)}>
                  ไปใช้ในตะกร้า
                </Button>
              )}
              <Button
                variant={celebration.coupon ? "secondary" : "primary"}
                fullWidth={!celebration.coupon}
                onClick={() => setCelebration(null)}
                className={celebration.coupon ? "flex-1" : undefined}
              >
                ปิด
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckinPage() {
  const router = useRouter();
  useEffect(() => {
    if (!REWARDS_ACTIVITIES_ENABLED) router.replace("/account");
  }, [router]);
  if (!REWARDS_ACTIVITIES_ENABLED) return null;

  return (
    <AccountLayout>
      <CheckinContent />
    </AccountLayout>
  );
}
