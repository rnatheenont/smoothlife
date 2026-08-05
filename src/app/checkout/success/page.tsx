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
      <h1 className="text-2xl font-bold text-brand-ink mt-5">สั่งซื้อสำเร็จ!</h1>
      <p className="text-sm text-slate-500 mt-2">
        ขอบคุณสำหรับคำสั่งซื้อ หมายเลขคำสั่งซื้อของคุณคือ
      </p>
      <p className="text-lg font-bold text-brand-emerald mt-1">{orderId}</p>
      <p className="text-sm text-slate-500 mt-4">
        เราได้เพิ่มคะแนนสะสมให้คุณเรียบร้อยแล้ว ตรวจสอบสถานะคำสั่งซื้อได้ในหน้าบัญชีของฉัน
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href="/account/orders" className="rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm">
          ดูคำสั่งซื้อของฉัน
        </Link>
        <Link href="/shop" className="rounded-full border border-slate-200 font-semibold px-6 py-3 text-sm">
          ช้อปต่อ
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
