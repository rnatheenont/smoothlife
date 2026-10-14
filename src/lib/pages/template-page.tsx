import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { renderSections } from "./render";
import { publishedDoc } from "./store";
import { TEMPLATE_DEFAULT_DOCS } from "./default-docs/template";
import type { EntityRef } from "./types";

// Drawing a template page from its document.
//
// The same shape as SystemPageBody, with one difference that is the whole
// point of a template: the document is shared by every item it draws. One
// publish changes every concern page, every collection page, every product
// page. That is why the editor shows how many pages a publish affects, and
// why these documents are the ones to be most careful with.
//
// The item is handed in rather than looked up here. The route has already
// found it — that is how it knew not to answer 404 — and a second lookup
// would be a second chance to disagree with the first.

export async function TemplateBody({
  templateKey,
  entity,
  query,
  fallback,
}: {
  templateKey: string;
  entity: EntityRef;
  /** The route's own searchParams, for a template whose sections read them. */
  query?: Record<string, string | undefined>;
  fallback?: ReactNode;
}) {
  const stored = await publishedDoc("template", templateKey);
  const doc = stored ?? TEMPLATE_DEFAULT_DOCS[templateKey]?.();
  if (!doc) {
    if (fallback !== undefined) return <>{fallback}</>;
    notFound();
  }

  return (
    <>
      {await renderSections(doc, {
        kind: "template",
        slug: templateKey,
        now: new Date(),
        isPreview: false,
        entity,
        query,
      })}
    </>
  );
}
