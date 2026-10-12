import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Sticky tabs that jump down the page.
//
// A campaign page is long — four or five product shelves, coupons, terms —
// and the thing a visitor wants is rarely at the top. These are anchors, not
// filters: each one scrolls to a section further down.
//
// It works because every section is wrapped in an element carrying its own
// id (SectionBoundary), so the target of a jump is the section itself and no
// extra markup has to be placed by hand. The admin types the section's id,
// which is shown in the editor's section list.
//
// scroll-margin-top is why this does not land under its own sticky bar: the
// page's header height lives in --app-header-h, and the offset is that plus
// this bar. Without it the first heading of every section you jump to is
// hidden behind the thing you used to get there.

const tab = z.object({ label: z.string().min(1).max(24), anchor: z.string().min(1).max(60) });

const schema = z.object({
  tabs: z.array(tab).max(8).default([]),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  if (settings.tabs.length === 0) return null;

  return (
    <nav
      aria-label="ข้ามไปยังส่วนต่าง ๆ ของแคมเปญ"
      className="sticky z-30 border-y border-surface-line bg-white/95 backdrop-blur"
      style={{ top: "var(--app-header-h, 0px)" }}
    >
      <ul className="scrollbar-none container-page flex gap-2 overflow-x-auto py-2.5">
        {settings.tabs.map((t) => (
          <li key={t.anchor} className="shrink-0">
            <a
              href={`#${t.anchor}`}
              className="flex h-10 items-center rounded-full border border-surface-line px-4 text-[13px] font-semibold text-brand-ink"
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const categoryJumpTabs: SectionDefinition<typeof schema> = {
  type: "category_jump_tabs",
  version: 1,
  label: "แท็บข้ามไปส่วนต่าง ๆ",
  description: "ติดบนเมื่อเลื่อน · กดแล้วกระโดดไปยัง section ที่ระบุ",
  category: "layout",
  schema,
  defaults: { tabs: [] },
  fields: [
    {
      key: "tabs",
      type: "json",
      label: "แท็บ",
      help: 'แต่ละอัน: label และ anchor (= id ของ section ที่อยู่ในรายการด้านซ้าย) เช่น [{"label":"ผิวหน้า","anchor":"s-1a2b3c4d"}]',
    },
  ],
  enabledOn: ["campaign", "page"],
  maxPerPage: 1,
  check: async (settings) => {
    const issues = [];
    if (settings.tabs.length === 0) {
      issues.push({ level: "error" as const, message: "แท็บข้ามส่วนยังไม่มีแท็บเลย" });
    }
    const anchors = settings.tabs.map((t) => t.anchor);
    if (new Set(anchors).size !== anchors.length) {
      issues.push({ level: "error" as const, message: "มีแท็บที่ชี้ไป section เดียวกันซ้ำ" });
    }
    return issues;
  },
  Component,
};
