"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

// Installs the LINE Rich Menu (plan §6). Deliberately shows the button layout
// even when the account isn't connected yet — the layout is the part worth
// reviewing and designing an image against, and it can be read long before
// there is an OA to publish it to.

type Button = { label: string; path: string };
type Status = {
  configured: boolean;
  buttons: Button[];
  reason?: string;
  menus?: { richMenuId: string; name: string }[];
  defaultRichMenuId?: string | null;
  error?: string;
};

export default function AdminLineRichMenuPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/line-rich-menu");
      setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function install(file: File) {
    setInstalling(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/admin/line-rich-menu", { method: "POST", body });
      const data = await res.json();
      if (!data.ok) {
        setMessage({ kind: "error", text: data.error || "ติดตั้งเมนูไม่สำเร็จ" });
        return;
      }
      setMessage({ kind: "ok", text: "ติดตั้งเมนูเรียบร้อย — เปิดแชท LINE OA แล้วจะเห็นเมนูด้านล่าง" });
      load();
    } catch {
      setMessage({ kind: "error", text: "ติดตั้งเมนูไม่สำเร็จ" });
    } finally {
      setInstalling(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const live = Boolean(status?.defaultRichMenuId);

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <MessageCircle size={20} className="text-brand-emerald" /> เมนูใน LINE OA
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          แถบปุ่มด้านล่างหน้าแชท LINE — ทุกปุ่มเปิดเว็บผ่าน LIFF โดยล็อกอินให้อัตโนมัติ
        </p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
        <>
          <div
            className={`mb-5 flex items-start gap-2 rounded-xl2 border p-4 text-sm ${
              status?.configured
                ? live
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-slate-100"
                : "border-amber-200 bg-amber-50/60"
            }`}
          >
            {status?.configured ? (
              live ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <Upload size={16} className="mt-0.5 shrink-0 text-slate-400" />
              )
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-brand-ink">
                {!status?.configured ? "ยังเชื่อมต่อ LINE OA ไม่ได้" : live ? "เมนูใช้งานอยู่" : "พร้อมติดตั้ง — ยังไม่ได้อัปโหลดรูป"}
              </p>
              {!status?.configured && (
                <>
                  <p className="mt-1 text-xs text-slate-600">{status?.reason}</p>
                  <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-slate-500">
                    <li>สร้าง LINE Official Account ที่ manager.line.biz (ถ้ามีแล้วข้าม)</li>
                    <li>
                      เปิด Messaging API ให้ OA นั้น โดยเลือก provider เป็น <b>SmoothLife</b> — ต้องเป็นตัวเดียวกับ LIFF
                      ไม่งั้นลูกค้าคนเดียวจะกลายเป็นสองบัญชี
                    </li>
                    <li>
                      ตั้งค่า <code className="rounded bg-white px-1">LINE_MESSAGING_ACCESS_TOKEN</code> บน Vercel
                    </li>
                  </ol>
                </>
              )}
              {status?.error && <p className="mt-1 text-xs text-rose-600">{status.error}</p>}
            </div>
          </div>

          <h2 className="mb-2 text-xs font-semibold text-slate-400">ปุ่มในเมนู (3 × 2)</h2>
          <div className="mb-5 grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl2 border border-slate-100 p-1.5">
            {status?.buttons.map((b) => (
              <div key={b.path} className="rounded-lg bg-surface-soft px-3 py-4 text-center">
                <p className="text-xs font-semibold text-brand-ink">{b.label}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{b.path}</p>
              </div>
            ))}
          </div>

          <h2 className="mb-2 text-xs font-semibold text-slate-400">รูปเมนู</h2>
          <p className="mb-2 text-xs text-slate-500">
            ต้องเป็น PNG หรือ JPEG ขนาด <b>2500 × 1686 px</b> ไม่เกิน 1 MB — ช่องปุ่มเรียงซ้ายไปขวา บนลงล่าง ตามลำดับด้านบน
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            disabled={!status?.configured || installing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) install(f);
            }}
            className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-brand-gradient file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-50"
          />
          {installing && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 size={13} className="animate-spin" /> กำลังติดตั้ง...
            </p>
          )}
          {message && (
            <p className={`mt-2 text-xs ${message.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
              {message.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
