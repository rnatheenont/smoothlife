"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

// The one thing this page asks of the winner.
//
// Accepting is theirs to do, so it is theirs to do here rather than
// something support types in on the phone. Giving a prize up is not on this
// screen on purpose: a tap that hands ฿55,000 to the next person in line
// should not sit one tap away from "confirm", and anybody who means it can
// say so and have staff mark it.

export default function ClaimPrize({
  campaign,
  prizeId,
}: {
  campaign: string;
  prizeId: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function claim() {
    setState("sending");
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign)}/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prizeId }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "ยืนยันไม่สำเร็จ กรุณาลองใหม่");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("ยืนยันไม่สำเร็จ กรุณาลองใหม่");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-5 py-4 text-[15px] text-emerald-900 ring-1 ring-emerald-200">
        <Check size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          <span className="font-bold">ยืนยันรับรางวัลแล้ว</span>
          <br />
          ทีมงานจะติดต่อกลับเพื่อนัดรับรางวัล — ใช้เบอร์และอีเมลเดียวกับที่สั่งซื้อไว้
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={state === "sending"}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-8 text-[16px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50 sm:w-auto"
      >
        {state === "sending" && <Loader2 size={17} className="animate-spin" aria-hidden />}
        {state === "sending" ? "กำลังยืนยัน…" : "ยืนยันรับรางวัล"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
