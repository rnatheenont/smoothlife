import { SCHEMA_VERSION, type PageDoc } from "../doc.ts";
import { CONTACT_DEFAULT, CONTACT_SECTION } from "../contact.ts";

// The documents behind the parts of the site that are on every page.
//
// A global is not a page and has no address; it is a record the pages read.
// Keeping it as a document anyway buys the whole editor for free — drafts,
// publishing, revision history, rollback — on a record that otherwise would
// have needed all four built again under another name.

/** The contact document: one section, which is the form. The values are the
 *  same ones the code falls back to, so publishing it unchanged changes
 *  nothing — which is what makes it safe to publish before anybody edits it. */
const contact = (): PageDoc => ({
  schemaVersion: SCHEMA_VERSION,
  sections: [{ id: `${CONTACT_SECTION}-1`, type: CONTACT_SECTION, v: 1, settings: { ...CONTACT_DEFAULT } }],
});

export const GLOBAL_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  contact,
};
