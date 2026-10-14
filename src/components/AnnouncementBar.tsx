import Link from "next/link";
import type { Announcement } from "@/lib/pages/announcement";

// One sentence across the top of the page.
//
// A server component with no state: whether it shows was decided before it
// was handed here, because the decision depends on the clock and a component
// that checks the time while rendering disagrees with the server that sent
// it. See announcementVisible.

const TONE: Record<Announcement["tone"], string> = {
  brand: "bg-brand-800 text-white",
  dark: "bg-slate-900 text-white",
  // Amber on near-black rather than white on amber: this tone is for the
  // messages that are bad news, and bad news that is hard to read is worse.
  warning: "bg-amber-100 text-amber-900",
};

export default function AnnouncementBar({ bar }: { bar: Announcement }) {
  const body = (
    <>
      <span>{bar.text}</span>
      {bar.href && bar.linkLabel && <span className="font-bold underline underline-offset-2">{bar.linkLabel}</span>}
    </>
  );

  return (
    <div
      role="status"
      className={`${TONE[bar.tone]} flex items-center justify-center gap-2 px-4 py-2 text-center text-[13px] leading-snug`}
    >
      {bar.href ? (
        <Link href={bar.href} className="flex items-center gap-2">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}
