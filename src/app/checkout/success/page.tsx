"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

// 2C2P's frontendReturnUrl lands here. Two very different arrivals share it:
//
//   1. Inside the checkout modal's iframe — the customer never left the shop,
//      so this page's job is only to tell the parent page that 2C2P is done
//      and let the modal take over. Rendering a whole "thank you" screen
//      squeezed inside a small frame would be the wrong thing entirely.
//   2. As a normal top-level page — the escape-hatch "open in a new tab" path,
//      or any browser that refused to frame the payment page. Here the full
//      confirmation screen is exactly right.
function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const cartToken = searchParams.get("cartToken");
  const [framed, setFramed] = useState<boolean | null>(null);

  useEffect(() => {
    const inFrame = window.top !== window.self;
    setFramed(inFrame);
    if (!inFrame) return;
    // Same-origin parent (the checkout page), so target the exact origin
    // rather than "*" — this message is what dismisses the payment modal.
    window.parent.postMessage({ type: "2c2p:returned", cartToken }, window.location.origin);
  }, [cartToken]);

  if (framed) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin" /> กำลังยืนยันการชำระเงิน...
      </div>
    );
  }

  return (
    <div className="container-page py-20 text-center max-w-md mx-auto">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-gradient-soft mx-auto">
        <CheckCircle2 size={32} className="text-brand-emerald" />
      </div>
      <h1 className="text-2xl font-bold text-brand-ink mt-5">ขอบคุณสำหรับคำสั่งซื้อ!</h1>
      {orderId && <p className="text-lg font-bold text-brand-emerald mt-1">{orderId}</p>}
      <p className="text-sm text-slate-500 mt-4">
        เราได้รับคำสั่งซื้อของคุณแล้ว ใบยืนยันคำสั่งซื้อและรายละเอียดการจัดส่งจะถูกส่งไปยังอีเมลที่ระบุไว้กับ Shopify
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href="/shop" className="rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm">
          ช้อปต่อ
        </Link>
        <Link href="/account" className="rounded-full border border-slate-200 font-semibold px-6 py-3 text-sm">
          กลับสู่บัญชีของฉัน
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-slate-400">กำลังโหลด...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
