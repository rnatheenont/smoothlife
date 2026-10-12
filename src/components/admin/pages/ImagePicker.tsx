"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { MEDIA_WIDTHS, type MediaAsset } from "@/lib/media";

// Choosing a picture, and putting a new one in the library.
//
// Resizing happens here, in the browser, before anything is sent. Two
// reasons, and the second is the one that decides it: a route handler on
// Vercel receives about 4.5MB of request body, and a photograph straight off
// a phone is routinely more than that — so a server that resized would have
// to reject the picture before it could resize it.
//
// Three widths go up. The section offers all three with srcset, which is the
// only way the extra files pay for themselves here: the project runs with
// images.unoptimized, so nothing downstream will resize anything.

async function resizeTo(file: Blob, width: number): Promise<{ width: number; dataUrl: string; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, width / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // JPEG at 0.85: the difference from 0.95 is invisible on a photograph and
  // about half the bytes.
  return { width: w, height: h, dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
}

export default function ImagePicker({
  value,
  onChange,
  onPickAlt,
}: {
  value: string;
  onChange: (url: string) => void;
  /** The chosen picture's own description, so the section can inherit it
   *  rather than ask the same question again. */
  onPickAlt?: (alt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/media");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "โหลดคลังรูปไม่สำเร็จ");
      setAssets(data.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดคลังรูปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const sizes = await Promise.all(MEDIA_WIDTHS.map((w) => resizeTo(file, w)));
      const largest = sizes[sizes.length - 1];
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: largest.width,
          height: largest.height,
          sizes: sizes.map((s) => ({ width: s.width, dataUrl: s.dataUrl })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "อัปโหลดไม่สำเร็จ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveAlt(asset: MediaAsset, alt: string) {
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, alt } : a)));
    await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: asset.id, alt }),
    }).catch(() => {});
  }

  async function remove(asset: MediaAsset) {
    await fetch(`/api/admin/media?id=${encodeURIComponent(asset.id)}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div>
      <div className="mt-1.5 flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- a preview of
          // an arbitrary uploaded URL; next/image is configured unoptimized
          // here anyway, so it would add nothing but a host allowlist.
          <img src={value} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid h-16 w-24 shrink-0 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-300">
            <ImagePlus size={18} />
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setOpen(true)}
            className="h-10 rounded-full border border-slate-200 px-3.5 text-[13px] font-semibold text-brand-800"
          >
            {value ? "เปลี่ยนรูป" : "เลือกรูป"}
          </button>
          {value && (
            <button onClick={() => onChange("")} className="h-8 text-left text-[12px] text-slate-500 hover:text-rose-600">
              เอารูปออก
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-100 grid place-items-center p-4">
          <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="คลังรูป"
            className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-bold text-brand-ink">คลังรูป</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-10 items-center gap-1.5 rounded-full bg-brand-gradient px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  อัปโหลดรูป
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="ปิด"
                  className="grid h-10 w-10 place-items-center rounded-full bg-surface-soft text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />

            {error && <p className="px-5 pt-3 text-sm text-rose-600">{error}</p>}

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="py-10 text-center text-sm text-slate-500">กำลังโหลด…</p>
              ) : assets.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">ยังไม่มีรูปในคลัง — กดอัปโหลดรูปเพื่อเริ่ม</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {assets.map((asset) => (
                    <li key={asset.id} className="rounded-xl border border-slate-100 p-2">
                      <button
                        onClick={() => {
                          onChange(asset.url);
                          if (asset.alt) onPickAlt?.(asset.alt);
                          setOpen(false);
                        }}
                        className="block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.sources?.["480"] ?? asset.url}
                          alt={asset.alt}
                          className="aspect-[4/3] w-full rounded-lg object-cover"
                        />
                      </button>
                      <input
                        value={asset.alt}
                        onChange={(e) => void saveAlt(asset, e.target.value)}
                        placeholder="คำบรรยายรูป…"
                        aria-label={`คำบรรยายของรูปนี้`}
                        className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-2 text-[12px] outline-hidden focus-visible:border-brand-teal"
                      />
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {asset.width ?? "?"}×{asset.height ?? "?"}
                        </span>
                        <button
                          onClick={() => void remove(asset)}
                          aria-label="ลบรูปนี้ออกจากคลัง"
                          className="grid h-8 w-8 place-items-center rounded-md hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">
              คำบรรยายเก็บไว้ที่รูป ไม่ใช่ที่หน้าที่เอาไปใช้ — รูปเดียวกันที่ใช้หลายที่จึงเขียนครั้งเดียว
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
