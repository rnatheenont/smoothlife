// Finding which section a DOM node belongs to, on the client.
//
// Every section is preceded by a zero-height anchor carrying its id (see
// render.tsx), so the answer is "walk up until a node's previous sibling is
// one of those". Shared by the click counter on the live site and the
// click-to-select in the editor preview, because two copies of this walk
// would eventually disagree about what a section is.
//
// No imports on purpose: this runs inside an iframe on the storefront.

export function anchorFor(start: Element | null): HTMLElement | null {
  let el: Element | null = start;
  while (el && el !== document.body) {
    const prev = el.previousElementSibling as HTMLElement | null;
    if (prev?.dataset?.sectionAnchor) return prev;
    el = el.parentElement;
  }
  return null;
}

/** The message the preview and the editor pass between them. Same origin on
 *  both sides — both are served by this app — so the origin check is exact
 *  rather than a wildcard. */
export const PREVIEW_MESSAGE = "smoothlife:preview";

export type PreviewMessage =
  | { source: typeof PREVIEW_MESSAGE; type: "select"; id: string }
  | { source: typeof PREVIEW_MESSAGE; type: "highlight"; id: string | null };
