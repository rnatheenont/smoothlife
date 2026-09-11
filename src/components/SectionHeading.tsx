import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * One line: the Thai heading on the left, "ดูทั้งหมด" on the right.
 *
 * It used to stack an English eyebrow — "SHOP BY CONCERN", tracked out in
 * capitals with a gradient rule — above every Thai heading. Thai has no
 * capitals, so the page shouted in one language and spoke in another, and the
 * eyebrow repeated the heading beneath it word for word. `subtitle` is still
 * accepted so existing call sites compile, and now renders as a quiet line of
 * supporting copy under the heading only when it says something the heading
 * does not.
 *
 * The link shows on every screen size: it was hidden below `sm`, which is
 * exactly where most of this shop's customers are.
 */
export default function SectionHeading({
  title,
  subtitle,
  href,
  hrefLabel = "ดูทั้งหมด",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
}) {
  // An English subtitle is always a translation of the Thai title above it on
  // this site; showing both says the same thing twice.
  const extra = subtitle && /[฀-๿]/.test(subtitle) ? subtitle : null;

  return (
    <div className="mb-5 flex items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        <h2 className="text-xl font-bold leading-tight text-brand-ink md:text-[1.75rem]">{title}</h2>
        {extra && <p className="mt-1 text-sm text-slate-500">{extra}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-0.5 rounded-full py-1 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          {hrefLabel}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
