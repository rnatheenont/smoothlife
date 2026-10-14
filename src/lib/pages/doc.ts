// The shape of a page, and the pure rules about it.
//
// A page is a list of sections in order. Each section says what type it is,
// carries its own settings, and carries "common" settings that mean the same
// thing whatever the type — hidden, a visibility window, which campaign phase
// it belongs to.
//
// Nothing in this file imports from the app. It holds the decisions that have
// to be right every time and are easiest to get subtly wrong — what counts as
// visible at 23:59 Bangkok time, what happens to a document written by last
// month's code — so it has to be testable without a database, a build, or a
// browser. See doc.test.ts.

/** Bumped when the *document* shape changes, not when a section changes. */
export const SCHEMA_VERSION = 1;

/** The most sections one page may hold. Shopify's own limit is 25; ours is
 *  lower because the performance budget in the plan is 20. A document with
 *  more is not rejected — the extras are dropped at render, which is the
 *  behaviour that keeps a page up rather than blanking it. */
export const MAX_SECTIONS = 20;

export type CampaignPhase = "teaser" | "live" | "extended" | "ended";

/**
 * How much room a section takes above and below what it draws.
 *
 * Steps rather than pixels, and an adjustment rather than a replacement:
 * every section already has spacing that suits it, and the page that needs
 * tuning needs a nudge, not a new ruleset. "ปกติ" is what the section does
 * on its own, which is why it is the default and why a document written
 * before this existed is unaffected.
 *
 * It exists because the alternative was adding a layout option to a section
 * every time one page wanted a little less room than another — which is how
 * a section ends up with settings that only one page uses.
 */
export type SpaceStep = "-2" | "-1" | "0" | "1" | "2";

export type SectionCommon = {
  /** Kept out of the page without being deleted, so it can come back. */
  hidden?: boolean;
  /** Extra room above and below, in steps of 8px. Absent means "ปกติ". */
  space?: { top?: SpaceStep; bottom?: SpaceStep };
  /** ISO instants. Absent means "no bound on that end". */
  visibleFrom?: string;
  visibleUntil?: string;
  /** Campaign pages only: which phases this section belongs to. Absent means
   *  every phase, which is what a section that is not phase-aware wants. */
  phases?: CampaignPhase[];
};

export type SectionInstance = {
  /** Stable across edits and revisions — it is what a preview click, an
   *  error report and a future A/B split all point at. */
  id: string;
  type: string;
  /** The section definition's version this settings object was written for.
   *  A section's own migrate() reads it. */
  v?: number;
  settings: unknown;
  common?: SectionCommon;
};

export type PageDoc = {
  schemaVersion: number;
  sections: SectionInstance[];
};

/** A document that is structurally wrong is not worth guessing about. */
export function isPageDoc(value: unknown): value is PageDoc {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<PageDoc>;
  return typeof doc.schemaVersion === "number" && Array.isArray(doc.sections);
}

/**
 * Brings a stored document up to the current schema version.
 *
 * Pure, and deliberately total: anything it cannot understand becomes an
 * empty document rather than an exception, because the caller's next move is
 * to fall back to the built-in page, and an exception there would take the
 * home page down instead of quietly replacing it.
 *
 * There is only one version so far, so this has nothing to do yet. It exists
 * now because the moment it is needed is the moment a document in production
 * is already in the old shape — adding it then is too late to be a migration.
 */
export function migrateDoc(value: unknown): PageDoc {
  if (!isPageDoc(value)) return { schemaVersion: SCHEMA_VERSION, sections: [] };

  const sections = value.sections.filter(
    (s): s is SectionInstance =>
      Boolean(s) && typeof s === "object" && typeof s.id === "string" && typeof s.type === "string"
  );

  // Future versions chain here: if (doc.schemaVersion < 2) sections = v1ToV2(sections)
  return { schemaVersion: SCHEMA_VERSION, sections };
}

/**
 * Whether a section should be on the page right now.
 *
 * `now` is passed in rather than read from the clock so that a preview can
 * ask "what will this look like on the 11th" and so that the tests can cross
 * a boundary without waiting for one.
 *
 * Both bounds are inclusive of the start and exclusive of the end — a window
 * ending at 00:00 is over at 00:00, which is how a person reading "ถึง
 * เที่ยงคืน" expects it to behave, and avoids two sections both claiming the
 * same instant when one hands over to the next.
 */
export function isVisible(common: SectionCommon | undefined, now: Date, phase?: CampaignPhase): boolean {
  if (!common) return true;
  if (common.hidden) return false;

  const at = now.getTime();
  if (common.visibleFrom) {
    const from = Date.parse(common.visibleFrom);
    // An unparseable date is treated as no bound. The alternative is hiding
    // the section, which turns one bad character in a form into a hole in
    // the page that nobody can explain.
    if (Number.isFinite(from) && at < from) return false;
  }
  if (common.visibleUntil) {
    const until = Date.parse(common.visibleUntil);
    if (Number.isFinite(until) && at >= until) return false;
  }

  if (phase && common.phases && common.phases.length > 0 && !common.phases.includes(phase)) {
    return false;
  }
  return true;
}

/**
 * Which phase a campaign is in at `now`.
 *
 * The four instants are optional and may be partly filled in while someone is
 * still setting the campaign up, so this reads them from the end backwards
 * and stops at the first one that has passed. A campaign with nothing set is
 * "live", because a page with no schedule is a page that is simply on.
 */
export function campaignPhaseAt(
  times: { teaserAt?: string | null; liveAt?: string | null; extendedAt?: string | null; endsAt?: string | null },
  now: Date
): CampaignPhase {
  const at = now.getTime();
  const ms = (v: string | null | undefined) => {
    if (!v) return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  };

  const ends = ms(times.endsAt);
  if (ends !== null && at >= ends) return "ended";
  const extended = ms(times.extendedAt);
  if (extended !== null && at >= extended) return "extended";
  const live = ms(times.liveAt);
  if (live !== null && at >= live) return "live";
  const teaser = ms(times.teaserAt);
  if (teaser !== null && at >= teaser) return "teaser";

  // Before the teaser starts there is nothing to show yet; with no schedule
  // at all, the page is just on.
  return teaser !== null ? "teaser" : "live";
}

/**
 * The next instant at which this document would render differently.
 *
 * Stored on the page when it is published so the scheduler can ask "which
 * pages need re-rendering in the next minute" with one indexed comparison
 * instead of opening every document.
 */
export function nextBoundaryAfter(doc: PageDoc, now: Date): string | null {
  const at = now.getTime();
  let next: number | null = null;
  for (const section of doc.sections) {
    for (const value of [section.common?.visibleFrom, section.common?.visibleUntil]) {
      if (!value) continue;
      const t = Date.parse(value);
      if (!Number.isFinite(t) || t <= at) continue;
      if (next === null || t < next) next = t;
    }
  }
  return next === null ? null : new Date(next).toISOString();
}
