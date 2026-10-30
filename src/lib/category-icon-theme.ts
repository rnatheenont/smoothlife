/**
 * The look of the round shortcuts under the hero.
 *
 * "line" is the drawn marks the row has always used — one flat SVG each,
 * inline, no request. The other two are rendered sets: the same eight
 * categories as little 3D objects, and a Halloween dressing of those for
 * October. They are pictures, so they are files rather than components.
 *
 * Browser-safe and free of JSX on purpose: the section's settings are JSON
 * and can only carry a key, so the key has to mean the same thing to the
 * admin's select, to the strip that draws it, and to whatever reads it next.
 */
export const ICON_THEMES = ["line", "3d", "halloween"] as const;
export type IconTheme = (typeof ICON_THEMES)[number];

export const ICON_THEME_LABEL: Record<IconTheme, string> = {
  line: "ลายเส้น (ค่าเริ่มต้น)",
  "3d": "สามมิติ",
  halloween: "ฮาโลวีน",
};

/**
 * Which icon keys each rendered set actually has a picture for.
 *
 * The sale disc is not in here because it carries the word "Sale" rather than
 * a mark, and all-categories was never drawn. A key that is missing falls back
 * to its line mark rather than to a gap — see CategoryIconRow.
 *
 * personal-care and body-care only exist in the 3d set. They were drawn for
 * the header menu, whose six categories are the shop's own taxonomy rather
 * than this strip's eight shortcuts — and those two are in it. The halloween
 * set has no pictures for them, which is why hasRenderedIcon takes the theme.
 */
const RENDERED_KEYS: Record<Exclude<IconTheme, "line">, readonly string[]> = {
  "3d": [
    "top-brand",
    "skincare",
    "oral-care",
    "wellness",
    "hair-care",
    "for-men",
    "accessories",
    "first-aid",
    "personal-care",
    "body-care",
  ],
  halloween: [
    "top-brand",
    "skincare",
    "oral-care",
    "wellness",
    "hair-care",
    "for-men",
    "accessories",
    "first-aid",
  ],
};

export function iconThemeSrc(theme: IconTheme, key: string | undefined): string | null {
  if (!key || theme === "line") return null;
  if (!RENDERED_KEYS[theme].includes(key)) return null;
  return `/category-icons/${theme}/${key}.png`;
}

export function isIconTheme(v: unknown): v is IconTheme {
  return typeof v === "string" && (ICON_THEMES as readonly string[]).includes(v);
}
