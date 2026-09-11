"use client";

import { useState, type ReactNode } from "react";

type AvatarProps = {
  src?: string | null;
  /** Used for the alt text and for the initial we fall back to. */
  name: string;
  /** Size classes for the image, e.g. "h-12 w-12". */
  className?: string;
  /** Shown instead of the initial — an icon, say. */
  fallback?: ReactNode;
};

/**
 * A member's photo, falling back to the first letter of their name.
 *
 * The onError is the whole point. LINE and Google hand out profile-image URLs
 * that rotate — change your picture and the old URL 404s forever — so a saved
 * one can go dead at any time. Without this, the browser renders the alt text
 * inside the circle, which looks like a broken card rather than a missing
 * photo: that is exactly how "T.O.P" ended up printed over the membership card.
 *
 * Renders bare so each call site keeps its own circle wrapper and sizing.
 */
export default function Avatar({ src, name, className = "h-9 w-9", fallback }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback ?? name.charAt(0).toUpperCase()}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      // Intrinsic size so the browser reserves a square before the photo
      // loads; the className still sets the size it's drawn at.
      width={96}
      height={96}
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover`}
    />
  );
}
