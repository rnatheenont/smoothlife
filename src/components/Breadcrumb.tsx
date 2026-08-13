import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = { label: string; href?: string };

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 overflow-x-auto scrollbar-none">
      <ol className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-brand-emerald transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-brand-ink font-medium" : ""}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
