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
    <div className="flex items-end justify-between mb-5 md:mb-6">
      <div>
        {subtitle && (
          <p className="text-xs font-bold uppercase tracking-wider text-brand-emerald mb-1.5">{subtitle}</p>
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
