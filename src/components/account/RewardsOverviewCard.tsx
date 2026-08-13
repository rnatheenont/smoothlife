"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { tierBadge } from "@/lib/tier";

type DayInfo = { date: string; dayNumber: number; status: string };
type StatusResponse = {
  checkedInToday?: boolean;
  cycle: null | { completedDays: number; targetDays: number; dates: DayInfo[]; status: string };
  recovery: { pointBalance: number };
};

const dotStyle: Record<string, string> = {
  normal: "bg-white text-brand-emerald",
  recovery: "bg-white text-brand-emerald",
  today: "border-2 border-white text-white",
  recoverable: "bg-amber-300 text-amber-900",
  missed: "bg-white/20 text-white/50",
  upcoming: "bg-white/10 text-white/40",
};

// Combines points balance/tier and daily check-in progress into one glanceable
// dashboard card — previously two separate small shortcut tiles that hid both
// the real balance and the whole point of check-in (today's actual action).
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
    load();
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
  const TierIcon = badge.icon;
  const pointBalance = data?.recovery.pointBalance ?? user.points;

  return (
    <div className="rounded-xl2 bg-brand-gradient text-white p-5 md:p-6 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-white/80">แต้มสะสมของคุณ</p>
        <Link href="/account/points" className="flex items-center gap-0.5 text-xs text-white/80 hover:text-white">
          ดูทั้งหมด <ChevronRight size={12} />
        </Link>
      </div>
      <div className="flex items-end justify-between mb-4">
        <p className="text-3xl font-bold">
          {loading ? "…" : pointBalance.toLocaleString()} <span className="text-base font-medium">แต้ม</span>
        </p>
        <span className={`flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold ${badge.className}`}>
          <TierIcon size={12} /> Lv.{badge.level}
        </span>
      </div>

      <div className="border-t border-white/20 pt-4">
        <div className="flex items-center justify-between mb-2.5 gap-3">
          <Link href="/account/checkin" className="text-sm font-semibold hover:underline">
            เช็กอินรายวัน{data?.cycle ? ` — ${data.cycle.completedDays}/${data.cycle.targetDays} วัน` : ""}
          </Link>
          {!loading &&
            (data?.checkedInToday ? (
              <span className="flex items-center gap-1 shrink-0 text-xs font-semibold text-white/90">
                <CheckCircle2 size={13} /> เช็กอินแล้ว
              </span>
            ) : (
              <button
                onClick={doCheckin}
                disabled={busy}
                className="shrink-0 rounded-full bg-white text-brand-emerald font-bold px-3.5 py-1.5 text-xs disabled:opacity-60"
              >
                {busy ? "..." : "เช็กอินวันนี้"}
              </button>
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
          <Link href="/account/checkin" className="mt-2 block text-xs font-semibold text-amber-200 hover:underline">
            มีวันที่พลาด — กู้คืนได้ →
          </Link>
        )}
      </div>
    </div>
  );
}
