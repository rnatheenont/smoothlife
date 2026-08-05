import Link from "next/link";
import { Truck, CreditCard, MessageCircle, ChevronRight } from "lucide-react";
import Faq from "@/components/Faq";

export const metadata = { title: "ศูนย์ช่วยเหลือ | Smoothlife.com" };

const topics = [
  { href: "/help/delivery", label: "การจัดส่งและคืนสินค้า", icon: Truck },
  { href: "/help/payment", label: "การชำระเงิน", icon: CreditCard },
  { href: "/help/contact", label: "แชทและติดต่อเรา", icon: MessageCircle },
];

const faqs = [
  { q: "สั่งซื้อสินค้าอย่างไร?", a: "เลือกสินค้าที่ต้องการ กดเพิ่มลงตะกร้า แล้วดำเนินการชำระเงินผ่านหน้าตะกร้าสินค้า" },
  { q: "ใช้เวลาจัดส่งกี่วัน?", a: "โดยทั่วไปจัดส่งภายใน 1-3 วันทำการทั่วประเทศไทย" },
  { q: "สินค้าของแท้หรือไม่?", a: "สินค้าทุกชิ้นนำเข้าและจัดจำหน่ายโดยตรง 100% พร้อมการรับรองจาก อย." },
  { q: "เข้าสู่ระบบด้วยวิธีไหนได้บ้าง?", a: "รองรับการเข้าสู่ระบบผ่าน OTP เบอร์โทรศัพท์, LINE Login และอีเมล" },
  { q: "สะสมคะแนนได้อย่างไร?", a: "ทุกการสั่งซื้อที่เข้าสู่ระบบแล้วจะได้รับคะแนนสะสมโดยอัตโนมัติ ดูรายละเอียดได้ที่หน้าคะแนนสะสม" },
];

export default function HelpPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">ศูนย์ช่วยเหลือ</h1>
      <p className="text-sm text-slate-500 mb-8">เรามีคำตอบให้ทุกคำถามของคุณ</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {topics.map((t) => (
          <Link key={t.href} href={t.href} className="flex items-center gap-3 rounded-xl2 border border-slate-100 p-5 shadow-card hover:border-brand-teal transition-colors">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald shrink-0">
              <t.icon size={18} />
            </div>
            <span className="flex-1 text-sm font-medium text-brand-ink">{t.label}</span>
            <ChevronRight size={16} className="text-slate-300" />
          </Link>
        ))}
      </div>

      <h2 className="font-bold text-brand-ink mb-4">คำถามที่พบบ่อย</h2>
      <Faq items={faqs} />
    </div>
  );
}
