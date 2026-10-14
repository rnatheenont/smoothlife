// Re-enabled 2026-08-31 per explicit request. Gates the "กิจกรรมและรางวัล"
// nav group (เช็กอินรายวัน, คะแนนสะสม, อันดับ) and its 3 routes.
export const REWARDS_ACTIVITIES_ENABLED = true;

// Daily check-in, hidden 2026-09-08 per request. Kept as a flag rather than
// deleted: the cycle, its recovery rules and the API behind it all still work,
// so this is a switch to flip back, not a feature to rebuild.
export const DAILY_CHECKIN_ENABLED = false;

// The home page rendered from a stored document instead of from the markup in
// app/page.tsx (see src/lib/pages). Off until the document has been seeded and
// compared against the page it replaces.
//
// This is the emergency switch for the whole Customize Page feature on the
// home page: turning it off puts the hard-coded page back on the next request,
// with no deploy and nothing to roll back.
export const PAGES_HOME_ENABLED = process.env.NEXT_PUBLIC_PAGES_HOME_ENABLED === "1";

// Brand pages (/brands/[slug]) rendered from a document — the automatic brand
// template, or a page the team laid out in the editor — instead of the fixed
// markup in app/brands/[slug]/page.tsx. Same idea and same switch as the home
// page's: off puts the hand-written page back on the next request.
//
// What changes when it is turned on, for a brand nobody has touched: shelves
// show two full rows at every width (ten cards on a desktop, not eight with a
// row of three), and anything filled in on the brand's profile appears.
export const PAGES_BRAND_ENABLED = process.env.NEXT_PUBLIC_PAGES_BRAND_ENABLED === "1";

// The waves of the "every page into the page system" plan, one switch each.
//
// A wave is a group of pages that move over together (see
// src/lib/pages/system-pages.ts). Separate switches rather than one, because
// the pages in a wave share a risk — wave 1 is copy, wave 2 wraps the product
// listings, wave 3 is the product page itself — and the whole point of
// turning one on is being able to turn that one off again without taking the
// ones that are already fine down with it.
//
// Off means the hand-written route keeps serving, exactly as today. Nothing
// reads a stored document for these pages until its wave is on.
// Written out one by one rather than built from a template string: the
// bundler replaces `process.env.NEXT_PUBLIC_*` at build time only when it can
// see the whole name, and a computed one would read undefined in the browser
// — a switch that is on in the server's copy of the page and off in the
// client's is the worst of the three possible states.
export const PAGES_WAVE1_ENABLED = process.env.NEXT_PUBLIC_PAGES_WAVE1_ENABLED === "1";
export const PAGES_WAVE2_ENABLED = process.env.NEXT_PUBLIC_PAGES_WAVE2_ENABLED === "1";
export const PAGES_WAVE3_ENABLED = process.env.NEXT_PUBLIC_PAGES_WAVE3_ENABLED === "1";
export const PAGES_WAVE4_ENABLED = process.env.NEXT_PUBLIC_PAGES_WAVE4_ENABLED === "1";
export const PAGES_WAVE5_ENABLED = process.env.NEXT_PUBLIC_PAGES_WAVE5_ENABLED === "1";

/** Whether a wave is on. The five constants above are what the bundler can
 *  inline and tree-shake; this is for code that has a wave number in hand. */
export function waveEnabled(wave: number): boolean {
  switch (wave) {
    case 1:
      return PAGES_WAVE1_ENABLED;
    case 2:
      return PAGES_WAVE2_ENABLED;
    case 3:
      return PAGES_WAVE3_ENABLED;
    case 4:
      return PAGES_WAVE4_ENABLED;
    case 5:
      return PAGES_WAVE5_ENABLED;
    default:
      return false;
  }
}
