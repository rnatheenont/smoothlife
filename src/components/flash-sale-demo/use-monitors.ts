"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlashSaleMonitor } from "@/lib/flash-sale";

export type Monitor = FlashSaleMonitor & { refunds: { invoice_no: string; amount: number; refund_note: string }[] };

const POLL_MS = 5000;

/**
 * The live numbers for every campaign whose queue is open, in one request per
 * cycle. Each open campaign used to poll for itself, so watching four sales on
 * a launch day meant four round trips every five seconds.
 */
export function useMonitors(ids: string[]) {
  const [monitors, setMonitors] = useState<Record<string, Monitor>>({});
  const [error, setError] = useState<string | null>(null);
  // The list of ids changes as rows open and close; the poller reads the
  // newest one rather than being torn down and rebuilt each time.
  const latest = useRef(ids);
  latest.current = ids;

  const load = useCallback(async () => {
    const wanted = latest.current;
    if (wanted.length === 0) {
      setMonitors({});
      setError(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/flash-sale/campaigns/monitor?ids=${wanted.join(",")}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดข้อมูลคิวไม่สำเร็จ");
      setMonitors(json.monitors);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลคิวไม่สำเร็จ");
    }
  }, []);

  const key = ids.join(",");
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(timer);
  }, [key, load]);

  return { monitors, error, reload: load };
}
