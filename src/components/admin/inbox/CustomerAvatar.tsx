"use client";

import clsx from "clsx";
import { useState } from "react";

// The customer's face in the conversation list.
//
// Three of the five people in the inbox today have one — two from LINE, one
// stored as a data URI — and a row of faces reads as people waiting, which is
// what the list is. The other two get their initial on a tinted disc rather
// than a grey silhouette: a placeholder that still says which person it is.
//
// A plain <img> rather than next/image, matching the product thumbnails in
// this screen. These are 28px, already sized by their source, and routing them
// through the optimiser would mean adding LINE's CDN to next.config for no
// gain. The site's CSP already allows profile.line-scdn.net and data: URIs.

/** Deterministic, so the same person keeps the same colour across reloads and
 *  the list stays recognisable between visits. */
const TINTS = [
  "bg-brand-100 text-brand-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
];

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** The first real character of their name — a Thai name, a Latin name and an
 *  emoji nickname all have one, which is more than "first letter" would get. */
function initialOf(name: string) {
  const trimmed = name.trim();
  return trimmed ? [...trimmed][0].toUpperCase() : "?";
}

export default function CustomerAvatar({
  name,
  src,
  seed,
  size = 28,
  className,
}: {
  name: string | null;
  src?: string | null;
  /** Falls back to the name; a conversation's channel id keeps unnamed people
   *  from all sharing one colour. */
  seed?: string;
  size?: number;
  className?: string;
}) {
  // A LINE avatar whose URL has expired would otherwise leave a broken-image
  // glyph in the middle of the list.
  const [failed, setFailed] = useState(false);
  const label = name?.trim() || "";

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={clsx(
          "shrink-0 rounded-full bg-surface-soft object-cover",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        tintFor(seed || label || "?"),
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initialOf(label)}
    </span>
  );
}
