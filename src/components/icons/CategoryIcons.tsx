import type { ReactNode, SVGProps } from "react";

// The nine marks in the category row under the hero.
//
// Drawn here rather than shipped as files because they are two-tone: a dark
// outline that takes the text colour and a mint blob behind it that takes the
// accent colour, so a row on a tinted background and a row on white can use
// the same nine components. lucide has no tooth, no hair strand and no
// monitor-with-a-plus, and a set half-lucide half-not reads as two sets.
//
// Common shape: 48x48, 2px stroke, round caps and joins, blob first so the
// outline always sits on top of it.

type IconProps = SVGProps<SVGSVGElement> & { blobClassName?: string };

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** The soft mint disc every mark sits on, offset low and right of the glyph. */
function Blob({ cx, cy, r, className }: { cx: number; cy: number; r: number; className?: string }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" className={className} />;
}

export function SkincareIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={30} cy={30} r={8} className={blobClassName} />
      {/* pump bottle */}
      <path d="M17 17h11a2 2 0 0 1 2 2v18a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3V19a2 2 0 0 1 2-2Z" />
      <path d="M21 17v-3h4v3" />
      <path d="M25 11h4a2 2 0 0 1 2 2v1" />
      {/* leaf */}
      <path d="M26 24c0 3.3-2.7 6-6 6 0-3.3 2.7-6 6-6Z" />
      {/* jar */}
      <path d="M31 31h7a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2h-5" />
      <path d="M31 35h8" />
    </Icon>
  );
}

export function OralCareIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={29} cy={30} r={7.5} className={blobClassName} />
      <path d="M24 13c-2.4 0-3.7-1.8-6.6-1.8-3.8 0-6.6 2.9-6.6 7.5 0 3.5 1.1 5.7 1.9 8.7.8 2.9.9 7.1 1.4 9.7.4 2.3 1.1 3.5 2.4 3.5 1.4 0 2-1.4 2.4-3.9.4-2.5.6-5.8 2-5.8s1.6 3.3 2 5.8c.4 2.5 1 3.9 2.4 3.9 1.3 0 2-1.2 2.4-3.5.5-2.6.6-6.8 1.4-9.7.8-3 1.9-5.2 1.9-8.7 0-4.6-2.8-7.5-6.6-7.5-2.9 0-4.2 1.8-6.6 1.8Z" />
      {/* sparkles */}
      <path d="M37 12.5c0 2-.8 2.8-2.8 2.8 2 0 2.8.8 2.8 2.8 0-2 .8-2.8 2.8-2.8-2 0-2.8-.8-2.8-2.8Z" />
      <path d="M41.5 20.5c0 1.2-.5 1.7-1.7 1.7 1.2 0 1.7.5 1.7 1.7 0-1.2.5-1.7 1.7-1.7-1.2 0-1.7-.5-1.7-1.7Z" />
    </Icon>
  );
}

export function WellnessIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={29} cy={31} r={7.5} className={blobClassName} />
      {/* capsule, on the diagonal */}
      <path d="M26.8 9.2a6.1 6.1 0 0 1 0 8.6l-9 9a6.1 6.1 0 0 1-8.6-8.6l9-9a6.1 6.1 0 0 1 8.6 0Z" />
      <path d="m13.5 13.5 8.6 8.6" />
      {/* tablet */}
      <circle cx={31} cy={31} r={8} />
      <path d="M25.3 25.3 36.7 36.7" />
    </Icon>
  );
}

export function HairCareIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={30} cy={31} r={7} className={blobClassName} />
      {/* squeeze bottle */}
      <path d="M14 20h10a2 2 0 0 1 2 2v15a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V22a2 2 0 0 1 2-2Z" />
      <path d="M17 20v-4h4v4" />
      <path d="M17.5 12h3" />
      {/* a lock of hair ending in a drop of treatment */}
      <path d="M34 21c0-3 2.5-4.2 2.5-7.2S34 10 34 10" />
      <path d="M34 20c0 5.2-5 6.7-5 11.3a5 5 0 0 0 10 0C39 26.7 34 25.2 34 20Z" />
      {/* sparkle */}
      <path d="M40 13c0 1.6-.6 2.2-2.2 2.2 1.6 0 2.2.6 2.2 2.2 0-1.6.6-2.2 2.2-2.2-1.6 0-2.2-.6-2.2-2.2Z" />
    </Icon>
  );
}

export function ForMenIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={31} cy={31} r={7} className={blobClassName} />
      {/* face */}
      <path d="M12 23v4a12 12 0 0 0 24 0v-4" />
      <path d="M36 23a12 12 0 0 0-24 0" />
      {/* quiff, filled so it reads as hair and not a second outline */}
      <path
        d="M12 23c0-6.6 5.4-12 12-12 5 0 9.3 3 11.1 7.4-2.4.5-4.6-.2-6.3-1.6-2.4 2.8-6.3 4.2-10.9 4.2-2.4 0-4.3-.3-5.9-.9V23Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M12 23c0-6.6 5.4-12 12-12 5 0 9.3 3 11.1 7.4-2.4.5-4.6-.2-6.3-1.6-2.4 2.8-6.3 4.2-10.9 4.2-2.4 0-4.3-.3-5.9-.9" />
      {/* eyes and mouth */}
      <path d="M19 27.5h.02M29 27.5h.02" strokeWidth={3} />
      <path d="M21 33c1.8 1.4 4.2 1.4 6 0" />
    </Icon>
  );
}

export function AccessoriesIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={30} cy={30} r={7} className={blobClassName} />
      {/* monitor */}
      <path d="M12 13h22a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3Z" />
      <path d="M13 23h4l2.5-6 3.5 12 3-6h7" />
      <path d="M13 37h5" strokeWidth={2.4} />
      {/* plus badge */}
      <circle cx={36} cy={34} r={6.5} />
      <path d="M36 31v6M33 34h6" />
    </Icon>
  );
}

export function FirstAidIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={30} cy={31} r={7} className={blobClassName} />
      {/* handle */}
      <path d="M19 15v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
      {/* case */}
      <path d="M12 15h24a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3Z" />
      {/* cross */}
      <path d="M21 20h6v4h4v6h-4v4h-6v-4h-4v-6h4v-4Z" />
    </Icon>
  );
}

export function TopBrandIcon({ blobClassName, ...props }: IconProps) {
  return (
    <Icon {...props}>
      <Blob cx={31} cy={32} r={6.5} className={blobClassName} />
      {/* seal */}
      <path d="M24 7.5 28 11l5.2-.6 1.3 5.1 4.5 2.7-2.3 4.7 2.3 4.7-4.5 2.7-1.3 5.1L28 34.8 24 38.3l-4-3.5-5.2.6-1.3-5.1L9 27.6l2.3-4.7L9 18.2l4.5-2.7 1.3-5.1 5.2.6L24 7.5Z" />
      <path d="m19.5 23 3.2 3.2 6-6.4" />
    </Icon>
  );
}
