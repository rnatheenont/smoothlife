import { announcementSchema, ANNOUNCEMENT_DEFAULT, ANNOUNCEMENT_SECTION, type Announcement } from "./announcement";
import { publishedDoc } from "./store";

// Reading the published announcement. Server only — see announcement.ts.

export async function announcement(): Promise<Announcement> {
  const doc = await publishedDoc("global", "announcement");
  const section = doc?.sections.find((s) => s.type === ANNOUNCEMENT_SECTION);
  if (!section) return ANNOUNCEMENT_DEFAULT;

  const parsed = announcementSchema.safeParse(section.settings);
  if (!parsed.success) {
    // A malformed bar is a bar that does not appear. Nothing is lost: there
    // was nothing there yesterday either.
    console.error("[announcement] the stored bar does not fit — showing nothing");
    return ANNOUNCEMENT_DEFAULT;
  }
  return parsed.data;
}
