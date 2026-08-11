import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

export const metadata = { title: "ผู้ช่วย AI | Smoothlife.com" };

const ADVISORS = [
  {
    href: "/advisor",
    title: "น้อง Smoothie",
    subtitle: "ผู้ช่วย AI แนะนำสกินแคร์และวิเคราะห์ผิวให้คุณ",
  },
  {
    href: "/skin-coach",
    title: "สแกนผิวกับน้อง Smoothie",
    subtitle: "วิเคราะห์ผิวจากภาพถ่าย เพื่อความสวยงามเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์",
  },
  {
    href: "/oral-care-advisor",
    title: "Oral Care Advisor",
    subtitle: "ตอบ 3 คำถาม รับเซ็ตดูแลช่องปากที่ใช่สำหรับคุณ",
  },
  {
    href: "/supplement-advisor",
    title: "Supplement Advisor",
    subtitle: "ตอบ 5 คำถาม รับแพลนอาหารเสริมที่ตรงเป้าหมายและงบของคุณ",
  },
];

export default function AiAssistantPage() {
  return (
    <div className="container-page py-8 md:py-10 max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative h-14 w-14 md:h-16 md:w-16 shrink-0">
          <Image src="/mascot/smoothie-hi.png" alt="Smoothie" fill sizes="64px" className="object-contain" priority />
        </div>
        <div>
          <div className="flex items-center gap-2 text-brand-emerald font-semibold text-sm mb-1">
            <Sparkles size={16} /> ผู้ช่วย AI
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">เลือกแบบทดสอบที่ใช่สำหรับคุณ</h1>
          <p className="text-sm text-slate-500 mt-1">ให้น้อง Smoothie ช่วยแนะนำสินค้าที่ตรงกับความต้องการของคุณ</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {ADVISORS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-4 rounded-xl2 border border-slate-100 p-5 shadow-card transition-all hover:border-brand-teal hover:shadow-cardHover"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-brand-ink leading-tight">{a.title}</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{a.subtitle}</p>
            </div>
            <ChevronRight size={20} className="text-slate-300 shrink-0 group-hover:translate-x-0.5 group-hover:text-brand-emerald transition-all" />
          </Link>
        ))}
      </div>
    </div>
  );
}
