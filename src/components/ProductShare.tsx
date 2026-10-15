"use client";

// Sharing a product, the way a shopper expects to be asked.
//
// Modelled on Shopee's own sheet, which every Thai shopper has already used:
// the apps first as coloured marks in a row, then the plain actions under them.
//   https://mobbin.com/screens/65a477db-181a-4d4f-916a-f3f6f56ce9d1
//   https://mobbin.com/screens/4963ee16-c80a-4d42-a7c4-7fc3632046ab
//
// Shopee has to build that list because it is an app. A browser does not: the
// phone's own share sheet already knows every app installed, including the
// ones we would never think to list. So the native sheet comes first where it
// exists, and this panel is what is offered where it does not — plus LINE,
// which is the one target worth naming out loud for this shop's customers.
import { useState } from "react";
import { Check, Copy, Facebook, Share2, Share } from "lucide-react";
import LineIcon from "@/components/icons/LineIcon";
import Modal from "@/components/ui/Modal";

/** X's mark. lucide still ships the old bird, which is not the brand any more. */
function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26l8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function ProductShare({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  /** Set when every copy route failed, so the link can be selected by hand. */
  const [copyFailed, setCopyFailed] = useState(false);

  /** Read at click time: the canonical URL is whatever the shopper is on. */
  const url = () => (typeof window === "undefined" ? "" : window.location.href);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function nativeShare() {
    try {
      await navigator.share({ title: name, text: name, url: url() });
      setOpen(false);
    } catch {
      // The sheet was dismissed. Nothing to report, nothing to undo.
    }
  }

  function flashCopied() {
    setCopied(true);
    setCopyFailed(false);
    setTimeout(() => setCopied(false), 1800);
  }

  async function copyLink() {
    const link = url();
    try {
      await navigator.clipboard.writeText(link);
      flashCopied();
      return;
    } catch {
      // Blocked, or an older browser without the async clipboard.
    }
    try {
      // The route that still works where the modern one is refused.
      const field = document.createElement("textarea");
      field.value = link;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(field);
      if (ok) {
        flashCopied();
        return;
      }
    } catch {
      // Falls through to showing the link.
    }
    // A button that silently does nothing is worse than one that admits it:
    // the link is put on screen, selected, for them to copy by hand.
    setCopyFailed(true);
  }

  function openShare() {
    // On a phone the OS sheet beats any list we could write, so it is not
    // hidden behind a second tap.
    if (canNativeShare) void nativeShare();
    else setOpen(true);
  }

  const targets = [
    {
      label: "LINE",
      icon: <LineIcon size={24} />,
      tone: "bg-[#06C755]/10",
      href: () => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url())}`,
    },
    {
      label: "Facebook",
      icon: <Facebook size={22} className="text-[#1877F2]" />,
      tone: "bg-[#1877F2]/10",
      href: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`,
    },
    {
      label: "X",
      icon: <XIcon size={20} />,
      tone: "bg-slate-900/5",
      href: () => `https://x.com/intent/tweet?text=${encodeURIComponent(name)}&url=${encodeURIComponent(url())}`,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={openShare}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:text-brand-ink"
        aria-label="แชร์สินค้านี้"
      >
        <Share2 size={18} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="แชร์สินค้านี้" size="sm">
        <p className="mb-4 line-clamp-2 text-[13px] text-slate-500">{name}</p>

        <div className="flex gap-5">
          {targets.map((t) => (
            <a
              key={t.label}
              href={t.href()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-16 flex-col items-center gap-1.5"
            >
              <span className={`grid size-12 place-items-center rounded-full ${t.tone}`}>{t.icon}</span>
              <span className="text-[11px] text-slate-600">{t.label}</span>
            </a>
          ))}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={copyLink}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-l px-1 text-left text-[13px] font-semibold text-brand-ink hover:bg-surface-soft"
          >
            {copied ? (
              <Check size={18} className="text-emerald-600" />
            ) : (
              <Copy size={18} className="text-slate-400" />
            )}
            {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
          </button>

          {copyFailed && (
            <div className="mt-1 px-1">
              <p className="mb-1 text-[11px] text-slate-500">คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ลิงก์แล้วคัดลอกเองได้เลย</p>
              <input
                readOnly
                value={url()}
                onFocus={(e) => e.currentTarget.select()}
                autoFocus
                className="w-full rounded-l border border-slate-200 bg-surface-soft px-2 py-2 text-[12px] text-slate-700"
              />
            </div>
          )}

          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-l px-1 text-left text-[13px] font-semibold text-brand-ink hover:bg-surface-soft"
            >
              <Share size={18} className="text-slate-400" />
              แชร์ด้วยแอปอื่น
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
