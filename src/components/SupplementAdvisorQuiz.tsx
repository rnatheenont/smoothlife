"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useQuickChat } from "@/lib/quickchat-context";
import { recommendSupplementPlan, PREGNANT_OR_BREASTFEEDING } from "@/lib/supplement-advisor";
import { formatTHB } from "@/lib/format";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui";

const GOAL_OPTIONS = ["ผิวสวย", "ผมแข็งแรง", "ภูมิคุ้มกัน", "ระบบขับถ่าย", "นอนหลับ", "พลังงาน", "ข้อกระดูก"];
const AGE_OPTIONS = ["18-25", "26-35", "36-45", "46+"];
const STATUS_OPTIONS = ["ชาย", "หญิง", PREGNANT_OR_BREASTFEEDING, "ไม่ระบุ"];
const LIFESTYLE_OPTIONS = ["นอนดึก", "ออกกำลังกาย", "นั่งทำงานนาน", "กินผักน้อย", "ดื่มกาแฟเยอะ"];
const BUDGET_OPTIONS = ["< 500 บาท", "500-1,000 บาท", "1,000-2,000 บาท", "ไม่จำกัด"];

const STEPS = [
  { key: "goal", question: "เป้าหมายหลักของคุณ?", options: GOAL_OPTIONS },
  { key: "age", question: "ช่วงอายุของคุณ?", options: AGE_OPTIONS },
  { key: "status", question: "เพศ / สถานะ", options: STATUS_OPTIONS },
  { key: "lifestyle", question: "ไลฟ์สไตล์ที่ตรงกับคุณที่สุด?", options: LIFESTYLE_OPTIONS },
  { key: "budget", question: "งบต่อเดือนสำหรับอาหารเสริม?", options: BUDGET_OPTIONS },
];

const DISCLAIMER =
  "ข้อมูลนี้เป็นคำแนะนำเบื้องต้นเพื่อการเลือกซื้อสินค้า ไม่ใช่คำวินิจฉัยหรือคำแนะนำทางการแพทย์ หากมีโรคประจำตัวหรือใช้ยาอยู่ ควรปรึกษาแพทย์หรือเภสัชกรก่อนใช้";

export default function SupplementAdvisorQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const { addItem } = useCart();
  const { openWithProfile } = useQuickChat();
  const [added, setAdded] = useState(false);

  function choose(key: string, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) setStep(step + 1);
    else setDone(true);
  }

  function reset() {
    setStep(0);
    setAnswers({});
    setDone(false);
    setAdded(false);
  }

  if (done) {
    const { items, blocked } = recommendSupplementPlan({
      goal: answers.goal,
      status: answers.status,
      budget: answers.budget,
    });
    const total = items.reduce((sum, p) => sum + p.price, 0);

    function addAllToCart() {
      items.forEach((p) => addItem(p.slug));
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    }

    return (
      <div>
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 mb-6 text-xs text-amber-800">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{DISCLAIMER}</span>
        </div>

        {blocked ? (
          <div className="rounded-xl2 bg-brand-gradient-soft p-6 md:p-8">
            <h2 className="text-xl font-bold text-brand-ink mb-2">ขอแนะนำให้ปรึกษาเภสัชกรก่อนนะคะ</h2>
            <p className="text-sm text-slate-600 mb-5">
              เนื่องจากคุณอยู่ในช่วงตั้งครรภ์หรือให้นมบุตร ทางเราขอไม่แนะนำผลิตภัณฑ์เสริมอาหารแบบอัตโนมัติ
              เพื่อความปลอดภัยของคุณและลูกน้อย กรุณาปรึกษาแพทย์หรือเภสัชกรก่อนใช้ผลิตภัณฑ์ใดๆ
            </p>
            <Button size="lg" href="/help">
              ปรึกษาเภสัชกร
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl2 bg-brand-gradient-soft p-6 md:p-8 mb-8">
              <div className="flex items-center gap-2 text-brand-emerald font-semibold text-sm mb-2">
                <Sparkles size={16} /> Supplement Advisor
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-brand-ink mb-3">แพลนดูแลตัวเองที่แนะนำสำหรับคุณ</h2>
              {answers.goal && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs font-medium bg-white rounded-full px-3 py-1.5 text-brand-ink">{answers.goal}</span>
                </div>
              )}
              <p className="text-sm text-slate-600">
                {items.length > 0
                  ? `รวม ${items.length} รายการ ราคารวมประมาณ ${formatTHB(total)}/เดือน`
                  : "ยังไม่มีสินค้าที่ตรงกับตัวกรองที่เลือกไว้ค่ะ"}
              </p>
            </div>

            {items.length > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 mb-6">
                  {items.map((p) => (
                    <ProductCard key={p.slug} product={p} />
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={addAllToCart}
                    className={`rounded-full text-white font-semibold px-6 py-3.5 text-sm transition-colors ${
                      added ? "bg-brand-emerald" : "bg-brand-ink hover:opacity-90"
                    }`}
                  >
                    {added ? "เพิ่มลงตะกร้าแล้ว" : `ซื้อครั้งเดียว (${formatTHB(total)})`}
                  </button>
                  <Link href="/help" className="rounded-full border border-slate-200 text-sm font-semibold px-6 py-3.5">
                    ปรึกษาเภสัชกร
                  </Link>
                  <button
                    onClick={() => openWithProfile(answers)}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 text-sm font-semibold px-6 py-3.5 hover:border-brand-teal transition-colors"
                  >
                    <Sparkles size={15} className="text-brand-emerald" /> คุยกับน้อง Smoothie ต่อ
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-6">
          <button onClick={reset} className="flex items-center gap-1.5 text-sm text-slate-400">
            <RotateCcw size={14} /> ทำแบบประเมินใหม่
          </button>
        </div>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-1.5 mb-6">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-gradient" : "bg-slate-100"}`} />
        ))}
      </div>
      <p className="text-xs font-semibold text-brand-emerald mb-2">
        คำถามที่ {step + 1} จาก {STEPS.length}
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
