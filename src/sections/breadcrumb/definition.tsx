import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { crumbsFor, type Crumb } from "./trail";
import { SITE_URL } from "@/lib/site-url";
import { jsonLdScript } from "@/lib/json-ld";

// Where this page sits, and how to go back up.
//
// The trail is worked out from the page itself rather than typed in, because
// a typed one is a copy of the site's structure that nobody updates: the day
// /help/delivery moves, the breadcrumb on it still says where it used to be.
// So the only setting is whether to show it at all.
//
// It also emits the BreadcrumbList that search engines read. That is the
// other half of why this is a section and not a line of markup in a layout —
// the structured data and the thing on the screen are built from one list, so
// they cannot drift apart.

const schema = z.object({
  /** Whether the first step says "หน้าแรก". Off for pages that are one step
   *  from home, where it would be the entire trail. */
  showHome: z.boolean().default(true),
});

function Component({ settings, ctx }: SectionProps<z.output<typeof schema>>) {
  const trail = crumbsFor(ctx);
  if (trail.length === 0) return null;

  const items: Crumb[] = settings.showHome ? [{ label: "หน้าแรก", href: "/" }, ...trail] : trail;
  // One step is not a trail — it is the name of the page you are looking at.
  if (items.length < 2) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="container-page pt-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <ol className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-slate-500 scrollbar-none">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-slate-300" />}
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="transition-colors hover:text-brand-800">
                {item.label}
              </Link>
            ) : (
              <span className={i === items.length - 1 ? "font-medium text-brand-ink" : ""}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const breadcrumb: SectionDefinition<typeof schema> = {
  type: "breadcrumb",
  version: 1,
  label: "เส้นทางหน้า (breadcrumb)",
  description: "แถวบอกตำแหน่งของหน้านี้ สร้างอัตโนมัติจากที่อยู่ — ตั้งได้แค่แสดงหรือซ่อน",
  category: "layout",
  schema,
  defaults: { showHome: true },
  fields: [{ key: "showHome", type: "toggle", label: 'เริ่มด้วย "หน้าแรก"' }],
  enabledOn: ["system", "template"],
  maxPerPage: 1,
  pinned: "top",
  Component,
};
