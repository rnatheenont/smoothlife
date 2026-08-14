import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShopSearchParams } from "@/lib/filter-products";

function pageHref(current: ShopSearchParams, page: number) {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([k, v]) => {
    if (v && k !== "page") params.set(k, v);
  });
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/shop${qs ? `?${qs}` : ""}`;
}

// Keeps the page-number list short even with hundreds of pages: always show
// the first/last page, the current page and its neighbors, and collapse the
// rest into "…" instead of rendering every single page number.
function pageNumbers(current: number, total: number): (number | "...")[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("...");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({
  current,
  page,
  totalPages,
}: {
  current: ShopSearchParams;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="เปลี่ยนหน้า">
      <Link
        href={pageHref(current, page - 1)}
        aria-disabled={page <= 1}
        className={`grid h-9 w-9 place-items-center rounded-full border text-sm transition-colors ${
          page <= 1
            ? "border-slate-100 text-slate-300 pointer-events-none"
            : "border-slate-200 text-slate-600 hover:border-brand-teal"
        }`}
      >
        <ChevronLeft size={16} />
      </Link>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-1 text-sm text-slate-300">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={pageHref(current, p)}
            className={`grid h-9 w-9 place-items-center rounded-full text-sm font-medium transition-colors ${
              p === page ? "bg-brand-gradient text-white" : "text-slate-600 hover:bg-surface-soft"
            }`}
          >
            {p}
          </Link>
        )
      )}
      <Link
        href={pageHref(current, page + 1)}
        aria-disabled={page >= totalPages}
        className={`grid h-9 w-9 place-items-center rounded-full border text-sm transition-colors ${
          page >= totalPages
            ? "border-slate-100 text-slate-300 pointer-events-none"
            : "border-slate-200 text-slate-600 hover:border-brand-teal"
        }`}
      >
        <ChevronRight size={16} />
      </Link>
    </nav>
  );
}
