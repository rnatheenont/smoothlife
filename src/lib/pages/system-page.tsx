import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { renderSections } from "./render";
import { publishedDoc } from "./store";
import { SYSTEM_DEFAULT_DOCS } from "./default-docs/system";

// Drawing a system page from its document.
//
// One helper rather than the same eight lines in sixteen routes. Each route
// keeps its own metadata, its own data fetching and its own hand-written
// markup for when the wave is off; what it hands over here is only the body.
//
// The order matters and is the point: the published document first, the
// code's default second. A page nobody has edited draws from the default and
// is therefore exactly the page it always was; the moment somebody publishes,
// theirs wins. There is no third case where the page is blank.

export async function SystemPageBody({ pageKey, fallback }: { pageKey: string; fallback?: ReactNode }) {
  const stored = await publishedDoc("system", pageKey);
  const doc = stored ?? SYSTEM_DEFAULT_DOCS[pageKey]?.();
  // A wave switched on for a page with no document would be a blank page
  // where a real one used to be. 404 is wrong and blank is worse, so this is
  // a mistake worth making loudly — it can only happen in a deploy where the
  // flag is on and the default has not been written.
  //
  // Except where a 404 would be absurd: the not-found page itself cannot
  // answer "not found", and the offline page has to draw with no network at
  // all. Those pass their own markup as `fallback`, which is also the only
  // honest answer when the database is the thing that is down.
  if (!doc) {
    if (fallback !== undefined) return <>{fallback}</>;
    notFound();
  }

  return <>{await renderSections(doc, { kind: "system", slug: pageKey, now: new Date(), isPreview: false })}</>;
}

/**
 * The same body, from the code's document only — no database.
 *
 * For the two pages that are rendered *inside* other routes: not-found is
 * what every statically generated route falls back to, and offline is served
 * from the install-time cache. Next counts a database read during their
 * render as the page turning dynamic, and a statically generated route whose
 * 404 boundary does that fails the whole route — which is how reading the
 * stored 404 took every product page down with it.
 *
 * So these two are editable in the code and nowhere else. That is the trade
 * the plan already called for ("404 must render even when the database is
 * down"); what it did not say, and what cost a production outage to learn,
 * is that reading it at all is the problem, not failing to read it.
 */
export async function SystemPageBodyFromCode({ pageKey, fallback }: { pageKey: string; fallback?: ReactNode }) {
  const doc = SYSTEM_DEFAULT_DOCS[pageKey]?.();
  if (!doc) {
    if (fallback !== undefined) return <>{fallback}</>;
    notFound();
  }
  return <>{await renderSections(doc, { kind: "system", slug: pageKey, now: new Date(), isPreview: false })}</>;
}
