// Re-enabled 2026-08-31 per explicit request. Gates the "กิจกรรมและรางวัล"
// nav group (เช็กอินรายวัน, คะแนนสะสม, อันดับ) and its 3 routes.
export const REWARDS_ACTIVITIES_ENABLED = true;

// Daily check-in, hidden 2026-09-08 per request. Kept as a flag rather than
// deleted: the cycle, its recovery rules and the API behind it all still work,
// so this is a switch to flip back, not a feature to rebuild.
export const DAILY_CHECKIN_ENABLED = false;
