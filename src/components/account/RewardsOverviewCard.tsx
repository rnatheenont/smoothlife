"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronRight, Crown, Gift } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";
import { tierBadge, tierCard, tierDisplayName, tierPerks } from "@/lib/tier";
import { TIER_CRITERIA } from "@/lib/loyalty-shared";
import type { Tier } from "@/lib/auth-context";
import { DAILY_CHECKIN_ENABLED, REWARDS_ACTIVITIES_ENABLED } from "@/lib/feature-flags";
import { loyaltyTierProgress } from "@/lib/loyalty-shared";
import { formatTHB } from "@/lib/format";
import { Avatar, Button } from "@/components/ui";

type DayInfo = { date: string; dayNumber: number; status: string };
type StatusResponse = {
  checkedInToday?: boolean;
  cycle: null | { completedDays: number; targetDays: number; dates: DayInfo[]; status: string };
  recovery: { pointBalance: number };
};

const dotStyle: Record<string, string> = {
  normal: "bg-brand-gradient text-white",
  recovery: "bg-brand-gradient text-white",
  today: "border-2 border-brand-emerald text-brand-800 bg-white",
  recoverable: "bg-amber-100 text-amber-700 border border-amber-300",
  missed: "bg-slate-100 text-slate-500",
  upcoming: "bg-slate-50 text-slate-300 border border-dashed border-slate-200",
};

