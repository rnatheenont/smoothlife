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

export type PageKind = "home" | "page" | "campaign" | "brand";

/** Context handed to every section at render time. */
export type RenderCtx = {
  kind: PageKind;
  /** The page's own slug — "home", "10-10", "smooth-e". */
  slug: string;
  /** Evaluated once per request so every section on the page agrees about
   *  what time it is, including across a midnight boundary. */
  now: Date;
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
};

/** One field in the admin form. Kept deliberately small for now — the editor
 *  arrives in Phase 2, and a field type nothing renders yet is a promise the
 *  form has to keep later. */
export type FieldDef =
  | { key: string; type: "text"; label: string; placeholder?: string; help?: string }
  | { key: string; type: "textarea"; label: string; placeholder?: string; help?: string }
  | { key: string; type: "number"; label: string; min?: number; max?: number; help?: string }
  | { key: string; type: "toggle"; label: string; help?: string }
  | { key: string; type: "select"; label: string; options: [string, string][]; help?: string }
  | { key: string; type: "image"; label: string; help?: string }
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
