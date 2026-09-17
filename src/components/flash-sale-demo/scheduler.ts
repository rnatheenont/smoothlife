// The campaign list and its automatic run: each campaign has a start (and
// optionally an end) date and time; when the clock reaches the start it opens
// by itself, and at the end time it closes by itself. In the real system this
// is the `starts_at` / `ends_at` pair on `flash_sale` plus the pg_cron job
// (plan §7) that flips `status` — nobody has to be at a keyboard at midnight.
//
// The demo clock starts at the real current date and time and runs at the
// demo speed, so "tonight at 20:00" can be watched arrive in a few seconds.

import { closeCampaign, createCampaign, tickCampaign, type CampaignConfig, type CampaignState } from "./campaign";

export type ItemStatus = "scheduled" | "running" | "ended";

export type ScheduledCampaign = {
  id: string;
  config: CampaignConfig;
  startsAt: number; // epoch ms
  endsAt?: number; // epoch ms
  /** Set when an admin ended (or cancelled) it by hand — stored in the database. */
  endedManuallyAt?: number;
  status: ItemStatus;
  campaign?: CampaignState;
  endReason?: "sold_out" | "time_up" | "manual";
};

export type SchedulerState = {
  baseMs: number;
  clock: number; // simulated seconds since baseMs
  items: ScheduledCampaign[];
  shopifyDown: boolean;
  seq: number;
};

export const nowMs = (s: SchedulerState) => s.baseMs + s.clock * 1000;

export function createScheduler(baseMs: number): SchedulerState {
  return { baseMs, clock: 0, items: [], shopifyDown: false, seq: 1 };
}

export type CampaignInput = { id?: string; config: CampaignConfig; startsAt: number; endsAt?: number; endedManuallyAt?: number };

export function addCampaign(s: SchedulerState, item: CampaignInput): SchedulerState {
  const entry: ScheduledCampaign = {
    id: item.id ?? `local-${s.seq}`,
    config: item.config,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    endedManuallyAt: item.endedManuallyAt,
    status: "scheduled",
  };
  return runDue({ ...s, seq: s.seq + 1, items: [...s.items.filter((i) => i.id !== entry.id), entry].sort((a, b) => a.startsAt - b.startsAt) });
}

/** Replace the whole list with what the database holds (on page load). */
export function loadCampaigns(s: SchedulerState, items: CampaignInput[]): SchedulerState {
  return items.reduce(addCampaign, { ...s, items: [] });
}

export function removeCampaign(s: SchedulerState, id: string): SchedulerState {
  return { ...s, items: s.items.filter((i) => i.id !== id) };
}

export function startNow(s: SchedulerState, id: string): SchedulerState {
  return runDue({ ...s, items: s.items.map((i) => (i.id === id && i.status === "scheduled" ? { ...i, startsAt: nowMs(s) } : i)) });
}

export function endNow(s: SchedulerState, id: string, at = nowMs(s)): SchedulerState {
  return runDue({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, endedManuallyAt: at } : i)) });
}

export function updateCampaign(s: SchedulerState, id: string, fn: (c: CampaignState) => CampaignState): SchedulerState {
  return { ...s, items: s.items.map((i) => (i.id === id && i.campaign ? { ...i, campaign: fn(i.campaign) } : i)) };
}

/** Start whatever is due and close whatever has reached its end time. */
function runDue(s: SchedulerState): SchedulerState {
  const now = nowMs(s);
  return {
    ...s,
    items: s.items.map((i) => {
      if (i.status !== "ended" && i.endedManuallyAt !== undefined) {
        return { ...i, status: "ended", endReason: "manual", campaign: i.campaign ? closeCampaign(i.campaign) : undefined };
      }
      if (i.status === "scheduled" && now >= i.startsAt) {
        return { ...i, status: "running", campaign: tickCampaign(createCampaign(i.config, 0), 0) };
      }
      if (i.status === "running" && i.campaign) {
        if (i.endsAt && now >= i.endsAt) return { ...i, status: "ended", endReason: "time_up", campaign: closeCampaign(i.campaign) };
        if (i.campaign.sales.every((x) => x.sale.status === "sold_out")) return { ...i, status: "ended", endReason: "sold_out" };
      }
      return i;
    }),
  };
}

export function tickScheduler(s: SchedulerState, dt: number): SchedulerState {
  const moved: SchedulerState = {
    ...s,
    clock: s.clock + dt,
    // Ended campaigns keep ticking: reservations taken before the close can
    // still be paid, and their Shopify orders still need creating.
    items: s.items.map((i) => (i.campaign ? { ...i, campaign: tickCampaign({ ...i.campaign, shopifyDown: s.shopifyDown }, dt) } : i)),
  };
  return runDue(moved);
}

const TH_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" };
export const thaiDateTime = (ms: number) => new Date(ms).toLocaleString("th-TH", TH_DATE);

/** "2 ชม. 05 นาที" / "04:12" style countdown for longer waits. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${String(m).padStart(2, "0")} นาที`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** For <input type="datetime-local">, in Bangkok time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms + 7 * 3600_000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(value: string): number {
  return new Date(`${value}:00+07:00`).getTime();
}
