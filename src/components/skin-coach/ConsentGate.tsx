"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

const KEY = "sl_skin_coach_consent";

export default function ConsentGate({ onConsent }: { onConsent: () => void }) {
  const [ageOk, setAgeOk] = useState(false);
  const [dataOk, setDataOk] = useState(false);
  const canContinue = ageOk && dataOk;

  function handleConsent() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    onConsent();
  }

  return (
    <div className="container-page py-10 md:py-14 max-w-2xl">
      <div className="rounded-xl2 border border-slate-100 shadow-card p-6 md:p-8">
        <div className="flex items-center gap-2 text-brand-emerald mb-4">
          <ShieldCheck size={22} />
          <span className="text-sm font-semibold">ก่อนเริ่ม Skin Coach</span>
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-brand-ink mb-4">
          ขอความยินยอมในการใช้ภาพถ่ายใบหน้า
        </h1>

        <div className="text-sm text-slate-600 space-y-3 mb-6">
          <p>ถ่ายเซลฟีอย่างน้อย 1 มุม (หน้าตรง, หน้าผาก, แก้ม, ขอบตา, คาง หรือจุดที่มีปัญหา) AI จะประเมินลักษณะผิวและอายุผิว แล้วแนะนำสินค้าและขั้นตอนดูแลผิวที่เหมาะกับคุณ</p>
          <p className="font-semibold text-brand-ink">ภาพถ่ายใบหน้าถือเป็นข้อมูลอ่อนไหวตามกฎหมาย เราจึงขอแจ้งให้ทราบว่า</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>รูปที่ถ่ายจะถูกส่งไปวิเคราะห์กับระบบ AI แบบชั่วคราวเท่านั้น เราไม่เก็บรูปไว้บนเซิร์ฟเวอร์ของเรา</li>
            <li>ผลวิเคราะห์จะแสดงในเบราว์เซอร์ของคุณเท่านั้น ไม่ถูกส่งให้บุคคลอื่นหรือบันทึกถาวร</li>
            <li>ผลวิเคราะห์เป็นการประเมินเบื้องต้นเพื่อความสวยงามเท่านั้น <span className="font-semibold">ไม่ใช่การวินิจฉัยทางการแพทย์</span> หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 mb-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand-emerald"
            checked={ageOk}
            onChange={(e) => setAgeOk(e.target.checked)}
          />
          <span className="text-sm text-slate-700">
            ฉันอายุ 20 ปีขึ้นไป หรือได้รับความยินยอมจากผู้ปกครอง/ผู้แทนโดยชอบธรรมแล้ว
          </span>
        </label>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand-emerald"
            checked={dataOk}
            onChange={(e) => setDataOk(e.target.checked)}
          />
          <span className="text-sm text-slate-700">
            ฉันยินยอมให้ถ่ายภาพใบหน้าของฉันเพื่อวิเคราะห์ลักษณะผิวตามที่อธิบายไว้ข้างต้น
          </span>
        </label>

        <button
          disabled={!canContinue}
          onClick={handleConsent}
          className="w-full rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ยินยอมและเริ่มสแกนผิว
        </button>
        <p className="text-xs text-slate-400 mt-3">
          สอบถามเรื่องข้อมูลส่วนบุคคลเพิ่มเติมได้ที่หน้า{" "}
          <a href="/help/contact" className="underline">
            ติดต่อเรา
          </a>
        </p>
      </div>
    </div>
  );
}

export function hasStoredConsent() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
