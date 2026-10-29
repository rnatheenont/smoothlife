// The scan page's own icon set, drawn for it.
//
// Inlined rather than loaded from /public: each one is a single path, so
// eleven files would be eleven requests to deliver less markup than this
// file, and an <img> cannot take its colour from the text around it. They
// all paint with currentColor, which is how a tinted circle and the label
// under it stay in step when the tint changes.
//
// Source: the kit TOP supplied (web-assets/icons), transcribed as-is. The
// stroke weight and the round caps are the kit's, not lucide's — the two
// sets do not mix on one screen, and these are the ones the artwork used.

type IconProps = { size?: number; className?: string };

function Icon({ size = 24, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /></Icon>
);
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 13h4v8H3Z M10 8h4v13h-4Z M17 3h4v18h-4Z" /></Icon>
);
export const FaceIcon = (p: IconProps) => (
  <Icon {...p}><path d="M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0 M8 9h.01 M16 9h.01 M10 16h4 M12 11v2" /></Icon>
);
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><path d="M21 21l-5-5 M18 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0" /></Icon>
);
export const BulbIcon = (p: IconProps) => (
  <Icon {...p}><path d="M8 17c0-3-4-4-4-8a8 8 0 0 1 16 0c0 4-4 5-4 8Z M9 21h6 M10 24h4" /></Icon>
);
export const CameraIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 7h4l2-3h6l2 3h4v14H3Z M16 13a4 4 0 1 1-8 0a4 4 0 0 1 8 0" /></Icon>
);
export const ImageIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 3h18v18H3Z M3 17l6-6 4 4 3-3 5 5 M8 7h.01" /></Icon>
);
export const LockIcon = (p: IconProps) => (
  <Icon {...p}><path d="M5 10h14v12H5Z M8 10V6a4 4 0 0 1 8 0v4" /></Icon>
);
export const ScanIcon = (p: IconProps) => (
  <Icon {...p}><path d="M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 10h.01 M16 10h.01 M8 15q4 4 8 0" /></Icon>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}><path d="M9 5l7 7-7 7" /></Icon>
);