// Real user id, just grouped like a card number — not a fabricated "member
// number" system, this is their actual account id.
function formatMemberId(id: string) {
  const clean = id.replace(/-/g, "").toUpperCase().slice(0, 12);
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

function formatThaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

// Combines points balance/tier and daily check-in progress into one glanceable
// dashboard card, styled as an actual membership card (tier-toned gradient,
// member name/number/since) — previously two separate small shortcut tiles
// that hid both the real balance and today's actual check-in action.
export default function RewardsOverviewCard() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
    if (REWARDS_ACTIVITIES_ENABLED) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doCheckin() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        await load();
        refreshUser();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  const badge = tierBadge[user.tier];
  const card = tierCard[user.tier];
  const TierIcon = badge.icon;
  const pointBalance = data?.recovery.pointBalance ?? user.points;
  const spend = user.tierSpend ?? 0;
  const progress = loyaltyTierProgress(spend, user.tierOrders ?? 0);
  const topThreshold = TIER_CRITERIA[TIER_CRITERIA.length - 1].minSpend;
  const nextThreshold = TIER_CRITERIA.find((t) => t.name === progress.next)?.minSpend ?? topThreshold;
  const nextPerk = progress.next ? tierPerks[progress.next as Tier]?.[0] : null;
  // Position along the whole ladder rather than within one segment: the point
  // of the bar is to show where they stand overall, and a segment-relative
  // bar jumps backwards to near-zero every time someone levels up.
  const ladderPercent = Math.min(100, Math.round((spend / topThreshold) * 100));

  return (
    <div className="rounded-2xl overflow-hidden shadow-cardHover">
      {/* Card face */}
      <div className="relative p-5 md:p-6 text-white" style={{ background: card.gradient }}>
        <div
          className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full"
          style={{ background: card.shine }}
        />
        <div
          className="pointer-events-none absolute -right-4 top-16 h-20 w-20 rounded-full"
          style={{ background: card.shine }}
        />

        <div className="relative flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Smooth Life Membership</p>
            <p className="text-lg font-extrabold">
              Smoothlife<span className="opacity-80">.com</span>
            </p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur">
            <TierIcon size={20} />
          </div>
        </div>

        <div className="relative flex items-center gap-3 mb-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur text-lg font-bold overflow-hidden ring-2 ring-white/70">
            <Avatar src={user.avatar} name={user.name} className="h-12 w-12" />
          </span>
          <div className="min-w-0">
            <p className="text-xl md:text-2xl font-bold truncate">{user.name}</p>
            <p className="text-[11px] text-white/70">สมาชิกตั้งแต่ {formatThaiDate(user.createdAt)}</p>
          </div>
        </div>

        <div className="relative flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/60 mb-0.5">เลขสมาชิก</p>
            <p className="font-mono text-sm tracking-widest">{formatMemberId(user.id)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-white/60 mb-0.5">{tierDisplayName[user.tier].en} Member</p>
            <p className="text-xl font-extrabold">Lv.{badge.level}</p>
          </div>
        </div>
      </div>

      {/* Points + check-in panel — hidden while กิจกรรมและรางวัล is off */}
      {REWARDS_ACTIVITIES_ENABLED && (
      <div className="bg-white p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">แต้มสะสมของคุณ</p>
            <p className="text-2xl font-bold text-brand-ink">
              {loading ? "…" : pointBalance.toLocaleString()}{" "}
              <span className="text-sm font-medium text-slate-500">แต้ม</span>
            </p>
          </div>
          <Link href="/account/points" className="flex items-center gap-0.5 text-xs font-semibold text-brand-800">
            ดูทั้งหมด <ChevronRight size={12} />
          </Link>
        </div>

        {/* The ladder, not just the next rung.
            It used to read "อีก ฿3,000 ถึง Silver" over an empty bar: a target
            with no progress attached and no reason to want it. */}
        <div className="relative overflow-hidden rounded-xl2 border border-slate-100 bg-white p-4 shadow-card">
          {/* A wash of the member's own tier colour, so the block belongs to
              the card above it instead of looking like a generic panel. */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-[0.13]"
            style={{ background: card.gradient }}
          />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                ยอดสะสมระดับสมาชิก
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold leading-none text-brand-ink">{formatTHB(spend)}</span>
                {progress.next && (
                  <span className="text-xs font-medium text-slate-500">/ {formatTHB(nextThreshold)}</span>
                )}
              </p>
            </div>
            <span
              className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm"
              style={{ background: card.gradient }}
            >
              <TierIcon size={12} />
              {tierDisplayName[user.tier].en}
            </span>
          </div>

          {/* One continuous ladder with the rungs marked, so "where am I" is
              answered by looking rather than by reading a number. */}
          <div className="relative mt-4 mb-7">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="relative h-full rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.max(ladderPercent, 2)}%`, background: card.gradient }}
              >
                {/* A soft highlight along the fill — the difference between a
                    progress bar and a coloured rectangle. */}
                <span className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/25" />
              </div>
            </div>

            {TIER_CRITERIA.map((t) => {
              const at = (t.minSpend / topThreshold) * 100;
              const reached = spend >= t.minSpend;
              const isCurrent = t.name === user.tier;
              return (
                <div
                  key={t.name}
                  className={clsx(
                    "absolute -top-0.5 flex flex-col",
                    at <= 0 ? "items-start" : at >= 100 ? "items-end -translate-x-full" : "-translate-x-1/2 items-center"
                  )}
                  style={{ left: `${Math.min(at, 100)}%` }}
                >
                  <span
                    className={clsx(
                      "grid place-items-center rounded-full border-2 border-white transition-colors",
                      isCurrent ? "h-4 w-4 shadow-sm ring-2 ring-white" : "h-3.5 w-3.5",
                      reached ? "" : "bg-slate-200"
                    )}
                    style={reached ? { background: card.gradient } : undefined}
                  >
                    {reached && <Check size={8} className="text-white" strokeWidth={4} />}
                  </span>
                  <span
                    className={clsx(
                      "mt-1.5 whitespace-nowrap text-[10px] tracking-wide",
                      isCurrent ? "font-bold text-brand-ink" : reached ? "font-semibold text-slate-500" : "text-slate-500"
                    )}
                  >
                    {tierDisplayName[t.name].en}
                  </span>
                </div>
              );
            })}
          </div>

          {progress.next ? (
            <div className="relative flex items-start gap-2 rounded-lg bg-brand-gradient-soft px-3 py-2.5">
              <Gift size={14} className="mt-0.5 shrink-0 text-brand-emerald" />
              <p className="text-[11px] leading-relaxed text-slate-600">
                อีก <span className="font-bold text-brand-800">{formatTHB(progress.remaining)}</span> ก็ขึ้นระดับ{" "}
                <span className="font-bold text-brand-ink">{tierDisplayName[progress.next as Tier].en}</span>
                {nextPerk ? (
                  <>
                    <br />
                    <span className="text-slate-500">รับทันที: {nextPerk}</span>
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <div className="relative flex items-center gap-2 rounded-lg bg-brand-gradient-soft px-3 py-2.5">
              <Crown size={14} className="shrink-0 text-brand-emerald" />
              <p className="text-[11px] font-semibold text-brand-ink">
                คุณอยู่ระดับสูงสุดแล้ว ขอบคุณที่อยู่กับเรานะคะ
              </p>
            </div>
          )}
          <p className="relative mt-2 text-[10px] text-slate-500">
            นับยอดซื้อ 12 เดือนล่าสุด · อัปเดตอัตโนมัติหลังคำสั่งซื้อสำเร็จ
          </p>
        </div>

        {DAILY_CHECKIN_ENABLED && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2.5 gap-3">
            <Link href="/account/checkin" className="text-sm font-semibold text-brand-ink hover:text-brand-800">
              เช็กอินรายวัน{data?.cycle ? ` — ${data.cycle.completedDays}/${data.cycle.targetDays} วัน` : ""}
            </Link>
            {!loading &&
              (data?.checkedInToday ? (
                <span className="flex items-center gap-1 shrink-0 text-xs font-semibold text-brand-800">
                  <CheckCircle2 size={13} /> เช็กอินแล้ว
                </span>
              ) : (
                <Button size="none" className="px-3.5 py-1.5 text-xs shrink-0" onClick={doCheckin} disabled={busy}>
                  {busy ? "…" : "เช็กอินวันนี้"}
                </Button>
              ))}
          </div>

          {data?.cycle && (
            <div className="flex gap-1.5">
              {data.cycle.dates.map((d) => (
                <span
                  key={d.date}
                  className={`grid h-6 w-6 flex-1 place-items-center rounded-full text-[10px] font-bold ${
                    dotStyle[d.status] || dotStyle.upcoming
                  }`}
                >
                  {d.status === "normal" || d.status === "recovery" ? <CheckCircle2 size={11} /> : d.dayNumber}
                </span>
              ))}
            </div>
          )}

          {data?.cycle?.status === "recovery_available" && (
            <Link href="/account/checkin" className="mt-2 block text-xs font-semibold text-amber-600 hover:underline">
              มีวันที่พลาด — กู้คืนได้ →
            </Link>
          )}
        </div>
        )}
      </div>
      )}
    </div>
  );
}
