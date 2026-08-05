"use client";

import { useState } from "react";
import { MessageCircle, Phone, Mail, CheckCircle2 } from "lucide-react";
import DemoBadge from "@/components/DemoBadge";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState("");

  return (
    <div className="container-page py-8 md:py-10 max-w-lg mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">แชทและติดต่อเรา</h1>
      <p className="text-sm text-slate-500 mb-6">ทีมบริการลูกค้าพร้อมช่วยเหลือคุณทุกวัน 9:00-20:00 น.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <a href="tel:020000000" className="flex flex-col items-center gap-1.5 rounded-xl2 border border-slate-100 p-4 shadow-card">
          <Phone size={18} className="text-brand-emerald" />
          <span className="text-xs font-medium">โทรหาเรา</span>
        </a>
        <a href="mailto:support@smoothlife.com" className="flex flex-col items-center gap-1.5 rounded-xl2 border border-slate-100 p-4 shadow-card">
          <Mail size={18} className="text-brand-emerald" />
          <span className="text-xs font-medium">อีเมล</span>
        </a>
        <div className="flex flex-col items-center gap-1.5 rounded-xl2 border border-slate-100 p-4 shadow-card">
          <MessageCircle size={18} className="text-brand-emerald" />
          <span className="text-xs font-medium">LINE OA</span>
        </div>
      </div>

      <DemoBadge text="Demo Mode: แบบฟอร์มนี้เก็บข้อความไว้เพื่อสาธิตเท่านั้น ระบบจริงจะเชื่อมต่อกับทีมแชทสด" />

      {sent ? (
        <div className="rounded-xl2 bg-brand-gradient-soft p-6 text-center mt-4">
          <CheckCircle2 className="mx-auto text-brand-emerald mb-2" size={32} />
          <p className="font-semibold text-brand-ink">ส่งข้อความเรียบร้อยแล้ว</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (msg.trim()) setSent(true);
          }}
          className="flex flex-col gap-3 mt-4"
        >
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={4}
            placeholder="พิมพ์ข้อความของคุณ..."
            className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal resize-none"
          />
          <button className="rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm">ส่งข้อความ</button>
        </form>
      )}
    </div>
  );
}
