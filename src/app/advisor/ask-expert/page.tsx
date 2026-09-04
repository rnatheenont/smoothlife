"use client";

import { useState } from "react";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import DemoBadge from "@/components/DemoBadge";
import { Button } from "@/components/ui";

export default function AskExpertPage() {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="container-page py-8 md:py-10 max-w-lg mx-auto">
      <div className="flex items-center gap-2 text-brand-emerald font-semibold text-sm mb-2">
        <MessageCircle size={16} /> Ask an Expert
      </div>
      <h1 className="text-2xl font-bold text-brand-ink mb-2">ปรึกษาผู้เชี่ยวชาญด้านผิวฟรี</h1>
      <p className="text-sm text-slate-500 mb-6">ทีมเภสัชกรและผู้เชี่ยวชาญของเราพร้อมให้คำแนะนำเฉพาะบุคคล</p>
      <DemoBadge text="Demo Mode: ข้อความจะถูกบันทึกในต้นแบบนี้เท่านั้น ระบบจริงจะเชื่อมต่อกับทีมแชทหรือ LINE OA" />
      {sent ? (
        <div className="rounded-xl2 bg-brand-gradient-soft p-6 text-center mt-6">
          <CheckCircle2 className="mx-auto text-brand-emerald mb-2" size={32} />
          <p className="font-semibold text-brand-ink">ส่งคำถามเรียบร้อยแล้ว</p>
          <p className="text-sm text-slate-500 mt-1">ผู้เชี่ยวชาญจะติดต่อกลับภายใน 24 ชั่วโมง</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) setSent(true);
          }}
          className="flex flex-col gap-3 mt-6"
        >
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="อธิบายปัญหาผิวหรือคำถามของคุณ..."
            className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal resize-none"
          />
          <Button type="submit" size="lg">
            ส่งคำถามให้ผู้เชี่ยวชาญ
          </Button>
        </form>
      )}
    </div>
  );
}
