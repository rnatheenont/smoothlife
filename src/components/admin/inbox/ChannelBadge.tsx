import clsx from "clsx";
import { Globe, Facebook } from "lucide-react";

/**
 * LINE's balloon, drawn here rather than taken from lucide's generic speech
 * bubble: at this size the shape is the whole signal, and a plain chat bubble
 * said "a message" where the row needs it to say "LINE".
 *
 * The balloon only, with no lettering — at 12px the wordmark inside LINE's own
 * mark is smaller than a pixel is wide, and drawing it anyway would be noise.
 * Green fill plus this silhouette is what makes it read as LINE.
 *
 * An approximation, not LINE's own artwork: swap in their official SVG if the
 * brand assets are ever added to the project.
 */
function LineGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.6c-5.1 0-9.2 3.3-9.2 7.3 0 3.6 3.2 6.6 7.6 7.2.3.04.7.13.8.3.1.16.07.4.03.56 0 0-.1.63-.13.77-.04.22-.18.88.77.48s5.1-3 6.96-5.14h-.01c1.28-1.4 1.9-2.83 1.9-4.42 0-4.03-4.1-7.3-9.2-7.3Z" />
    </svg>
  );
}

const CHANNEL: Record<
  string,
  { label: string; icon: (p: { size?: number }) => React.ReactElement; className: string }
> = {
  web: {
    label: "เว็บไซต์",
    icon: ({ size = 11 }) => <Globe size={size} aria-hidden="true" />,
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  line: {
    label: "LINE",
    icon: LineGlyph,
    // The balloon reads as LINE only in LINE's green, so the compact badge
    // fills with it and draws the mark in white.
    className: "bg-[#06C755] text-white ring-[#06C755]",
  },
  facebook: {
    label: "Facebook",
    icon: ({ size = 11 }) => <Facebook size={size} aria-hidden="true" />,
    className: "bg-[#eef3ff] text-[#1b4fc4] ring-[#c6d6fb]",
  },
};

export default function ChannelBadge({
  channel,
  className,
  compact = false,
}: {
  channel: string;
  className?: string;
  /** Icon only. For the conversation list, where the colour is the part that
   *  gets scanned and the word costs a line of its own. */
  compact?: boolean;
}) {
  // An unknown channel still says which one it is rather than disappearing:
  // a fourth adapter landing before this file knows about it should look
  // unstyled, not invisible.
  const c = CHANNEL[channel];
  const Icon = c?.icon ?? (({ size = 11 }: { size?: number }) => <Globe size={size} aria-hidden="true" />);
  const label = c?.label ?? channel;
  return (
    <span
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={clsx(
        "inline-flex items-center rounded-full text-[10px] font-bold ring-1 ring-inset",
        compact ? "size-5 justify-center" : "gap-1 px-2 py-0.5",
        c?.className ?? "bg-slate-100 text-slate-600 ring-slate-200",
        className,
      )}
    >
      <Icon size={compact ? 12 : 11} />
      {!compact && label}
    </span>
  );
}
