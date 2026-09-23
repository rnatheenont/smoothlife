import { ImageResponse } from "next/og";
import { RICH_MENU_BUTTONS } from "./line-rich-menu";

// The menu artwork, drawn from the same button list the menu itself is built
// from. Before this, installing a rich menu meant someone had to open a design
// tool and hand-cut a 2500×1686 image whose invisible grid lines matched the
// tap areas exactly — and when a button's label changed in code, the picture
// silently went out of step with what tapping it actually did.
//
// Rendering it here keeps the two in lockstep: same array, same order, same
// six cells. A designed image can still be uploaded instead; this is the
// floor, not the ceiling.

// LINE's full-size rich menu. The tap areas in line-rich-menu.ts cut the same
// 3 × 2 grid out of these exact pixels, so the numbers must stay in step.
const W = 2500;
const H = 1686;
const GAP = 8;

// Brand palette (CI): the teal→blue sweep, mist for the cell face, ink for text.
const INK = "#0F172A";
const BRAND = "#00A87B";
const MIST = "#F4FAF8";
const LINE_ = "#E3EBE9";

// Lucide (MIT) path data, inlined: satori draws SVG children, but importing the
// React components would pull the whole icon set into an edge bundle.
const ICONS: Record<string, string[]> = {
  "/shop": ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
  "/account": ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"],
  "/subscription": ["m17 2 4 4-4 4", "M3 11v-1a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v1a4 4 0 0 1-4 4H3"],
  "/ai-assistant": ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  "/account/orders": [
    "M10 17h4V5H2v12h3",
    "M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1",
    "M14 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z",
    "M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z",
  ],
  "/help/contact": [
    "M3 11h3v7H4a1 1 0 0 1-1-1Z",
    "M18 11h3v6a1 1 0 0 1-1 1h-2Z",
    "M3 11a9 9 0 0 1 18 0",
    "M18 18a4 4 0 0 1-4 4h-2",
  ],
};

function Cell({ label, path }: { label: string; path: string }) {
  const paths = ICONS[path] ?? [];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
        width: (W - GAP * 2) / 3,
        height: (H - GAP) / 2,
        background: MIST,
        border: `${GAP / 2}px solid ${LINE_}`,
      }}
    >
      <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.6">
        {paths.map((d) => (
          <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div style={{ display: "flex", fontSize: 86, color: INK, textAlign: "center", padding: "0 40px" }}>{label}</div>
    </div>
  );
}

/** PNG of the menu, 2500 × 1686, ready to hand to LINE. */
export async function richMenuImage() {
  const font = await fetch(new URL("./IBMPlexSansThai-SemiBold.ttf", import.meta.url)).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: W,
          height: H,
          background: "#ffffff",
          gap: GAP,
          fontFamily: "IBM Plex Sans Thai",
        }}
      >
        {RICH_MENU_BUTTONS.map((b) => (
          <Cell key={b.path} label={b.label} path={b.path} />
        ))}
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [{ name: "IBM Plex Sans Thai", data: font, weight: 600, style: "normal" }],
    }
  );
}
