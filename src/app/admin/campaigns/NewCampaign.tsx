"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

// Starting a campaign: a name to call it and a link to reach it.
//
// Two fields because two is what a campaign needs before it exists — the
// schedule, the wording and the rules are all editable afterwards in its own
// settings tab, and asking for them here would be asking for answers nobody
// has on the day they decide to run something.

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

export default function NewCampaign({ onCreated }: { onCreated: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && KEY_RE.test(key.trim().toLowerCase());

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/receipts/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), key: key.trim().toLowerCase() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "สร้างกิจกรรมไม่สำเร็จ");
      setOpen(false);
      setName("");
      setKey("");
      onCreated(json.key as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างกิจกรรมไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // The button stays put and the form hangs off it. Both of those matter:
  // the form is `absolute`, so it needs a positioned ancestor of its own —
  // every element above it in the console (the header's action slot, <main>,
  // the canvas) is static, and without this span it measured its `top-full`
  // against the page itself and landed a whole viewport below the fold.
  // Swapping the button out for the form did the rest: the one thing that had
  // been pressed disappeared, and nothing visible took its place.
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft"
      >
        <Plus size={13} aria-hidden /> กิจกรรมใหม่
      </button>

      {/* Hangs off the button's near edge on a phone and its far edge from
          `sm` up: the header wraps on a narrow screen and puts the button on
          the left, where a 22rem panel anchored end-0 runs off the side of
          the window. Capped to the viewport for the widths in between. */}
      {open && (
        <div className="absolute start-0 top-full z-20 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl2 border border-surface-line bg-white p-4 text-left shadow-cardHover sm:start-auto sm:end-0">
          <p className="text-[13px] font-bold text-brand-ink">สร้างกิจกรรมใหม่</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            ตั้งชื่อกับลิงก์ก่อน แล้วค่อยแก้วันที่ เงื่อนไข และวิธีคำนวณสิทธิ์ในแท็บ &ldquo;เงื่อนไข&rdquo;
          </p>

          <label className="mt-3 block">
            <span className="text-[11px] font-semibold text-slate-500">ชื่อกิจกรรม</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DENTISTE'S x SONGKRAN"
              className="mt-1 w-full rounded-lg border border-surface-line px-3 py-2 text-[13px] text-brand-ink focus:border-brand-800 focus:outline-none"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] font-semibold text-slate-500">ลิงก์ (เปลี่ยนทีหลังไม่ได้)</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder="dentiste-x-songkran"
              className="mt-1 w-full rounded-lg border border-surface-line px-3 py-2 font-mono text-[13px] text-brand-ink focus:border-brand-800 focus:outline-none"
            />
          </label>
          {/* Shown as the address it becomes, because that is the thing going on a
              poster and it cannot be changed once it has. */}
          <p className="mt-1.5 break-all font-mono text-[11px] text-slate-400">
            /campaigns/{key.trim().toLowerCase() || "…"}
          </p>

          {error && <p className="mt-2 text-[12px] font-semibold text-rose-700">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={!valid || saving}
              onClick={create}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-800 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              สร้างกิจกรรม
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="min-h-9 rounded-full border border-surface-line px-4 text-[13px] font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
