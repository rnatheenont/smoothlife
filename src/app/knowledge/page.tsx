import Link from "next/link";
import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";
import { BookOpenCheck, ShieldCheck } from "lucide-react";

export const metadata = { title: "Beauty Knowledge | Smoothlife.com" };

const sections = [
  { href: "/knowledge/ingredients", label: "Ingredient Library" },
  { href: "/knowledge/routines", label: "Routine Guides" },
  { href: "/knowledge/questions", label: "Question Hub" },
  { href: "/knowledge/videos", label: "Video and How-to" },
];

export default function KnowledgePage() {
  return (
    <div className="container-page py-8 md:py-10">
      <div className="rounded-xl2 bg-brand-gradient-soft p-6 md:p-8 mb-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-emerald mb-3">
          <BookOpenCheck size={15} /> Expert-reviewed knowledge
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Beauty Knowledge</h1>
        <p className="text-sm text-slate-600 max-w-2xl">คู่มือสินค้า Smoothlife ที่สร้างจากชื่อ รูป ราคา รายละเอียด ส่วนผสม และวิธีใช้ในแคตตาล็อก Shopify พร้อมข้อมูลประกอบจากแหล่งวิชาการที่น่าเชื่อถือ</p>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-4"><ShieldCheck size={15} className="text-brand-emerald" /> ข้อมูลสินค้าอัปเดตจาก Shopify และทุกบทความมีแหล่งอ้างอิง</div>
      </div>
      <div className="flex flex-wrap gap-3 mb-8">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-brand-teal hover:text-brand-emerald transition-colors">
            {s.label}
          </Link>
        ))}
      </div>
      <div className="flex items-end justify-between gap-4 mb-4">
        <h2 className="font-bold text-brand-ink">10 เรื่องผิวที่ควรรู้</h2>
        <span className="text-xs text-slate-400">ตรวจสอบข้อมูลล่าสุด สิงหาคม 2026</span>
      </div>
      <ArticleGrid articles={articles} />
    </div>
  );
}
