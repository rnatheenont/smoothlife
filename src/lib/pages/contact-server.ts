import { contactSchema, CONTACT_DEFAULT, CONTACT_SECTION, type ContactInfo } from "./contact";
import { publishedDoc } from "./store";

// Reading the contact details that are actually published.
//
// Apart from src/lib/pages/contact.ts so that file stays safe to import from
// a client component: this one reaches the database, and anything that
// imports it is server-only.

/**
 * The live contact details.
 *
 * Field by field over the default rather than all-or-nothing: a document that
 * fills in the phone number and leaves TikTok blank means "the number
 * changed", not "we have no TikTok". An empty string is treated as "not set"
 * for the same reason — it is what a cleared field looks like.
 */
export async function contactInfo(): Promise<ContactInfo> {
  const doc = await publishedDoc("global", "contact");
  const section = doc?.sections.find((s) => s.type === CONTACT_SECTION);
  if (!section) return CONTACT_DEFAULT;

  const parsed = contactSchema.safeParse(section.settings);
  if (!parsed.success) {
    console.error("[contact] the stored contact details do not fit — using the built-in ones");
    return CONTACT_DEFAULT;
  }

  const stored = parsed.data;
  const merged = { ...CONTACT_DEFAULT };
  for (const key of Object.keys(merged) as (keyof ContactInfo)[]) {
    if (stored[key]) merged[key] = stored[key];
  }
  return merged;
}
