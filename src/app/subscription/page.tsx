import { Repeat, Truck, ShieldCheck, CalendarClock } from "lucide-react";
import { subscriptionPlans, subscriptionProducts } from "@/data/subscriptions";
import SubscriptionPicker from "@/components/SubscriptionPicker";

export const metadata = { title: "Subscription สมัครสมาชิกรายรอบ | Smoothlife.com" };

const perks = [
  { icon: Truck, label: "ส่งฟรีทุกรอบ" },
  { icon: CalendarClock, label: "เลือกรอบส่ง 3 / 6 / 9 เดือน" },
  { icon: ShieldCheck, label: "ของแท้ 100% มีอย." },
];

export default function SubscriptionPage() {
  const maxDiscount = Math.max(...subscriptionPlans.map((p) => p.discountPct));

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-ink text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-teal/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-sky/25 blur-3xl" />
        <div className="container-page relative py-12 md:py-20 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold mb-4">
            <Repeat size={13} /> Smoothlife Subscription
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            ดูแลตัวเองต่อเนื่อง <br className="hidden md:block" />
            ไม่ต้องสั่งซ้ำ ประหยัดสูงสุด {maxDiscount}%
          </h1>
          <p className="mt-4 text-white/80 max-w-lg mx-auto">
            เลือกสินค้าที่ใช้ประจำ กำหนดรอบส่งของคุณเอง 3 / 6 หรือ 9 เดือน ยิ่งเลือกรอบยาว ยิ่งได้ส่วนลดมากขึ้น
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 md:gap-6 text-xs md:text-sm text-white/85">
            {perks.map((perk) => (
              <span key={perk.label} className="flex items-center gap-1.5">
                <perk.icon size={14} /> {perk.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-10 md:py-14">
        <SubscriptionPicker plans={subscriptionPlans} products={subscriptionProducts} />
      </section>
    </div>
  );
}
