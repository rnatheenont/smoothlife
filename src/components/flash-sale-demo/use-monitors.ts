"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlashSaleMonitor } from "@/lib/flash-sale";

import type { SharedSource } from "@/lib/flash-sale-sources";
import type { MonitorPayments } from "@/lib/flash-sale-monitor-payments";

export type Monitor = FlashSaleMonitor & {
  refunds: { invoice_no: string; amount: number; refund_note: string }[];
  sharedSources: SharedSource[];
  /** Only for a campaign watched on its own — see the monitor route. */
  payments?: MonitorPayments | null;
};

const POLL_MS = 5000;

/**
 * The live numbers for every campaign whose queue is open, in one request per
 * cycle. Each open campaign used to poll for itself, so watching four sales on
 * a launch day meant four round trips every five seconds.
 */
export function useMonitors(ids: string[], opts?: { detail?: boolean }) {
  const [monitors, setMonitors] = useState<Record<string, Monitor>>({});
  const [error, setError] = useState<string | null>(null);
  // When the numbers on screen were last true. A page that polls silently looks
  // identical to a page that stopped polling.
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  // The list of ids changes as rows open and close; the poller reads the
  // newest one rather than being torn down and rebuilt each time.
  const latest = useRef(ids);
  latest.current = ids;
  // Read the same way as the id list: an options object is a new object every
  // render, and putting it in the deps below would tear down the poller and
  // build it again five times a second.
  const wantDetail = useRef(false);
  wantDetail.current = Boolean(opts?.detail);

  const load = useCallback(async () => {
    const wanted = latest.current;
    if (wanted.length === 0) {
      setMonitors({});
      setError(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/flash-sale/campaigns/monitor?ids=${wanted.join(",")}${wantDetail.current ? "&detail=1" : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดข้อมูลคิวไม่สำเร็จ");
      setMonitors(json.monitors);
      setUpdatedAt(Date.now());
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

  return { monitors, error, updatedAt, reload: load };
}
