"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

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
