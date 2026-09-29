"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Share, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED_KEY = "sl_install_dismissed_at";
const QUIET_DAYS = 30;
// Nobody wants this in the middle of paying, and an admin is at a desk.
const NOT_HERE = ["/checkout", "/cart", "/admin", "/campaigns"];

/**
 * The offer to keep the shop on the home screen — once, quietly, and late.
 *
 * Shown after half a minute on the page rather than on arrival: an install
 * card in front of somebody who has not yet decided they like the shop is an
 * interruption, not an offer. Dismissing it buys a month of silence.
 *
 * Android hands us a real prompt. iOS has no such API, so Safari gets the two
 * taps written out instead — and only when the page is not already running
 * from the home screen, which is the state this card exists to reach.
 */
export default function InstallPrompt() {
  const pathname = usePathname() || "/";
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    if (NOT_HERE.some((p) => pathname.startsWith(p))) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    } catch {}
    if (dismissedAt && Date.now() - dismissedAt < QUIET_DAYS * 86_400_000) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = isIos && !/crios|fxios/i.test(navigator.userAgent);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const timer = setTimeout(() => {
      setGone(false);
      if (isSafari) setShowIosHint(true);
    }, 30_000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, [pathname]);

  function dismiss() {
    setGone(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    dismiss();
  }

  if (gone) return null;
  if (!event && !showIosHint) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-80 lg:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-cardHover backdrop-blur-md">
        <Image src="/icon-192.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-brand-ink">ติดตั้ง Smoothlife ลงหน้าจอโฮม</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            {showIosHint ? (
              <>
                แตะปุ่มแชร์ <Share size={11} className="inline align-[-1px]" aria-hidden /> แล้วเลือก
                “เพิ่มไปยังหน้าจอโฮม”
              </>
            ) : (
              "เปิดได้เร็วขึ้น เหมือนแอป ไม่ต้องผ่านเบราว์เซอร์"
            )}
          </p>
        </div>
        {event && (
          <button
            type="button"
            onClick={install}
            className="min-h-9 shrink-0 rounded-full bg-brand-action px-4 text-[13px] font-semibold text-white"
          >
            ติดตั้ง
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิด"
          className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-black/5"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
