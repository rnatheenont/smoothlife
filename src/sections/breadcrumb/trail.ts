// Relative, not "@/": this module is covered by a unit test, and the test
// runner resolves neither the alias nor JSX, and in ESM a relative import
// needs its extension. Keeping the pure half reachable without a bundler is
// the whole reason it is a separate file; tsconfig already allows the
// extension (allowImportingTsExtensions).
import type { EntityRef, RenderCtx } from "../../lib/pages/types.ts";
import { SYSTEM_PAGE_LIST, SYSTEM_PAGES } from "../../lib/pages/system-pages.ts";

// Working out where a page sits from the page itself.
//
// Separate from the section that draws it so the rules can be tested without
// rendering anything: which steps appear, which one is not a link, and what
// happens at an address no page serves are all one assertion each, and all of
// them are invisible when you look at the markup.

export type Crumb = { label: string; href?: string };

/** Which hub a template's items belong under. A product's trail goes through
 *  the shop, an article's through the knowledge hub. */
export const PARENT_OF: Record<EntityRef["type"], string> = {
  product: "shop",
  category: "shop",
  collection: "collections",
  concern: "concern-hub",
  article: "knowledge",
  question: "questions",
};

const byPath = new Map(SYSTEM_PAGE_LIST.filter((p) => p.path).map((p) => [p.path as string, p]));

/**
 * The steps above this page, and this page.
 *
 * For a system page the trail is its own address: /help/delivery walks /help
 * first, and each step is named by whichever registry entry serves it. A
 * segment no page serves is skipped rather than guessed at — an unlabelled
 * step is worse than one fewer step.
 *
 * For a template it is the hub the item belongs under, then the item. Two
 * steps, not the item's whole address: /concern/acne sits under /concern and
 * there is nothing in between. An item with no name gives the hub alone,
 * because a trail ending in a blank is worse than one step shorter.
 */
export function crumbsFor(ctx: Pick<RenderCtx, "kind" | "slug" | "entity">): Crumb[] {
  if (ctx.kind === "template" && ctx.entity) {
    const parent = SYSTEM_PAGES[PARENT_OF[ctx.entity.type]];
    const hub: Crumb[] = parent?.path ? [{ label: parent.crumb ?? parent.title, href: parent.path }] : [];
    // The item itself, last and not a link — you are looking at it. Its name
    // rides in on the EntityRef rather than being looked up here, so this
    // stays a pure function of what it was handed.
    return ctx.entity.name ? [...hub, { label: ctx.entity.name }] : hub;
  }

  const page = ctx.kind === "system" ? SYSTEM_PAGES[ctx.slug] : undefined;
  if (!page?.path) return [];

  const segments = page.path.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let walked = "";
  for (const segment of segments) {
    walked += `/${segment}`;
    const at = byPath.get(walked);
    if (!at) continue;
    const label = at.crumb ?? at.title;
    crumbs.push(walked === page.path ? { label } : { label, href: walked });
  }
  return crumbs;
}
