"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { recommendOralCareSet } from "@/lib/oral-care";
import { formatTHB } from "@/lib/format";
import ProductCard from "@/components/ProductCard";

const CONCERN_OPTIONS = ["กลิ่นปาก", "เสียวฟัน", "ฟันเหลือง", "เหงือกอักเสบ", "ฟันผุบ่อย"];
const USING_OPTIONS = ["ยาสีฟัน", "น้ำยาบ้วนปาก", "ไหมขัดฟัน", "แปรงไฟฟ้า", "ไม่แน่ใจ"];
const SET_TYPE_OPTIONS = ["ครบเซ็ต", "เฉพาะยาสีฟัน", "ประหยัดสุด"];

export default function OralCareAdvisorQuiz() {
  const [step, setStep] = useState(0);
  const [concern, setConcern] = useState<string | null>(null);
  const [using, setUsing] = useState<string | null>(null);
  const [setType, setSetType] = useState<string | null>(null);
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const done = setType !== null;

  function chooseConcern(opt: string) {
    setConcern(opt);
    setStep(1);
  }

  function chooseUsing(opt: string) {
    setUsing(opt);
    setStep(2);
  }

  function reset() {
    setStep(0);
    setConcern(null);
    setUsing(null);
    setSetType(null);
    setAdded(false);
  }

  if (done) {
    const recommended = recommendOralCareSet({
      concerns: concern ? [concern] : [],
      using: using ? [using] : [],
      setType,
    });
    const total = recommended.reduce((sum, p) => sum + p.price, 0);

    function addAllToCart() {
      recommended.forEach((p) => addItem(p.slug));
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    }

    return (
      <div>
        <div className="rounded-xl2 bg-brand-gradient-soft p-6 md:p-8 mb-8">
          <div className="flex items-center gap-2 text-brand-emerald font-semibold text-sm mb-2">
            <Sparkles size={16} /> Oral Care Advisor
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-brand-ink mb-3">เซ็ตดูแลช่องปากที่แนะนำสำหรับคุณ</h2>
          {concern && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs font-medium bg-white rounded-full px-3 py-1.5 text-brand-ink">{concern}</span>
            </div>
          )}
          <p className="text-sm text-slate-600">
            {recommended.length > 0
              ? `รวม ${recommended.length} ชิ้น ราคารวม ${formatTHB(total)}`
              : "ยังไม่มีสินค้าในหมวดนี้พอดีกับตัวกรองที่เลือกไว้ครับ"}
          </p>
        </div>

        {recommended.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6">
              {recommended.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>

            <button
              onClick={addAllToCart}
              className={`w-full sm:w-auto rounded-full text-white font-semibold px-6 py-3.5 text-sm transition-colors ${
                added ? "bg-brand-emerald" : "bg-brand-ink hover:opacity-90"
              }`}
            >
              {added ? "เพิ่มลงตะกร้าแล้ว" : `ใส่ตะกร้าทั้งเซ็ต (${formatTHB(total)})`}
            </button>
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

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-1.5 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-gradient" : "bg-slate-100"}`} />
        ))}
      </div>
      <p className="text-xs font-semibold text-brand-emerald mb-2">คำถามที่ {step + 1} จาก 3</p>

      {step === 0 && (
        <>
          <h2 className="text-xl md:text-2xl font-bold text-brand-ink mb-6">ปัญหาช่องปากที่กวนใจที่สุด?</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {CONCERN_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => chooseConcern(opt)}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-5 py-4 text-sm font-medium text-slate-700 hover:border-brand-teal hover:bg-brand-gradient-soft transition-colors"
              >
                {opt} <ArrowRight size={15} className="text-slate-300" />
              </button>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="text-xl md:text-2xl font-bold text-brand-ink mb-6">ตอนนี้ใช้อะไรอยู่บ้าง?</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {USING_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => chooseUsing(opt)}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-5 py-4 text-sm font-medium text-slate-700 hover:border-brand-teal hover:bg-brand-gradient-soft transition-colors"
              >
                {opt} <ArrowRight size={15} className="text-slate-300" />
              </button>
            ))}
          </div>
          <button onClick={() => setStep(0)} className="text-xs text-slate-400 mt-6">
            ← ย้อนกลับ
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-xl md:text-2xl font-bold text-brand-ink mb-6">อยากได้แบบไหน?</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {SET_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSetType(opt)}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-5 py-4 text-sm font-medium text-slate-700 hover:border-brand-teal hover:bg-brand-gradient-soft transition-colors"
              >
                {opt} <ArrowRight size={15} className="text-slate-300" />
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-xs text-slate-400 mt-6">
            ← ย้อนกลับ
          </button>
        </>
      )}
    </div>
  );
}
