import Link from "next/link";
import { z } from "zod";
import { tierDisplayName, tierCard } from "@/lib/tier";
import { TIER_CRITERIA } from "@/lib/loyalty-shared";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The membership tiers, side by side.
//
// Locked, because the tiers themselves are not text: their names, their
// colours and the spend that earns them come from the code that awards them
// (TIER_CRITERIA, tierCard, tierDisplayName). An admin who could edit "฿3,000"
// here would be editing a claim, not a rule — the system would keep promoting
// people at the old number and the page would be a lie with nobody at fault.
//
// What is editable is everything that describes the perks: the heading, the
// line under it, every row of the table, and the note at the foot. Those are
// the parts that change when a perk changes, and they are the whole reason
// this page needed a deploy before.
//
// It owns its own heading rather than sitting under a page_header, which is
// unusual and deliberate: the title shares a line with the link to the
// account, and the whole block is vertically centred on a tall screen. That
// is one layout, not a header with a table under it.

const row = z.object({
  label: z.string().max(80).default(""),
  values: z.array(z.string().max(60)).max(3).default([]),
});

const schema = z.object({
  title: z.string().max(120).default(""),
  intro: z.string().max(300).default(""),
  linkLabel: z.string().max(40).default(""),
  linkHref: z.string().default(""),
  rows: z.array(row).max(20).default([]),
  footnote: z.string().max(300).default(""),
});

/** "สมัครวันนี้" for the tier everybody starts in, the spend for the rest. */
function entryLabel(min: number) {
  return min === 0 ? "สมัครวันนี้" : `฿${min.toLocaleString()}+ / 12 ด.`;
}

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const tiers = TIER_CRITERIA;
  const rows = settings.rows.filter((r) => r.label);

  return (
    <div className="container-page flex flex-col py-4 md:min-h-[calc(100vh-260px)] md:justify-center md:py-8">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        {settings.title && <h1 className="text-lg font-bold text-brand-ink md:text-2xl">{settings.title}</h1>}
        {settings.linkLabel && settings.linkHref && (
          <Link
            href={settings.linkHref}
            className="shrink-0 whitespace-nowrap text-xs font-semibold text-brand-800"
          >
            {settings.linkLabel}
          </Link>
        )}
      </div>
      {settings.intro && <p className="mb-3 text-xs text-slate-500">{settings.intro}</p>}

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[520px] border-collapse text-xs md:text-sm">
          <thead>
            <tr>
              <th className="w-[32%]" />
              {tiers.map((t) => (
                <th key={t.name} className="px-1.5 pb-2.5 text-center">
                  <div className="rounded-xl px-2 py-2 text-white" style={{ background: tierCard[t.name].gradient }}>
                    <p className="text-sm font-extrabold leading-tight md:text-base md:leading-6">
                      {tierDisplayName[t.name].th}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/80">{entryLabel(t.minSpend)}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={i < rows.length - 1 ? "border-b border-slate-100" : ""}>
                <td className="py-2 pr-2 text-slate-600 md:py-2.5">{r.label}</td>
                {tiers.map((t, j) => (
                  <td key={t.name} className="px-1.5 py-2 text-center font-medium text-brand-ink md:py-2.5">
                    {r.values[j] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {settings.footnote && <p className="mt-2.5 text-[11px] text-slate-500">{settings.footnote}</p>}
    </div>
  );
}

export const tierCards: SectionDefinition<typeof schema> = {
  type: "tier_cards",
  version: 1,
  label: "ตารางสิทธิสมาชิก",
  description: "เปรียบเทียบสิทธิแต่ละระดับ — ระดับและเกณฑ์มาจากระบบ แก้ได้เฉพาะคำอธิบาย",
  category: "content",
  schema,
  defaults: {
    title: "สิทธิสมาชิกแต่ละระดับ",
    intro: "คำนวณจากยอดใช้จ่ายสะสม 12 เดือน (หรือจำนวนออเดอร์) อัปเดตอัตโนมัติทุกวัน",
    linkLabel: "ไปที่บัญชี →",
    linkHref: "/account",
    rows: [{ label: "อัตราแต้มสะสม", values: ["1 แต้ม / ฿1", "1 แต้ม / ฿1", "1 แต้ม / ฿1"] }],
    footnote: "สิทธิ์บางอย่างต้องมีประวัติสั่งซื้อสินค้าจริงก่อนจึงจะได้รับ (เช่น โบนัสวันเกิด)",
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ (h1 ของหน้า)" },
    { key: "intro", type: "textarea", label: "คำอธิบายใต้หัวข้อ" },
    { key: "linkLabel", type: "text", label: "ข้อความลิงก์มุมขวา" },
    { key: "linkHref", type: "text", label: "ลิงก์มุมขวา" },
    {
      key: "rows",
      type: "json",
      label: "แถวในตาราง",
      help: "แต่ละแถว: label และ values 3 ช่อง เรียงตามระดับ Bronze, Silver, Gold",
    },
    { key: "footnote", type: "text", label: "หมายเหตุท้ายตาราง" },
  ],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  Component,
};
