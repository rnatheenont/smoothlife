import { supabaseRestCached } from "@/lib/supabase-server";
import { isMascotThemeSetting, type MascotThemeSetting } from "@/components/mascot/mascot-theme";

// The outfit setting, read for the root layout. Cached under one tag that the
// admin route clears on save, so a change shows on the next page load rather
// than at the next revalidate.

export const MASCOT_THEME_TAG = "mascot-theme";

export async function mascotThemeSetting(): Promise<MascotThemeSetting> {
  try {
    const rows = await supabaseRestCached<{ theme: string }[]>("mascot_settings?select=theme&id=eq.true", {
      revalidate: 300,
      tags: [MASCOT_THEME_TAG],
    });
    const theme = rows[0]?.theme;
    return isMascotThemeSetting(theme) ? theme : "auto";
  } catch {
    // No database (local without keys) or a bad answer: the calendar decides.
    return "auto";
  }
}
