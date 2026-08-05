"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useGlowChallenge } from "@/lib/glow-challenge-context";

export default function ConsentGate() {
  const { giveConsent } = useGlowChallenge();
  const [ageOk, setAgeOk] = useState(false);
  const [dataOk, setDataOk] = useState(false);

  const canContinue = ageOk && dataOk;

  return (
    <div className="container-page py-10 md:py-14 max-w-2xl">
      <div className="rounded-xl2 border border-slate-100 shadow-card p-6 md:p-8">
        <div className="flex items-center gap-2 text-brand-emerald mb-4">
          <ShieldCheck size={22} />
          <span className="text-sm font-semibold">ก่อนเริ่ม Glow Challenge 7 วัน</span>
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-brand-ink mb-4">
          ขอความยินยอมในการใช้ภาพถ่ายใบหน้า
        </h1>

        <div className="text-sm text-slate-600 space-y-3 mb-6">
          <p>
            ฟีเจอร์นี้จะให้คุณถ่ายรูปใบหน้าวันละครั้งต่อเนื่อง 7 วัน เพื่อประเมินลักษณะผิว
            (ความเรียบเนียน จุดด่างดำ ริ้วรอย) แบบคร่าวๆ ด้วย AI
          </p>
          <p className="font-semibold text-brand-ink">ภาพถ่ายใบหน้าถือเป็นข้อมูลอ่อนไหวตามกฎหมาย เราจึงขอแจ้งให้ทราบว่า</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>รูปที่ถ่ายจะถูกส่งไปวิเคราะห์กับระบบ AI แบบชั่วคราวเท่านั้น เราไม่เก็บรูปความละเอียดสูงไว้บนเซิร์ฟเวอร์ของเรา</li>
            <li>ภาพขนาดย่อ (thumbnail) และผลคะแนนจะถูกเก็บไว้ใน browser ของคุณเท่านั้น ไม่ถูกส่งให้บุคคลอื่น</li>
            <li>คุณสามารถลบข้อมูลทั้งหมดได้ทุกเมื่อด้วยปุ่ม “ลบข้อมูลทั้งหมด” ในหน้านี้</li>
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
          onClick={giveConsent}
          className="w-full rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ยินยอมและเริ่มต้น
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
