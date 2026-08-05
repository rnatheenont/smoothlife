"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { Concern } from "@/data/types";
import { concerns } from "@/data/categories";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import { useQuickChat } from "@/lib/quickchat-context";

const steps = [
  {
    key: "skinType",
    question: "ผิวของคุณเป็นแบบไหน?",
    options: ["ผิวมัน", "ผิวแห้ง", "ผิวผสม", "ผิวแพ้ง่าย"],
  },
  {
    key: "concern",
    question: "ปัญหาผิวที่คุณกังวลที่สุดคืออะไร?",
    options: concerns.map((c) => c.nameTh),
  },
  {
    key: "age",
    question: "ช่วงอายุของคุณ?",
    options: ["ต่ำกว่า 20", "20-29", "30-39", "40 ปีขึ้นไป"],
  },
  {
    key: "budget",
    question: "งบประมาณต่อเดือนสำหรับสกินแคร์?",
    options: ["ต่ำกว่า 500 บาท", "500-1,500 บาท", "1,500-3,000 บาท", "มากกว่า 3,000 บาท"],
  },
];

export default function AdvisorQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const { openWithProfile, setProfile } = useQuickChat();

  function choose(key: string, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step < steps.length - 1) setStep(step + 1);
    else {
      setDone(true);
      setProfile(next);
    }
  }

  function reset() {
    setAnswers({});
    setStep(0);
    setDone(false);
  }

  if (done) {
    const concernAnswer = answers["concern"];
    const concernInfo = concerns.find((c) => c.nameTh === concernAnswer);
    const recommended = concernInfo
      ? products.filter((p) => p.concerns.includes(concernInfo.slug as Concern)).slice(0, 4)
      : products.slice(0, 4);

    return (
      <div>
        <div className="rounded-xl2 bg-brand-gradient-soft p-6 md:p-8 mb-8">
          <div className="flex items-center gap-2 text-brand-emerald font-semibold text-sm mb-2">
            <Sparkles size={16} /> Personalized Recommendations
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-brand-ink mb-3">
            สรุปโปรไฟล์ผิวของคุณ
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.values(answers).map((v) => (
              <span key={v} className="text-xs font-medium bg-white rounded-full px-3 py-1.5 text-brand-ink">
                {v}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            จากคำตอบของคุณ เราแนะนำให้เน้นดูแลเรื่อง <strong>{concernAnswer || "สุขภาพผิวโดยรวม"}</strong> ด้วยรูทีน 3 ขั้นตอน:
            ทำความสะอาดอย่างอ่อนโยน → ทรีทเมนต์เฉพาะจุด → มอยส์เจอร์ไรเซอร์และกันแดดทุกวัน
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={() => openWithProfile(answers)}
              className="flex items-center gap-1.5 rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-2.5 shadow-cardHover"
            >
              <Sparkles size={13} /> คุยกับ AI Advisor
            </button>
            <Link href="/advisor/routine-builder" className="rounded-full border border-slate-200 text-xs font-semibold px-4 py-2.5">
              สร้างรูทีนของคุณ
            </Link>
            <Link href="/advisor/compare" className="rounded-full border border-slate-200 text-xs font-semibold px-4 py-2.5">
              เปรียบเทียบสินค้า
            </Link>
            <Link href="/advisor/ask-expert" className="rounded-full border border-slate-200 text-xs font-semibold px-4 py-2.5">
              ปรึกษาผู้เชี่ยวชาญ
            </Link>
          </div>
        </div>

        <h3 className="font-bold text-brand-ink mb-4">สินค้าที่แนะนำสำหรับคุณ</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-10">
          {recommended.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>


        <button onClick={reset} className="flex items-center gap-1.5 text-sm text-slate-400">
          <RotateCcw size={14} /> ทำแบบประเมินใหม่
        </button>
      </div>
    );
  }

  const current = steps[step];

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-1.5 mb-6">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-gradient" : "bg-slate-100"}`} />
        ))}
      </div>
      <p className="text-xs font-semibold text-brand-emerald mb-2">
        คำถามที่ {step + 1} จาก {steps.length}
      </p>
      <h2 className="text-xl md:text-2xl font-bold text-brand-ink mb-6">{current.question}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {current.options.map((opt) => (
          <button
            key={opt}
            onClick={() => choose(current.key, opt)}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-5 py-4 text-sm font-medium text-slate-700 hover:border-brand-teal hover:bg-brand-gradient-soft transition-colors"
          >
            {opt} <ArrowRight size={15} className="text-slate-300" />
          </button>
        ))}
      </div>
      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="text-xs text-slate-400 mt-6">
          ← ย้อนกลับ
        </button>
      )}
    </div>
  );
}
