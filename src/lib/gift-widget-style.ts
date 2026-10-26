// How the gift widget looks, as settings rather than as code.
//
// The app on Shopify has a widget editor with Style / Color / Content tabs
// and a live preview, and what it is really offering is this: the shop can
// restyle the thing without a deploy. That is the part worth copying. Its
// sliders are copied only where they drive something we actually draw — a
// "progress bar thickness" control over a widget with no progress bar is a
// setting that lies to whoever moves it.
//
// Everything here has a default, and the default is what the storefront drew
// before this file existed. A widget row with an empty config renders exactly
// as it always has.

export type GiftWidgetLayout = "cards" | "bar";

export type GiftWidgetStyle = {
  /** "cards" is a row of reward tiles. "bar" is the milestone ladder with a
   *  progress line, which is what the app draws. */
  layout: GiftWidgetLayout;
  iconSize: number;
  radius: number;
  gap: number;
  barThickness: number;
  barRadius: number;
  messageSize: number;
  tierSize: number;
  accentFrom: string;
  accentTo: string;
  surface: string;
  text: string;
  /** Content, with the app's own variables: {{amount_left}} and
   *  {{nearest_reward}}. */
  titleTh: string;
  beforeTh: string;
  afterTh: string;
};

export const GIFT_WIDGET_DEFAULTS: GiftWidgetStyle = {
  layout: "cards",
  iconSize: 44,
  radius: 16,
  gap: 8,
  barThickness: 6,
  barRadius: 16,
  messageSize: 13,
  tierSize: 11,
  accentFrom: "#00a87b",
  accentTo: "#00aeef",
  surface: "#f4faf8",
  text: "#0f172a",
  titleTh: "ของแถมฟรี",
  beforeTh: "อีก {{amount_left}} รับ {{nearest_reward}}",
  afterTh: "คุณได้รับ {{nearest_reward}} แล้ว",
};

/** The editable fields, in the order and the grouping the app puts them in —
 *  so an operator moving between the two consoles finds the same controls in
 *  the same places. */
export const GIFT_WIDGET_TABS: {
  key: "style" | "color" | "content";
  label: string;
  fields: {
    key: keyof GiftWidgetStyle;
    label: string;
    kind: "number" | "color" | "text" | "layout";
    min?: number;
    max?: number;
    unit?: string;
  }[];
}[] = [
  {
    key: "style",
    label: "สไตล์",
    fields: [
      { key: "layout", label: "รูปแบบ", kind: "layout" },
      { key: "iconSize", label: "ขนาดรูปของแถม", kind: "number", min: 24, max: 96, unit: "px" },
      { key: "radius", label: "ความมนของกล่อง", kind: "number", min: 0, max: 32, unit: "px" },
      { key: "gap", label: "ระยะห่างระหว่างช่อง", kind: "number", min: 0, max: 24, unit: "px" },
      { key: "barThickness", label: "ความหนาแถบความคืบหน้า", kind: "number", min: 2, max: 16, unit: "px" },
      { key: "barRadius", label: "ความมนของแถบ", kind: "number", min: 0, max: 16, unit: "px" },
      { key: "messageSize", label: "ขนาดตัวอักษรข้อความ", kind: "number", min: 10, max: 20, unit: "px" },
      { key: "tierSize", label: "ขนาดตัวอักษรระดับ", kind: "number", min: 9, max: 16, unit: "px" },
    ],
  },
  {
    key: "color",
    label: "สี",
    fields: [
      { key: "accentFrom", label: "สีหลัก (ซ้าย)", kind: "color" },
      { key: "accentTo", label: "สีหลัก (ขวา)", kind: "color" },
      { key: "surface", label: "สีพื้นกล่อง", kind: "color" },
      { key: "text", label: "สีตัวอักษร", kind: "color" },
    ],
  },
  {
    key: "content",
    label: "ข้อความ",
    fields: [
      { key: "titleTh", label: "หัวข้อ", kind: "text" },
      { key: "beforeTh", label: "ข้อความก่อนถึงเป้า", kind: "text" },
      { key: "afterTh", label: "ข้อความเมื่อถึงแล้ว", kind: "text" },
    ],
  },
];

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const hex = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback;

const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v : fallback);

/** A stored config, read back as a complete style. Anything missing or
 *  nonsense falls back to the default rather than reaching the browser as
 *  `NaN px`. */
export function giftWidgetStyle(config: Record<string, unknown> | undefined): GiftWidgetStyle {
  const c = config ?? {};
  const d = GIFT_WIDGET_DEFAULTS;
  return {
    layout: c.layout === "bar" ? "bar" : "cards",
    iconSize: num(c.iconSize, d.iconSize),
    radius: num(c.radius, d.radius),
    gap: num(c.gap, d.gap),
    barThickness: num(c.barThickness, d.barThickness),
    barRadius: num(c.barRadius, d.barRadius),
    messageSize: num(c.messageSize, d.messageSize),
    tierSize: num(c.tierSize, d.tierSize),
    accentFrom: hex(c.accentFrom, d.accentFrom),
    accentTo: hex(c.accentTo, d.accentTo),
    surface: hex(c.surface, d.surface),
    text: hex(c.text, d.text),
    titleTh: str(c.titleTh, d.titleTh),
    beforeTh: str(c.beforeTh, d.beforeTh),
    afterTh: str(c.afterTh, d.afterTh),
  };
}

/** The style as custom properties, so the widget reads one object instead of
 *  threading fifteen props through itself. */
export function giftWidgetVars(s: GiftWidgetStyle): React.CSSProperties {
  return {
    "--gw-icon": `${s.iconSize}px`,
    "--gw-radius": `${s.radius}px`,
    "--gw-gap": `${s.gap}px`,
    "--gw-bar": `${s.barThickness}px`,
    "--gw-bar-radius": `${s.barRadius}px`,
    "--gw-message": `${s.messageSize}px`,
    "--gw-tier": `${s.tierSize}px`,
    "--gw-accent": `linear-gradient(90deg, ${s.accentFrom}, ${s.accentTo})`,
    "--gw-accent-from": s.accentFrom,
    "--gw-surface": s.surface,
    "--gw-text": s.text,
  } as React.CSSProperties;
}

/**
 * The app's message variables, filled in.
 *
 * Unknown variables are left alone rather than blanked: a template reading
 * "{{amout_left}}" is a typo somebody can see and fix, where an empty gap is
 * a mystery.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) =>
    name in values ? values[name] : whole,
  );
}
