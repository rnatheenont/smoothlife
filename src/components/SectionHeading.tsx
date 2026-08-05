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
        <h2 className="text-xl md:text-2xl font-bold text-brand-ink">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
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
