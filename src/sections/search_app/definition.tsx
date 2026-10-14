import { Suspense } from "react";
import { z } from "zod";
import SearchContent from "@/components/SearchContent";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The search page, whole.
//
// Locked and settingless for the same reason as the brand directory: what is
// on this page is an application reading the query string, not content. The
// point of moving it in is to be able to put a block above or below it — a
// promo for whoever searched for nothing, a note during a sale — without a
// deploy.
//
// The Suspense boundary is required, not decorative: SearchContent reads the
// query string with useSearchParams, and a route that does that without a
// boundary around it cannot be prerendered at all. The fallback is the one
// the hand-written page used, word for word.

const schema = z.object({
  loadingText: z.string().max(80).default(""),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  return (
    <Suspense
      fallback={<div className="container-page py-20 text-center text-slate-500">{settings.loadingText}</div>}
    >
      <SearchContent />
    </Suspense>
  );
}

export const searchApp: SectionDefinition<typeof schema> = {
  type: "search_app",
  version: 1,
  label: "หน้าค้นหา",
  description: "ช่องค้นหาและผลลัพธ์ อ่านคำค้นจาก URL — ทำงานในตัวเอง",
  category: "product",
  schema,
  defaults: { loadingText: "กำลังโหลด…" },
  fields: [{ key: "loadingText", type: "text", label: "ข้อความระหว่างโหลด" }],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  Component,
};
