import Link from "next/link";
import { ChevronRight, Gift, Truck } from "lucide-react";

// The two standing offers, side by side: what membership gives back, and the
// delivery promise. Both are real — points accrue on every paid order, and
// shipping is free on every order with no minimum (data/help.ts).
export default function PromoPair() {
  return (
    <section className="container-page grid gap-3 py-8 md:grid-cols-2 md:gap-5 md:py-12">
      <div className="relative overflow-hidden rounded-xl2 bg-[linear-gradient(115deg,#DFF3EB,#F1FAF6)] p-5 md:p-7">
        <p className="text-xl font-extrabold leading-tight text-brand-1000 md:text-2xl md:leading-8">
          Smoothlife
          <span className="block text-brand-800">Rewards</span>
        </p>
        <p className="mt-1.5 text-sm text-slate-600">ช้อป · สะสมแต้ม · แลกรับสิทธิพิเศษ</p>
        <Link
          href="/loyalty"
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-1000 shadow-xs"
        >
          ดูรายละเอียด <ChevronRight size={15} aria-hidden="true" />
        </Link>
        <Gift size={120} strokeWidth={1} aria-hidden="true" className="absolute -bottom-4 -right-3 text-brand-600/15" />
      </div>

      <div className="relative overflow-hidden rounded-xl2 bg-[linear-gradient(115deg,#FDEBEF,#FFF6F8)] p-5 md:p-7">
        <p className="text-xl font-extrabold leading-tight text-brand-1000 md:text-2xl md:leading-8">ส่งฟรีทั่วไทย</p>
        <p className="mt-1.5 text-sm text-slate-600">ทุกออเดอร์ ไม่มีขั้นต่ำ · ถึงมือใน 1-3 วันทำการ</p>
        <Link
          href="/help/delivery"
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-1000 shadow-xs"
        >
          ดูเงื่อนไข <ChevronRight size={15} aria-hidden="true" />
        </Link>
        <Truck size={120} strokeWidth={1} aria-hidden="true" className="absolute -bottom-4 -right-3 text-[#E4476B]/15" />
      </div>
    </section>
  );
}
