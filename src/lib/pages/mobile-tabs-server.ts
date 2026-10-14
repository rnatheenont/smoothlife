import { mobileTabsSchema, MOBILE_TABS_DEFAULT, MOBILE_TABS_SECTION, usableTabs, type MobileTab } from "./mobile-tabs";
import { publishedDoc } from "./store";

// Reading the published tab bar. Server only — see mobile-tabs.ts.

export async function mobileTabs(): Promise<MobileTab[]> {
  const doc = await publishedDoc("global", "mobile_tabs");
  const section = doc?.sections.find((s) => s.type === MOBILE_TABS_SECTION);
  if (!section) return MOBILE_TABS_DEFAULT;

  const parsed = mobileTabsSchema.safeParse(section.settings);
  if (!parsed.success) {
    console.error("[mobile-tabs] the stored tabs do not fit — using the built-in ones");
    return MOBILE_TABS_DEFAULT;
  }
  return usableTabs(parsed.data.tabs);
}
