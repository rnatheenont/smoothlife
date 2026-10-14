import { SCHEMA_VERSION, type PageDoc } from "../doc.ts";
import { CONTACT_DEFAULT, CONTACT_SECTION } from "../contact.ts";
import { FOOTER_COLUMNS_DEFAULT, FOOTER_SECTION } from "../footer-links.ts";
import { ANNOUNCEMENT_DEFAULT, ANNOUNCEMENT_SECTION } from "../announcement.ts";
import { MOBILE_TABS_DEFAULT, MOBILE_TABS_SECTION } from "../mobile-tabs.ts";
import { HEADER_LINKS_DEFAULT, HEADER_SECTION } from "../header-links.ts";

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

/** The footer's columns, as they are in the code today. Publishing it
 *  unchanged changes nothing, which is what makes it safe to publish first
 *  and edit afterwards. */
const footer = (): PageDoc => ({
  schemaVersion: SCHEMA_VERSION,
  sections: [
    {
      id: `${FOOTER_SECTION}-1`,
      type: FOOTER_SECTION,
      v: 1,
      settings: { columns: structuredClone(FOOTER_COLUMNS_DEFAULT) },
    },
  ],
});

/** The announcement bar, switched off. Publishing it puts an empty, disabled
 *  bar in the database and nothing on the screen — which is what makes it
 *  safe to set up today and use in December. */
const announcement = (): PageDoc => ({
  schemaVersion: SCHEMA_VERSION,
  sections: [
    {
      id: `${ANNOUNCEMENT_SECTION}-1`,
      type: ANNOUNCEMENT_SECTION,
      v: 1,
      settings: { ...ANNOUNCEMENT_DEFAULT },
    },
  ],
});

/** The five tabs the phone bar has today. */
const mobileTabs = (): PageDoc => ({
  schemaVersion: SCHEMA_VERSION,
  sections: [
    {
      id: `${MOBILE_TABS_SECTION}-1`,
      type: MOBILE_TABS_SECTION,
      v: 1,
      settings: { tabs: structuredClone(MOBILE_TABS_DEFAULT) },
    },
  ],
});

/** The header's navigation as it is in the code today. */
const header = (): PageDoc => ({
  schemaVersion: SCHEMA_VERSION,
  sections: [
    {
      id: `${HEADER_SECTION}-1`,
      type: HEADER_SECTION,
      v: 1,
      settings: structuredClone(HEADER_LINKS_DEFAULT),
    },
  ],
});

export const GLOBAL_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  contact,
  header,
  footer,
  announcement,
  mobile_tabs: mobileTabs,
};
