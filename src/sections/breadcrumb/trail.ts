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
 * For a template the item's own name is not known here (that needs a lookup
 * per item, which arrives with the template pages themselves), so the trail
 * stops at the hub: a true trail that is short, rather than one with a blank
 * on the end.
 */
export function crumbsFor(ctx: Pick<RenderCtx, "kind" | "slug" | "entity">): Crumb[] {
  if (ctx.kind === "template" && ctx.entity) {
    const parent = SYSTEM_PAGES[PARENT_OF[ctx.entity.type]];
    return parent?.path ? [{ label: parent.title, href: parent.path }] : [];
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
    crumbs.push(walked === page.path ? { label: at.title } : { label: at.title, href: walked });
  }
  return crumbs;
}
