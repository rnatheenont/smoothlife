import Link from "next/link";
import { FileText, Home } from "lucide-react";

import { PageHeader } from "@/components/admin/layout-kit";
import { Card } from "@/components/ui";

// The list of pages the team can edit.
//
// One entry for now. It is a page rather than a redirect to the home editor
// because the next phases add campaign and brand pages here, and a list that
// appears the day there are two of something is a list nobody learns to look
// for.

const PAGES = [
  {
    kind: "home",
    slug: "home",
    title: "หน้าแรก",
    description: "แบนเนอร์ ทางลัดหมวดหมู่ Flash Sale คลิปโซเชียล แบรนด์ และบทความ",
    icon: Home,
  },
];

export default function AdminPagesIndex() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="หน้าเว็บ"
        subtitle="ประกอบหน้าจาก section ที่เลือกได้ · แก้เป็นร่างก่อน แล้วค่อยเผยแพร่"
      />

      <Card padded={false}>
        <ul className="divide-y divide-slate-100">
          {PAGES.map((page) => (
            <li key={`${page.kind}/${page.slug}`}>
              <Link
                href={`/admin/pages/${page.kind}/${page.slug}`}
                className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-surface-soft"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                  <page.icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-brand-ink">{page.title}</span>
                  <span className="block text-[12px] text-slate-500">{page.description}</span>
                </span>
                <span className="shrink-0 text-[12px] text-slate-400">/{page.slug === "home" ? "" : page.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-500">
        <FileText size={15} className="mt-0.5 shrink-0" />
        หน้าแคมเปญและหน้าแบรนด์จะมาเพิ่มในรายการนี้ในเฟสถัดไป · การแก้ที่นี่ยังไม่ขึ้นหน้าเว็บจนกว่าจะกดเผยแพร่
      </p>
    </div>
  );
}
