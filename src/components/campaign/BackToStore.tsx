"use client";

import { useEffect, useState } from "react";

// "กลับไปหน้าร้าน" — back to the page they actually came from.
//
// It always pointed at the shop's all-products listing, so a customer who
// arrived from a product page, a LINE post's landing page or a collection was
// sent somewhere they had not been and had to find their way back themselves.
//
// The referrer is only trusted when it names a host we are willing to send
// someone to. Anything else — a search engine, a social app, a link with no
// referrer at all — falls back to the shop, because "back" leading off to
// wherever a stranger linked from is a redirect with somebody else's hand on
// it.

const ALLOWED = ["www.smoothlife.com", "smoothlife.com"];

export default function BackToStore({ fallback }: { fallback: string }) {
  const [href, setHref] = useState(fallback);

  useEffect(() => {
    try {
      const from = document.referrer;
      if (!from) return;
      const url = new URL(from);
      // Not back to this same page — that is a button that does nothing.
      if (url.href === window.location.href) return;
      if (ALLOWED.includes(url.hostname)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- document.referrer is not available during render
        setHref(url.href);
      }
    } catch {
      /* a referrer we cannot parse is a referrer we do not use */
    }
  }, []);

  return (
    <a
      href={href}
      className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-[13px] font-semibold text-black hover:bg-black/5"
    >
      {href === fallback ? "กลับไปหน้าร้าน" : "ย้อนกลับ"}
    </a>
  );
}
