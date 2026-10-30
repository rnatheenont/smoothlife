// Which outfit Smoothie wears. The team picks it in the admin panel
// (/admin/mascot, stored in mascot_settings): "auto" follows the seasonal
// calendar below, or one outfit can be forced either way.
//
// To add a season: a row in SEASONS, its layers in smoothie-engine.ts, the
// value in MASCOT_THEMES, and the same value in the table's check constraint.

export type MascotTheme = "default" | "halloween" | "christmas" | "newyear";
export type MascotThemeSetting = "auto" | MascotTheme;

export const MASCOT_THEMES: MascotTheme[] = ["default", "halloween", "christmas", "newyear"];
export const isMascotThemeSetting = (v: unknown): v is MascotThemeSetting =>
  v === "auto" || MASCOT_THEMES.includes(v as MascotTheme);

/** Inclusive date windows, as month-day in Bangkok time. A window may run over New Year (from > to). */
export const SEASONS: { theme: MascotTheme; from: string; to: string }[] = [
  { theme: "halloween", from: "10-25", to: "11-01" },
  { theme: "christmas", from: "12-01", to: "12-26" },
  // the balloons say "2027" — new art each year (smoothlife-mascot/newyear/)
  { theme: "newyear", from: "12-27", to: "01-05" },
];

/** What the calendar says, ignoring the setting. */
export function seasonalTheme(now: Date = new Date()): MascotTheme {
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
  const md = `${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
  const inSeason = (s: (typeof SEASONS)[number]) =>
    s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to;
  return SEASONS.find(inSeason)?.theme ?? "default";
}

export function mascotTheme(setting: MascotThemeSetting = "auto", now: Date = new Date()): MascotTheme {
  return setting === "auto" ? seasonalTheme(now) : setting;
}

/** The still picture (shown before the rig starts) and chat avatar for a theme. */
export const themedFile = (theme: MascotTheme, file: "still.webp" | "avatar.webp") =>
  theme === "default" ? file : file.replace(".webp", `-${theme}.webp`);
