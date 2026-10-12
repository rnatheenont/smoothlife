import type { CampaignPhase } from "./doc";

// What a campaign's four dates mean, and when the next one lands.
//
// The phase itself is decided in doc.ts (campaignPhaseAt) because sections
// ask for it at render time. This file holds the rest: the order the dates
// have to be in, what each phase is called in Thai, and the instant at which
// the page would render differently — which is what the scheduler stores so
// it can re-render a campaign the minute it goes live rather than whenever
// the next visitor happens to arrive.
//
// Pure, imports nothing but a type, tested in campaign.test.ts. A campaign
// that flips phase an hour late is the kind of mistake that is only ever
// noticed by the customer who was waiting for it.

export type CampaignTimes = {
  teaserAt?: string | null;
  liveAt?: string | null;
  extendedAt?: string | null;
  endsAt?: string | null;
};

export const PHASE_LABEL: Record<CampaignPhase, string> = {
  teaser: "ก่อนเริ่ม",
  live: "วันงาน",
  extended: "ขยายเวลา",
  ended: "จบแล้ว",
};

/** In the order a campaign moves through them. */
export const PHASE_ORDER: CampaignPhase[] = ["teaser", "live", "extended", "ended"];

function ms(value: string | null | undefined): number | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
}

/**
 * The next instant this campaign changes phase.
 *
 * Only dates that are actually set count, so a campaign with no "extended"
 * goes straight from live to ended, and one that is already over has no next
 * boundary at all.
 */
export function nextPhaseBoundaryAfter(times: CampaignTimes, now: Date): string | null {
  const at = now.getTime();
  let next: number | null = null;
  for (const value of [times.teaserAt, times.liveAt, times.extendedAt, times.endsAt]) {
    const t = ms(value);
    if (t === null || t <= at) continue;
    if (next === null || t < next) next = t;
  }
  return next === null ? null : new Date(next).toISOString();
}

/**
 * Whether the four dates make a campaign that can actually happen.
 *
 * Returns Thai sentences, because every caller shows them to the person who
 * typed the dates. Out-of-order dates are not rejected by campaignPhaseAt —
 * it reads from the end backwards and would simply skip a phase — so a
 * campaign whose "extended" is before its "live" would quietly never be
 * live at all. That is exactly the kind of thing to catch in a form rather
 * than at two in the morning on the day of the sale.
 */
export function validateCampaignTimes(times: CampaignTimes): string[] {
  const issues: string[] = [];
  const named: [string, number | null][] = [
    ["ก่อนเริ่ม", ms(times.teaserAt)],
    ["วันงาน", ms(times.liveAt)],
    ["ขยายเวลา", ms(times.extendedAt)],
    ["จบแคมเปญ", ms(times.endsAt)],
  ];

  for (const [label, value] of named) {
    if (value === null && valueWasGiven(times, label)) issues.push(`${label}: ไม่ใช่วันเวลาที่อ่านได้`);
  }

  // Compared only between the dates that are set, so a campaign still being
  // filled in is not told off for the blanks.
  const filled = named.filter(([, v]) => v !== null) as [string, number][];
  for (let i = 1; i < filled.length; i += 1) {
    const [prevLabel, prev] = filled[i - 1];
    const [label, value] = filled[i];
    if (value < prev) issues.push(`${label} ต้องอยู่หลัง ${prevLabel}`);
    else if (value === prev) issues.push(`${label} ซ้ำเวลากับ ${prevLabel} — ช่วงนั้นจะถูกข้ามไปเลย`);
  }

  return issues;
}

/** A date that was typed but came back unreadable, told apart from one that
 *  was simply left blank. */
function valueWasGiven(times: CampaignTimes, label: string): boolean {
  const raw =
    label === "ก่อนเริ่ม"
      ? times.teaserAt
      : label === "วันงาน"
        ? times.liveAt
        : label === "ขยายเวลา"
          ? times.extendedAt
          : times.endsAt;
  return typeof raw === "string" && raw.trim() !== "";
}
