import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronRight, Sparkles } from "lucide-react";
import AdvisorQuiz from "@/components/AdvisorQuiz";

export const metadata = { title: "น้อง Smoothie | Smoothlife.com" };

export default function AdvisorPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative h-16 w-16 md:h-20 md:w-20 shrink-0">
          <Image src="/mascot/smoothie-hi.png" alt="Smoothie" fill sizes="80px" className="object-contain" priority />
        </div>
        <div>
          <div className="flex items-center gap-2 text-brand-emerald font-semibold text-sm mb-1">
            <Sparkles size={16} /> Guided Assessment
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">น้อง Smoothie</h1>
          <p className="text-sm text-slate-500 mt-1">ผู้ช่วย AI ของ Smoothlife.com แนะนำสกินแคร์และวิเคราะห์ผิวให้คุณ</p>
        </div>
      </div>

      <Link
        href="/skin-coach"
        className="group mb-8 flex items-center gap-4 rounded-xl2 bg-brand-ink p-5 md:p-6 text-white shadow-cardHover transition-transform hover:scale-[1.01]"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-gradient">
          <Camera size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-tight">วิเคราะห์ผิวหน้าด้วยรูปถ่าย</p>
          <p className="text-xs text-white/60 mt-0.5">
            อัพโหลดรูปเซลฟี ให้ AI ให้คะแนนแต่ละจุด สรุปคะแนนรวม แล้วแนะนำสินค้าที่ใช่สำหรับคุณ
          </p>
        </div>
        <ChevronRight size={20} className="text-white/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>

      <AdvisorQuiz />
    </div>
  );
}
