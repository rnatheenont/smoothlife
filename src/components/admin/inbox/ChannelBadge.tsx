import clsx from "clsx";
import { Globe, MessageCircle, Facebook } from "lucide-react";

// Where the conversation came from, told in colour.
//
// It used to be the middle of three identical grey pills — origin, channel,
// status — so the one piece of information that changes how you answer (a LINE
// customer sees a push notification; a web customer is probably still on the
// page) read as furniture. Each channel now has its own colour and its own
// icon, so the list can be scanned for "the LINE ones" without reading a word.
//
// Brand colours, because that is what makes them recognisable at this size:
// LINE's green and Facebook's blue are the two most familiar colours in a Thai
// shopper's day, and matching them is faster to read than any label.

const CHANNEL: Record<
  string,
  { label: string; icon: typeof Globe; className: string }
> = {
  web: {
    label: "เว็บไซต์",
    icon: Globe,
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  line: {
    label: "LINE",
    icon: MessageCircle,
    className: "bg-[#eefaf0] text-[#05913f] ring-[#bfe7cb]",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
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
  const Icon = c?.icon ?? Globe;
  const label = c?.label ?? channel;
  return (
    <span
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={clsx(
        "inline-flex items-center rounded-full text-[10px] font-bold ring-1 ring-inset",
        compact ? "size-[18px] justify-center" : "gap-1 px-2 py-0.5",
        c?.className ?? "bg-slate-100 text-slate-600 ring-slate-200",
        className,
      )}
    >
      <Icon size={11} aria-hidden="true" />
      {!compact && label}
    </span>
  );
}
