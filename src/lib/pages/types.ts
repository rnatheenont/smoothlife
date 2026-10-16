import type { Locale } from "../i18n/localized.ts";
import type { ComponentType } from "react";
import type { z } from "zod";
import type { CampaignPhase, SectionCommon } from "./doc";
import type { CampaignTimes } from "./campaign";

// What a section is, from the system's point of view.
//
// A section definition is the single place that knows everything about one
// kind of block: its settings shape, what a new one starts as, which fields
// the admin form shows, which page kinds may use it, and what to render. The
// editor, the renderer and the validator all read the same object, so a
// section cannot be added to the library and then be missing from the form,
// or render settings it never declared.

export type PageKind = "home" | "page" | "campaign" | "brand" | "system" | "template" | "global";

/**
 * What a template page is currently drawing.
 *
 * One stored document serves every product, so the document cannot name the
 * product — the request does. A section in a template reads the entity to
 * find out which one it is on, the way a Shopify product.json does.
 *
 * `page`, `home`, `campaign` and `brand` never carry one: those pages are
 * about themselves.
 */
export type EntityType = "product" | "category" | "collection" | "concern" | "article" | "question";

/**
 * The item a template page is drawing.
 *
 * `name` is what the item is called on the screen — the collection's title,
 * the concern's Thai name. It is carried rather than looked up because the
 * route has already found the item to know it exists at all, and because the
 * breadcrumb needs it: a trail that stops at the hub puts the page in a
 * section without ever saying which page it is.
 */
type EntityBase = {
  name: string;
  /**
   * Steps between the hub and this item, when the item sits under something
   * the registry cannot know about.
   *
   * A product's trail is หน้าแรก > ช้อป > its category > the product, and
   * which category that is, is a fact about the product. The route has the
   * item in hand already — that is how it knew not to answer 404 — so it
   * says; nothing here guesses.
   */
  under?: { label: string; href: string }[];
};

export type EntityRef =
  | ({ type: "product"; slug: string } & EntityBase)
  | ({ type: "category"; slug: string } & EntityBase)
  | ({ type: "collection"; handle: string } & EntityBase)
  | ({ type: "concern"; slug: string } & EntityBase)
  | ({ type: "article"; handle: string } & EntityBase)
  | ({ type: "question"; slug: string } & EntityBase);

/** Context handed to every section at render time. */
export type RenderCtx = {
  kind: PageKind;
  /** The page's own slug — "home", "10-10", "smooth-e". */
  slug: string;
  /** Evaluated once per request so every section on the page agrees about
   *  what time it is, including across a midnight boundary. */
  now: Date;
  /**
   * Which language this render is for.
   *
   * Required rather than optional, and that is the point: every section that
   * prints a settings field has to read it through tx(), and a field that
   * quietly defaulted to Thai would hide the one case worth catching — a page
   * rendered in English by a section that forgot. The type makes every place
   * that builds a context say which language it meant.
   */
  locale: Locale;
  /** Campaign pages only. */
  phase?: CampaignPhase;
  /** Campaign pages only: the four dates that decided the phase.
   *
   *  Handed down rather than looked up per section, because a countdown has
   *  to agree with the phase it is counting towards. A section that read the
   *  dates itself could render a clock ticking down to a start that the page
   *  around it has already passed. */
  times?: CampaignTimes;
  /** Brand pages, admin preview only: draw the brand profile the team is
   *  editing rather than the one that is live. Never true on a page a
   *  customer can reach — the preview route is behind the admin cookie. */
  draftProfile?: boolean;
  /** True inside the admin preview: sections that fail show a visible box
   *  instead of disappearing, because a section that silently vanishes while
   *  someone is editing it is a bug report nobody can write. */
  isPreview: boolean;
  /**
   * The page's query string, for the sections that are built on it.
   *
   * Only /shop needs this today, and it needs all of it: the banner's title,
   * the ringed category circle, the filters, the sort, the page number and
   * the grid are all one reading of ?category=&brand=&sort=&page=. A section
   * cannot reach for it on its own — useSearchParams is a client hook and
   * this runs on the server — so the route hands it down, the same way the
   * campaign dates are handed down rather than looked up per section.
   */
  query?: Record<string, string | undefined>;
  /** Template pages only: the item this render is for. A section that needs
   *  one declares `requiresEntity`, so a template section can never end up on
   *  a page that has nothing to be about. */
  entity?: EntityRef;
};

/** One field in the admin form. Kept deliberately small for now — the editor
 *  arrives in Phase 2, and a field type nothing renders yet is a promise the
 *  form has to keep later. */
