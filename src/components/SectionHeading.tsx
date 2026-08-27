import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
  return (
    <div className="flex items-end justify-between mb-7 md:mb-9">
      <div>
        {subtitle && (
          <div className="flex items-center gap-2 mb-2.5">
            <span className="h-px w-6 bg-brand-gradient" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-emerald">{subtitle}</p>
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-brand-ink">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="hidden sm:flex items-center gap-1 text-sm font-medium text-brand-emerald hover:text-brand-sky transition-colors shrink-0"
        >
          {hrefLabel} <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
