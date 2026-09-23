"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Loader2, Upload, CheckCircle2, AlertTriangle, RefreshCw, Wand2, Trash2 } from "lucide-react";
import { useAdminAction } from "@/components/admin/header-action";
import { PageHeader, Panel } from "@/components/admin/layout-kit";

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
  const [removing, setRemoving] = useState(false);
  // Bumped after every install so the preview refetches: the URL never
  // changes, and a cached picture of the previous menu is the one thing here
  // that could make a wrong install look right.
  const [previewKey, setPreviewKey] = useState(0);
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

  // No file means "use the one the site draws from the button list" — the
  // common case, since a rich menu otherwise needs someone to cut a
  // 2500 × 1686 image whose invisible grid matches the tap areas exactly.
  async function install(file?: File) {
    setInstalling(true);
    setMessage(null);
    try {
      const body = new FormData();
      if (file) body.append("image", file);
      else body.append("generate", "1");
      const res = await fetch("/api/admin/line-rich-menu", { method: "POST", body });
      const data = await res.json();
      if (!data.ok) {
        setMessage({ kind: "error", text: data.error || "ติดตั้งเมนูไม่สำเร็จ" });
        return;
      }
      setMessage({ kind: "ok", text: "ติดตั้งเมนูเรียบร้อย — เปิดแชท LINE OA แล้วจะเห็นเมนูด้านล่าง" });
      setPreviewKey((k) => k + 1);
      load();
    } catch {
      setMessage({ kind: "error", text: "ติดตั้งเมนูไม่สำเร็จ" });
    } finally {
      setInstalling(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("ปิดเมนูและลบออกจาก LINE OA ใช่ไหม? ลูกค้าจะไม่เห็นแถบปุ่มด้านล่างอีก")) return;
    setRemoving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/line-rich-menu", { method: "DELETE" });
      const data = await res.json();
      setMessage(
        data.ok ? { kind: "ok", text: "ปิดเมนูแล้ว" } : { kind: "error", text: data.error || "ปิดเมนูไม่สำเร็จ" }
      );
      load();
    } catch {
      setMessage({ kind: "error", text: "ปิดเมนูไม่สำเร็จ" });
    } finally {
      setRemoving(false);
    }
  }

  const live = Boolean(status?.defaultRichMenuId);

  useAdminAction({
    label: "รีเฟรชสถานะเมนู",
    icon: <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden />,
    onClick: load,
    disabled: loading,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<MessageCircle size={20} className="text-brand-emerald" />}
        title="เมนู LINE OA"
        subtitle="แถบปุ่มด้านล่างหน้าแชท LINE — ทุกปุ่มเปิดเว็บผ่าน LIFF โดยล็อกอินให้อัตโนมัติ"
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</p>
      ) : (
        /* Two columns, because the page is two jobs: "is the menu live and
           what is on it" on the left, and the one thing anyone came here to
           do — upload the image — on the right, where it stays in view
           instead of below the preview. */
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div
              className={`flex items-start gap-2 rounded-xl2 border p-4 text-sm ${
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
                  {!status?.configured
                    ? "ยังเชื่อมต่อ LINE OA ไม่ได้"
                    : live
                      ? "เมนูใช้งานอยู่"
                      : "พร้อมติดตั้ง — ยังไม่ได้อัปโหลดรูป"}
                </p>
                {!status?.configured && (
                  <>
                    <p className="mt-1 text-xs text-slate-600">{status?.reason}</p>
                    <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-slate-500">
                      <li>สร้าง LINE Official Account ที่ manager.line.biz (ถ้ามีแล้วข้าม)</li>
                      <li>
                        เปิด Messaging API ให้ OA นั้น โดยเลือก provider เป็น <b>SmoothLife</b> — ต้องเป็นตัวเดียวกับ
                        LIFF ไม่งั้นลูกค้าคนเดียวจะกลายเป็นสองบัญชี
                      </li>
                      <li>
                        ตั้งค่า <code className="rounded-sm bg-white px-1">LINE_MESSAGING_ACCESS_TOKEN</code> บน Vercel
                      </li>
                    </ol>
                  </>
                )}
                {status?.error && <p className="mt-1 text-xs text-rose-600">{status.error}</p>}
              </div>
            </div>

            {/* Given the width, the preview may as well be the shape of the
                thing it previews: LINE's rich menu image is 2500 × 1686, so
                the six cells sit in that ratio and what is on screen is the
                layout that will be on a phone. */}
            <Panel title="ปุ่มในเมนู (3 × 2)" padded>
              <div className="mx-auto grid aspect-[2500/1686] w-full max-w-[900px] grid-cols-3 grid-rows-2 gap-1.5">
                {status?.buttons.map((b) => (
                  <div
                    key={b.path}
                    className="flex flex-col items-center justify-center rounded-l bg-surface-soft px-3 text-center"
                  >
                    <p className="text-xs font-semibold text-brand-ink">{b.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{b.path}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel title="รูปเมนู" padded>
            <p className="mb-2 text-xs leading-relaxed text-slate-500">
              เว็บวาดรูปให้จากรายการปุ่มด้านซ้าย ช่องในรูปจึงตรงกับพื้นที่ที่กดได้เสมอ แม้ชื่อปุ่มจะถูกแก้ทีหลัง
            </p>

            {/* eslint-disable-next-line @next/next/no-img-element -- drawn per request, not a static asset next/image can size */}
            <img
              key={previewKey}
              src={`/api/admin/line-rich-menu/image?v=${previewKey}`}
              alt="ตัวอย่างรูปเมนู 6 ช่อง เรียง 3 คูณ 2 ตามลำดับปุ่ม"
              width={2500}
              height={1686}
              className="mb-3 w-full rounded-l border border-slate-100"
            />

            <button
              type="button"
              onClick={() => install()}
              disabled={!status?.configured || installing || removing}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {installing ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              {live ? "ติดตั้งรูปนี้ใหม่" : "ติดตั้งด้วยรูปนี้"}
            </button>

            <p className="mb-2 mt-4 text-xs leading-relaxed text-slate-500">
              หรืออัปโหลดรูปที่ออกแบบเอง — PNG หรือ JPEG ขนาด <b>2500 × 1686 px</b> ไม่เกิน 1 MB ช่องปุ่มเรียงซ้ายไปขวา
              บนลงล่าง ตามลำดับด้านซ้าย
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              disabled={!status?.configured || installing || removing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) install(f);
              }}
              className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-surface-soft file:px-4 file:py-2 file:text-xs file:font-semibold file:text-brand-ink disabled:opacity-50"
            />

            {live && (
              <button
                type="button"
                onClick={remove}
                disabled={installing || removing}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50"
              >
                {removing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} ปิดเมนู
              </button>
            )}
            {installing && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 size={13} className="animate-spin" /> กำลังติดตั้ง…
              </p>
            )}
            {message && (
              <p role="status" className={`mt-2 text-xs ${message.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
                {message.text}
              </p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
