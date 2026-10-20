import { ChevronDown } from "lucide-react";

/**
 * The help centre's accordion.
 *
 * Every answer is in the HTML, collapsed. It used to keep one answer in
 * React state and render only that one, which meant the page's FAQPage
 * markup listed a dozen questions and answers that were not on the page —
 * exactly the mismatch that markup is checked for, and the kind of thing
 * that gets a site's rich results turned off rather than one page's.
 *
 * <details> is the same accordion with no JavaScript at all: `name` gives
 * one-open-at-a-time natively, `open` on the first keeps the page looking
 * as it did, and the contents of a closed <details> are still in the
 * document. The identical pattern is in src/sections/faq/definition.tsx.
 */
export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <details
          key={i}
          name="help-faq"
          open={i === 0}
          className="group overflow-hidden rounded-xl border border-slate-100"
        >
          <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 p-4 text-left">
            <span className="text-sm font-semibold text-brand-ink">{item.q}</span>
            <ChevronDown
              size={16}
              className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-4 pb-4 text-sm text-slate-600">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
