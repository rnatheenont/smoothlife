import { Petit_Formal_Script } from "next/font/google";

/**
 * The script face the Janeke landing page is set in.
 *
 * Loaded here rather than in the root layout on purpose: it is used by this
 * one page, and a font in the layout is downloaded by every visitor to every
 * other page whether or not a glyph of it is ever drawn.
 *
 * Latin only — the script has no Thai glyphs, so the Thai copy on this page
 * stays in the site's own font-sans and only the English display lines use
 * this one.
 */
export const script = Petit_Formal_Script({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
