"use client";

import { useState } from "react";
import Link from "next/link";
import { Facebook, Instagram, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "สินค้าทั้งหมด" },
      { href: "/brands", label: "แบรนด์ทั้งหมด" },
      { href: "/promotions", label: "โปรโมชั่น" },
      { href: "/concern", label: "Shop by Concern" },
    ],
  },
  {
    title: "Why Smooth Life",
    links: [
      { href: "/about", label: "เกี่ยวกับเรา" },
      { href: "/about/quality", label: "คุณภาพและมาตรฐาน" },
      { href: "/about/experts", label: "ผู้เชี่ยวชาญและพาร์ทเนอร์" },
      { href: "/about/sustainability", label: "ความรับผิดชอบต่อสังคม" },
    ],
  },
  {
    title: "Help & Account",
    links: [
      { href: "/help", label: "ศูนย์ช่วยเหลือ" },
      { href: "/help/delivery", label: "การจัดส่งและคืนสินค้า" },
      { href: "/help/payment", label: "การชำระเงิน" },
      { href: "/loyalty", label: "สิทธิสมาชิก" },
      { href: "/stores", label: "สาขาและติดต่อเรา" },
    ],
  },
];

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setError("สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-brand-emerald font-medium mt-4">
        <CheckCircle2 size={16} /> สมัครรับข่าวสารสำเร็จแล้วค่ะ
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <p className="text-xs font-semibold text-brand-ink mb-2">รับโปรโมชั่นและข่าวสารทางอีเมล</p>
      <div className="flex items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="อีเมลของคุณ"
          className="flex-1 min-w-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <Button size="none" className="grid h-9 w-9 shrink-0 place-items-center" type="submit" disabled={status === "loading"} aria-label="สมัครรับข่าวสาร">
          <Send size={14} />
        </Button>
      </div>
      {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
    </form>
  );
}

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-100 bg-surface-soft">
      <div className="container-page py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <div className="font-extrabold text-xl mb-3">
            <span className="brand-text-gradient">Smoothlife</span>
            <span className="text-brand-sky">.com</span>
          </div>
          <p className="text-sm text-slate-500 max-w-xs">
            ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม ของแท้ 100% มีอย. จัดส่งทั่วไทย
          </p>
          <div className="flex items-center gap-3 mt-4">
            <a href="#" aria-label="Facebook" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-card text-slate-500 hover:text-brand-emerald">
              <Facebook size={16} />
            </a>
            <a href="#" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-card text-slate-500 hover:text-brand-emerald">
              <Instagram size={16} />
            </a>
            <a href="#" aria-label="LINE Official" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-card text-slate-500 hover:text-brand-emerald">
              <MessageCircle size={16} />
            </a>
          </div>
          <NewsletterForm />
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-semibold text-sm text-brand-ink mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-brand-emerald transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <div className="container-page py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>© 2026 Smoothlife.com — เว็บไซต์เดโมสำหรับการนำเสนอ (Prototype)</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-brand-emerald">นโยบายความเป็นส่วนตัว</Link>
            <Link href="/terms" className="hover:text-brand-emerald">เงื่อนไขการใช้บริการ</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
