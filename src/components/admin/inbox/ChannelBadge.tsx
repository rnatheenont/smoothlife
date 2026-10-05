import clsx from "clsx";
import { Globe, Facebook } from "lucide-react";

/**
 * LINE's own mark, served from public/brand (the file the shop supplied, from
 * vectorlogo.zone). lucide's generic speech bubble read as "a message" where
 * this row needs it to read as "LINE", and a hand-drawn balloon is not a brand
 * mark — this is the artwork itself, only its viewBox cropped to the icon so it
 * scales square.
 */
function LineGlyph({ size = 11 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/brand/line.svg"
      alt=""
      width={size}
      height={size}
      className="block"
    />
  );
}

// Declared here rather than inline in the map below, so each render reuses the
// same component instead of making a new one.
function GlobeGlyph({ size = 11 }: { size?: number }) {
  return <Globe size={size} aria-hidden="true" />;
}
function FacebookGlyph({ size = 11 }: { size?: number }) {
  return <Facebook size={size} aria-hidden="true" />;
}

const CHANNEL: Record<
  string,
  {
    label: string;
    icon: (p: { size?: number }) => React.ReactElement;
    className: string;
    /** Overrides the pill shape — see LINE below. */
    shape?: string;
    /** The mark is the badge: it is drawn edge to edge rather than as a
     *  glyph sitting on a coloured chip. */
    fills?: boolean;
  }
> = {
  web: {
    label: "เว็บไซต์",
    icon: GlobeGlyph,
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  line: {
    label: "LINE",
    icon: LineGlyph,
    className: "bg-white text-[#05913f] ring-white",
    // Their mark is a rounded square; a circle would clip its corners.
    shape: "rounded-[6px]",
    fills: true,
  },
  facebook: {
    label: "Facebook",
    icon: FacebookGlyph,
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
  const Icon = c?.icon ?? GlobeGlyph;
  const label = c?.label ?? channel;
  return (
    <span
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={clsx(
        "inline-flex items-center text-[10px] font-bold ring-1 ring-inset",
        compact
          ? `size-5 justify-center ${c?.shape ?? "rounded-full"}`
          : "gap-1 rounded-full px-2 py-0.5",
        c?.className ?? "bg-slate-100 text-slate-600 ring-slate-200",
        className,
      )}
    >
      <Icon size={compact && c?.fills ? 20 : 11} />
      {!compact && label}
    </span>
  );
}
