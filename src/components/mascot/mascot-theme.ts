// Which outfit Smoothie wears. Seasonal outfits switch themselves on and off
// by date (Bangkok time); MASCOT_THEME_OVERRIDE forces one either way.
//
// To take a costume off early, or keep it on: set the override and deploy.
// To add a season: a row in SEASONS plus its layers in smoothie-engine.ts.

export type MascotTheme = "default" | "halloween";

/** null = follow the calendar below; "default" or "halloween" = always that one. */
export const MASCOT_THEME_OVERRIDE: MascotTheme | null = null;

/** Inclusive date windows, as month-day in Bangkok time. */
const SEASONS: { theme: MascotTheme; from: string; to: string }[] = [
  { theme: "halloween", from: "10-25", to: "11-01" },
];

export function mascotTheme(now: Date = new Date()): MascotTheme {
  if (MASCOT_THEME_OVERRIDE) return MASCOT_THEME_OVERRIDE;
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
  const md = `${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
  return SEASONS.find((s) => md >= s.from && md <= s.to)?.theme ?? "default";
}

/** The still picture (shown before the rig starts) and chat avatar for a theme. */
export const themedFile = (theme: MascotTheme, file: "still.webp" | "avatar.webp") =>
  theme === "default" ? file : file.replace(".webp", `-${theme}.webp`);
