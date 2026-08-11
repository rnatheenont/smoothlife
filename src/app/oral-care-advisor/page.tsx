import Image from "next/image";
import { Sparkles } from "lucide-react";
import OralCareAdvisorQuiz from "@/components/OralCareAdvisorQuiz";

export const metadata = { title: "Oral Care Advisor | Smoothlife.com" };

export default function OralCareAdvisorPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative h-14 w-14 md:h-16 md:w-16 shrink-0">
          <Image src="/mascot/smoothie-hi.png" alt="Smoothie" fill sizes="64px" className="object-contain" priority />
        </div>
        <div>
          <div className="flex items-center gap-2 text-brand-emerald font-semibold text-sm mb-1">
            <Sparkles size={16} /> Oral Care Advisor
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">เลือกชุดดูแลช่องปากที่ใช่สำหรับคุณ</h1>
          <p className="text-sm text-slate-500 mt-1">ตอบ 3 คำถาม รับเซ็ตแนะนำแบบพอดีตัวใน 30 วินาที</p>
        </div>
      </div>

      <OralCareAdvisorQuiz />
    </div>
  );
}
