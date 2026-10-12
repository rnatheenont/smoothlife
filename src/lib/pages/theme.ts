// A campaign's colours, and whether text can be read on them.
//
// Scope first, because it is the whole reason this is a small file and not a
// theming system: a campaign theme applies inside the campaign page only, as
// CSS custom properties on that page's own wrapper. The lesson being heeded
// is the Fastwork one in the plan — recolouring an entire site from one
// accent makes every page worse, so this one does not get the chance.
//
// The contrast check is here rather than in the form because it is the kind
// of rule that has to hold at publish time whoever is publishing: an accent
// that cannot carry text is unreadable for everyone, and "it looked fine on
// my monitor" is not a measurement. WCAG 2.1 SC 1.4.3 asks for 4.5:1 for
// body text, so that is the number.
//
// Pure, imports nothing. See theme.test.ts.

export type CampaignTheme = {
  /** The one strong colour: buttons, countdown digits, price tags. */
  accent?: string;
  /** Behind the whole campaign page. */
  background?: string;
  /** Short word on the badge over product images — "10.10", "ลด 50%". */
  badgeText?: string;
};

/** What text on the accent will actually be set to. Near-black rather than
 *  pure black: it is the site's own ink colour, and pure black on a
 *  saturated accent reads as a hole. */
export const ON_ACCENT_LIGHT = "#FFFFFF";
export const ON_ACCENT_DARK = "#1A2B33";

/** The minimum WCAG 2.1 asks for body text (SC 1.4.3). */
export const MIN_CONTRAST = 4.5;

/** #abc, #aabbcc, with or without the hash. Null for anything else — a
 *  colour this cannot read is reported, not guessed at. */
export function parseHex(value: string | null | undefined): { r: number; g: number; b: number } | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG relative luminance. The 0.03928 branch and the 2.4 exponent are the
 *  specification's, not an approximation of it. */
export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** 1 to 21. Null when either colour could not be read. */
export function contrastRatio(a: string, b: string): number | null {
  const first = parseHex(a);
  const second = parseHex(b);
  if (!first || !second) return null;
  const l1 = relativeLuminance(first);
  const l2 = relativeLuminance(second);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Which of the two text colours to put on this accent.
 *
 * Chosen rather than asked for. Making the admin pick the text colour and
 * then refusing to publish their choice is two steps where one will do, and
 * the better of white and ink is a calculation, not a taste.
 */
export function onAccentFor(accent: string): { color: string; ratio: number } | null {
  const light = contrastRatio(accent, ON_ACCENT_LIGHT);
  const dark = contrastRatio(accent, ON_ACCENT_DARK);
  if (light === null || dark === null) return null;
  return light >= dark ? { color: ON_ACCENT_LIGHT, ratio: light } : { color: ON_ACCENT_DARK, ratio: dark };
}

/**
 * What is wrong with this theme, in Thai, for the publish checklist.
 *
 * An empty theme is fine — a campaign that sets no colours gets the site's
 * own, which is a reasonable campaign. Only a colour that was actually
 * chosen is held to the standard.
 */
export function checkTheme(theme: CampaignTheme | null | undefined): string[] {
  if (!theme) return [];
  const issues: string[] = [];

  if (theme.accent) {
    const best = onAccentFor(theme.accent);
    if (!best) {
      issues.push(`สีหลัก "${theme.accent}" ไม่ใช่รหัสสีที่อ่านได้ (ต้องเป็นแบบ #E0245E)`);
    } else if (best.ratio < MIN_CONTRAST) {
      // The number is in the message on purpose: "ไม่ผ่าน" alone gives the
      // person nothing to aim at, and 3.9 vs 2.1 is the difference between
      // darkening a shade and starting over.
      issues.push(
        `สีหลัก ${theme.accent}: ตัวอักษรบนสีนี้ได้ contrast แค่ ${best.ratio.toFixed(1)}:1 ` +
          `ต้องได้ ${MIN_CONTRAST}:1 — เลือกสีที่เข้มขึ้นหรืออ่อนลง`
      );
    }
  }

  if (theme.background && !parseHex(theme.background)) {
    issues.push(`สีพื้นหลัง "${theme.background}" ไม่ใช่รหัสสีที่อ่านได้`);
  }

  // Long enough to wrap is long enough to stop being a badge.
  if (theme.badgeText && theme.badgeText.trim().length > 12) {
    issues.push("ข้อความบนป้ายสินค้ายาวเกิน 12 ตัวอักษร — ป้ายจะล้นรูป");
  }

  return issues;
}

/**
 * The theme as inline custom properties for the campaign wrapper.
 *
 * Returns only the variables whose colours were readable, so a typo in one
 * field leaves the rest of the theme working and falls back to the site's
 * own values through the CSS default in var().
 */
export function themeVars(theme: CampaignTheme | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!theme) return vars;

  if (theme.accent && parseHex(theme.accent)) {
    vars["--cp-accent"] = theme.accent;
    const best = onAccentFor(theme.accent);
    if (best) vars["--cp-on-accent"] = best.color;
  }
  if (theme.background && parseHex(theme.background)) {
    vars["--cp-bg"] = theme.background;
  }
  return vars;
}
