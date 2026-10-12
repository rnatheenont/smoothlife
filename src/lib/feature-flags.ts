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
