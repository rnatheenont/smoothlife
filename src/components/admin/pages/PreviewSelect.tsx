"use client";

import { useEffect } from "react";
import { anchorFor, PREVIEW_MESSAGE, type PreviewMessage } from "@/lib/pages/section-anchor";

// Inside the preview frame: clicking a section tells the editor to select it,
// and the editor tells this frame which one to outline.
//
// Clicks do not navigate here. A preview is a picture of the page, and a
// product card that took you to the product would leave the editor showing a
// page that is no longer in the frame beside it. Every link and button is
// therefore swallowed — which is also why this only ever runs in the preview
// and never on the live site.
//
// Both ends check the origin. They are the same origin — the editor and this
// frame are served by one app — so the test is an equality, not a pattern,
// and a message from anywhere else is dropped without being read.

export default function PreviewSelect() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;

      // Nothing in here navigates, whether or not it belongs to a section.
      // The header and footer are part of this frame too, and following a
      // link out of the preview leaves the editor describing a page that is
      // no longer in the window beside it. Found by clicking one: the frame
      // went to /collections/sale-up-to-50-off and stayed there.
      if (target?.closest("a, button, [role='button'], input, label, select")) {
        event.preventDefault();
        event.stopPropagation();
      }

      const anchor = anchorFor(target);
      const id = anchor?.dataset.sectionAnchor;
      if (!id) return;

      event.preventDefault();
      event.stopPropagation();

      const message: PreviewMessage = { source: PREVIEW_MESSAGE, type: "select", id };
      window.parent?.postMessage(message, window.location.origin);
      outline(id);
    }

    function outline(id: string | null) {
      for (const el of document.querySelectorAll<HTMLElement>("[data-preview-outline]")) {
        el.style.outline = "";
        el.style.outlineOffset = "";
        delete el.dataset.previewOutline;
      }
      if (!id) return;
      const anchor = document.querySelector<HTMLElement>(`[data-section-anchor="${CSS.escape(id)}"]`);
      const section = anchor?.nextElementSibling as HTMLElement | null;
      if (!section) return;
      section.dataset.previewOutline = "true";
      section.style.outline = "2px solid #00b39b";
      section.style.outlineOffset = "-2px";
      section.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PreviewMessage | undefined;
      if (data?.source !== PREVIEW_MESSAGE || data.type !== "highlight") return;
      outline(data.id);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
