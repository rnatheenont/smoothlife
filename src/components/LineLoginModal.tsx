"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

export default function LineLoginModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState("");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white overflow-hidden shadow-xl">
        <div className="bg-[#06C755] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <MessageCircle size={20} /> LINE Login
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            "Smoothlife.com" ขอสิทธิ์เข้าถึงข้อมูลโปรไฟล์ LINE ของคุณ (ชื่อและรูปโปรไฟล์) เพื่อเข้าสู่ระบบ
          </p>
          <label className="text-xs font-semibold text-slate-500">ชื่อที่แสดงบน LINE (จำลอง)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น Nong Smooth"
            className="w-full mt-1.5 mb-4 rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-teal"
          />
          <button
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
            className="w-full rounded-full bg-[#06C755] text-white font-semibold py-3 text-sm disabled:opacity-50"
          >
            อนุญาตและเข้าสู่ระบบ
          </button>
          <p className="text-[11px] text-slate-400 mt-3 text-center">
            Demo Mode: จำลองหน้าจอ LINE Login สำหรับต้นแบบ ระบบจริงต้องเชื่อมต่อ LINE Login Channel
          </p>
        </div>
      </div>
    </div>
  );
}