export type FieldDef =
  /** `localized` offers a second box for English. The field's value is then
   *  an LText and every read of it has to go through tx() — there is a test
   *  that checks exactly that (src/sections/localized-fields.test.ts). */
  | { key: string; type: "text"; label: string; placeholder?: string; help?: string; localized?: true }
  | { key: string; type: "textarea"; label: string; placeholder?: string; help?: string; localized?: true }
  | { key: string; type: "number"; label: string; min?: number; max?: number; help?: string }
  | { key: string; type: "toggle"; label: string; help?: string }
  | { key: string; type: "select"; label: string; options: [string, string][]; help?: string }
  | { key: string; type: "image"; label: string; help?: string }
  /** A single colour, as a hex string. A well and a text box rather than one
   *  or the other: the well is how you pick a colour, the text box is how you
   *  paste the one from the campaign's artwork. */
  | { key: string; type: "color"; label: string; help?: string }
  | { key: string; type: "datetime"; label: string; help?: string }
  | { key: string; type: "product_slugs"; label: string; max?: number; help?: string }
  /** A list of campaign banners: picture, phone picture, link, description.
   *  Four fields that only mean anything together — a link belongs to the
   *  picture above it — so they are edited as rows rather than as four
   *  parallel lists that can fall out of step with each other. */
  | {
      key: string;
      type: "banners";
      label: string;
      max?: number;
      help?: string;
      /** Offers a button that fills the list from somewhere that already
       *  has banners — for hero_banners, whatever the shop is showing. The
       *  url answers { banners: [{image, mobileImage, href, title}] }, and
       *  `also` is applied to the section's other settings on success, so
       *  importing can turn off the automatic mode the imported banners
       *  came from in the same press. */
      importFrom?: { url: string; label: string; help?: string; also?: Record<string, unknown> };
    }
  | { key: string; type: "brand_slugs"; label: string; max?: number; help?: string }
  /**
   * A list of rows, each row a handful of small fields.
   *
   * The honest alternative to `json` for the shape that is actually common:
   * four branches, five tabs, three cards. An admin should not have to know
   * where the commas go to add a shop, and a JSON box punishes a missing
   * brace by dropping the whole section.
   *
   * `columns` declares what one row holds; the form draws a labelled input
   * per column and the reordering, adding and deleting for free. Keep it to
   * rows of short values — anything with its own layout earns a field type
   * of its own, the way `banners` did.
   */
  | {
      key: string;
      type: "list";
      label: string;
      help?: string;
      max?: number;
      /** What one row is called, for the row heading and the add button. */
      item: string;
      columns: {
        key: string;
        label: string;
        type?: "text" | "textarea" | "image" | "select";
        /** Same as the top-level flag: a second box for English, and the
         *  cell's value becomes an LText. */
        localized?: true;
        options?: [string, string][];
        placeholder?: string;
        /** Narrow columns sit two to a line on a wide enough form. */
        half?: boolean;
      }[];
    }
  /** Structured settings — a list of rows, a nested object — edited as JSON
   *  until the section earns a purpose-built form. It is here because the
   *  alternative was offering a plain text box for a list of objects, which
   *  does not survive a round trip: the value comes back a string, the
   *  section stops matching its schema, and it quietly vanishes from the
   *  page. A control that destroys what it edits is worse than an honest
   *  one that looks unfinished. */
  | { key: string; type: "json"; label: string; help?: string };

/** What a pre-publish check found. An error blocks publishing; a warning asks
 *  for a confirmation. */
export type CheckIssue = { level: "error" | "warning"; message: string };

export type SectionDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  /** Stored in every document that uses it — renaming one orphans those
   *  documents, so a rename is a migration, not an edit. */
  type: string;
  /** Bumped when `schema` changes shape. `migrate` reads the old number. */
  version: number;
  label: string;
  description: string;
  category: "hero" | "product" | "promo" | "content" | "brand" | "layout";
  schema: S;
  /** A brand-new section of this type. Must satisfy `schema` — there is a
   *  test that checks every definition against its own defaults, because a
   *  default that fails validation is a section the editor cannot add. */
  defaults: z.input<S>;
  fields: FieldDef[];
  enabledOn: PageKind[];
  /** How many of these one page may hold. Absent means no limit. */
  maxPerPage?: number;
  /** A section that wraps a piece of the shop rather than a piece of copy:
   *  the filters and grid on /shop, the buy box on a product page.
   *
   *  It cannot be deleted, hidden or duplicated — the page stops working
   *  without it — but it can be moved, because where the system sits on the
   *  page is a layout decision and a safe one. Its settings are the words
   *  around the machinery (a heading, an empty-results message), never the
   *  machinery itself.
   *
   *  Enforced in three places on purpose: `edit.ts` so the editor cannot
   *  produce such a document, the save route so a hand-written one is
   *  refused, and `validateForPublish` so a page missing one cannot go live.
   *  The first is not a gate — it is there so the right thing is the easy
   *  thing; the other two are. */
  locked?: boolean;
  /** Keeps the section at the head or the foot of the page. Breadcrumbs
   *  belong above everything; a page is not free to put them in the middle. */
  pinned?: "top" | "bottom";
  /** Entity types this section can draw. A section with this set is only
   *  offered on templates for those types. */
  requiresEntity?: EntityType[];
  /** True for the kind of section that would hold a page's largest image, so
   *  the renderer can give the first one priority and lazy-load the rest. */
  isLcpCandidate?: boolean;
  /** Settings written for an older `version`, brought up to date. Pure. */
  migrate?: (settings: unknown, fromVersion: number) => unknown;
  /** Fetches whatever this section needs before it can draw: a Shopify
   *  feed, a blog list, a widget's config.
   *
   *  It is separate from the component because this is the half that can be
   *  wrapped in a try/catch and actually mean it. Returning JSX from a
   *  try/catch catches nothing — React runs the component afterwards, long
   *  outside the block — so a server section that fetches inside itself can
   *  still take the whole route down. Fetch here; draw in Component. */
  load?: (settings: z.output<S>, ctx: RenderCtx) => Promise<unknown>;
  /** Asked before publishing — "does this discount code still exist". */
  check?: (settings: z.output<S>, ctx: RenderCtx) => Promise<CheckIssue[]>;
  Component: ComponentType<SectionProps<z.output<S>>>;
};

export type SectionProps<T, D = unknown> = {
  settings: T;
  /** Whatever `load` returned, or undefined when the section has no loader
   *  or its loader failed — a section that can be given data should also be
   *  able to draw without it. */
  data?: D;
  common?: SectionCommon;
  /** Position on the page, from 0. The first section gets image priority. */
  index: number;
  ctx: RenderCtx;
};

/** Any definition, for the registry — the generic parameter differs per
 *  section and nothing outside the definition itself needs to know it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySectionDefinition = SectionDefinition<any>;
