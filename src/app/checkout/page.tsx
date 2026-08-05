"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Banknote, QrCode, Truck, Ticket, Award } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useOrderTotals } from "@/lib/use-order-totals";
import { formatTHB } from "@/lib/format";
import AddressForm, {
  ShippingAddress,
  emptyAddress,
  validate,
  formatAddress,
} from "@/components/AddressForm";

const paymentMethods = [
  { id: "promptpay", label: "PromptPay QR", icon: QrCode },
  { id: "card", label: "บัตรเครดิต/เดบิต", icon: CreditCard },
  { id: "transfer", label: "โอนเงินผ่านธนาคาร", icon: Banknote },
  { id: "cod", label: "เก็บเงินปลายทาง (COD)", icon: Truck },
];

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart();
  const { user, addOrder } = useAuth();
  const { lang, t } = useLang();
  const totals = useOrderTotals();
  const router = useRouter();
  const [addr, setAddr] = useState<ShippingAddress>(emptyAddress);
  useEffect(() => {
    if (user?.name) setAddr((a) => (a.name ? a : { ...a, name: user.name }));
  }, [user]);
  const [touched, setTouched] = useState<Partial<Record<keyof ShippingAddress, boolean>>>({});
  const errors = validate(addr);
  const [payment, setPayment] = useState("promptpay");
  const [submitting, setSubmitting] = useState(false);
  const shippingFree = totals.freeShipping;
  const shipping = totals.shipping;
  const total = totals.total;

  if (!user) {
    return (
      <div className="container-page py-20 text-center max-w-md mx-auto">
        <h1 className="text-xl font-bold text-brand-ink">เข้าสู่ระบบเพื่อดำเนินการชำระเงิน</h1>
        <p className="text-sm text-slate-500 mt-2">เข้าสู่ระบบด้วย OTP, LINE หรือ Email เพื่อรับคะแนนสะสมทุกออเดอร์</p>
        <Link href="/account/login?returnTo=/checkout" className="inline-block mt-6 rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm">
          เข้าสู่ระบบ / สมัครสมาชิก
        </Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-slate-500">ตะกร้าของคุณว่างเปล่า</p>
        <Link href="/shop" className="inline-block mt-4 text-brand-emerald font-semibold">เริ่มช้อป</Link>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Object.keys(errors).length > 0) {
      setTouched({
        name: true,
        phone: true,
        line1: true,
        subdistrict: true,
        district: true,
        province: true,
        postcode: true,
      });
      document.querySelector("[data-address-card]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSubmitting(true);
    const order = addOrder({
      items: lines.map((l) => ({ slug: l.slug, name: l.name, qty: l.qty, price: l.price, image: l.image })),
      total,
      address: formatAddress(addr) + " โทร. " + addr.phone,
      paymentMethod: paymentMethods.find((p) => p.id === payment)?.label || payment,
      coupon: totals.coupon?.code,
      discount: totals.discount,
      pointsEarned: totals.points,
    });
    clear();
    setTimeout(() => {
      router.push(`/checkout/success?order=${order.id}`);
    }, 600);
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-6">ดำเนินการชำระเงิน</h1>
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div data-address-card className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-4">ที่อยู่จัดส่ง</h2>
            <AddressForm
              value={addr}
              onChange={setAddr}
              errors={errors}
              touched={touched}
              onBlurField={(f) => setTouched((prev) => ({ ...prev, [f]: true }))}
            />
          </div>

          <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-4">วิธีการชำระเงิน</h2>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPayment(m.id)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    payment === m.id ? "border-brand-teal bg-brand-gradient-soft text-brand-ink" : "border-slate-200 text-slate-600"
                  }`}
                >
                  <m.icon size={16} /> {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl2 border border-slate-100 p-5 h-fit shadow-card sticky top-24">
          <h2 className="font-bold text-brand-ink mb-4">สรุปคำสั่งซื้อ</h2>
          <div className="flex flex-col gap-2 mb-4 max-h-56 overflow-y-auto">
            {lines.map((l) => (
              <div key={l.slug} className="flex justify-between text-xs text-slate-600">
                <span className="line-clamp-1 pr-2">{l.name} x{l.qty}</span>
                <span className="shrink-0">{formatTHB(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>ยอดรวมสินค้า</span>
            <span>{formatTHB(subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-brand-emerald mb-2">
              <span className="flex items-center gap-1.5">
                <Ticket size={13} /> {totals.coupon?.code}
              </span>
              <span>-{formatTHB(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-slate-600 mb-4">
            <span>ค่าจัดส่ง</span>
            <span>{shippingFree ? "ฟรี" : formatTHB(shipping)}</span>
          </div>
          <div className="flex justify-between font-bold text-brand-ink border-t border-slate-100 pt-4 mb-5">
            <span>ยอดรวมทั้งหมด</span>
            <span>{formatTHB(total)}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? "กำลังดำเนินการ..." : `ยืนยันคำสั่งซื้อ ${formatTHB(total)}`}
          </button>
          <p className="text-[11px] text-slate-500 mt-3 text-center flex items-center justify-center gap-1.5">
            <Award size={12} className="text-amber-500" />
            {lang === "en"
              ? `You'll earn ${totals.points.toLocaleString()} points from this order`
              : `คุณจะได้รับ ${totals.points.toLocaleString()} คะแนนจากคำสั่งซื้อนี้`}
          </p>
        </div>
      </form>
    </div>
  );
}
