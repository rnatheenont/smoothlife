import Link from "next/link";
import { Repeat, ArrowRight, Truck, CalendarClock, XCircle } from "lucide-react";
import { subscriptionPlans } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { BorderBeam } from "@/components/magicui/border-beam";

// The one bold block on the home page: subscribe, in deep brand green.
//
// The order is settled and deliberate — pitch, then the three terms, then a
// single way in underneath. It is the order every tuned paywall uses
// (Brilliant, Lifesum, Satispay), and it exists because the button used to sit
// above the plans: the page asked for the click before it had shown the offer.
// The terms are links carrying the chosen term to /subscription?plan=N, so
// nobody picks twice.
//
// Centred rather than two columns. The right half held a cluster of product
// shots, which sounded better than it looked: the catalogue's images are a mix
// of clean packshots and marketplace promo banners, so the row came out as
// four unrelated rectangles. One column of type above the three cards is the
// same composition the references use, and it cannot come out wrong.
//
// The colour went deep rather than staying on the flat 90° teal→cyan wash. On
// that wash every light element was a tint of its background and nothing could
// lead; against a dark field the recommended plan is simply the brightest
// object in the block. The depth is four layers — a diagonal base, two corner
// blooms, a wide pool of light under the cards, a dot grid at 7% — because one
// flat gradient is what this looked like before.
//
// Everything below 12px is gone and the dark cards are a fixed colour rather
// than black over a gradient: on the old wash, white on the 12-month card
// measured about 3.4:1, under AA for the 10px label it carried.

/** What ฿1,000 of shopping comes to on each term. A worked example rather than
 *  a real basket — the discount applies to whatever is in the order — labelled
 *  as one under the row so it cannot be read as a price. Percent is the
 *  discount; baht is the decision, so the baht is set against a struck-through
 *  original rather than left for the reader to work out. */
const EXAMPLE_BASE = 1000;

const PROMISES = [
  { icon: Truck, label: "ส่งฟรีทุกรอบ" },
  { icon: CalendarClock, label: "ไม่มีต่อเทอมอัตโนมัติ" },
  { icon: XCircle, label: "ยกเลิกได้ทุกเมื่อ" },
];

export default function SubscriptionBanner() {
  const maxDiscount = Math.max(...subscriptionPlans.map((p) => p.discountPct));

  return (
    <div className="relative isolate overflow-hidden rounded-feature bg-[linear-gradient(135deg,#0a8d72_0%,#02a384_48%,#15c2a4_100%)] px-5 py-10 text-white ring-1 ring-inset ring-white/10 md:px-12 md:py-14">
      {/* Depth, in layers that hold still. The two circles that used to drift
          across this block were decoration animating for no one's benefit. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 -top-32 h-[26rem] w-[26rem] rounded-full bg-brand-emerald/60 blur-[90px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-44 -right-24 h-[26rem] w-[26rem] rounded-full bg-brand-sky/50 blur-[90px]"
      />
      {/* A third light source, low and wide, so the cards sit in a pool of
          light. The corner blooms alone left the middle of the block — where
          the decision happens — its darkest part. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[36%] left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-brand-teal/60 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.09] [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:22px_22px]"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#04322c]/60 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
          <Repeat size={13} aria-hidden="true" /> สมัครสมาชิกรายรอบ ไม่ต้องสั่งซ้ำ
        </span>
        <h2 className="mt-5 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] md:text-[50px] md:leading-[1.08]">
          เลือกรอบส่ง<span className="whitespace-nowrap">ของคุณเอง</span>
          <br />
          ยิ่งนานยิ่งประหยัด
        </h2>
        <p className="mx-auto mt-5 max-w-xl rounded-xl2 bg-[#04322c]/55 px-5 py-3 text-[15px] leading-relaxed text-white ring-1 ring-white/15 backdrop-blur-sm">
          สินค้าสุขภาพและความงามที่คุณใช้ประจำ มาเองตามรอบที่เลือก
          ส่วนลดล็อกไว้ทั้งเทอม สูงสุด {maxDiscount}%
        </p>
      </div>

      {/* The three terms. The recommended one stands brighter and taller, so
          the shape of the row says which one before any of it is read. */}
      <ul className="relative mx-auto mt-9 grid max-w-3xl grid-cols-3 items-end gap-2.5 md:mt-12 md:gap-4">
        {subscriptionPlans.map((plan) => {
          const after = Math.round(EXAMPLE_BASE * (1 - plan.discountPct / 100));
          return (
            <li key={plan.months} className="relative flex">
              {plan.popular && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-4 rounded-feature bg-brand-emerald/45 blur-2xl"
                />
              )}
              <Link
                href={`/subscription?plan=${plan.months}`}
                aria-label={`สมัครรอบ ${plan.months} เดือน ลด ${plan.discountPct}% จาก ${formatTHB(EXAMPLE_BASE)} เหลือ ${formatTHB(after)}`}
                className={`group relative flex w-full flex-col items-center overflow-hidden rounded-xl2 px-2 pt-3 text-center transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-1000 md:px-4 md:pt-5 ${
                  plan.popular
                    ? "bg-white pb-5 text-brand-ink shadow-[0_24px_55px_-18px_rgba(0,0,0,0.65)] hover:-translate-y-1 md:pb-9"
                    : "bg-[#04322c]/62 pb-4 text-white ring-1 ring-white/15 backdrop-blur-sm hover:-translate-y-1 hover:ring-white/35 md:pb-7"
                }`}
              >
                {/* Inside the card, not straddling its edge: the badge used to
                    be clipped by the card it was announcing, and left the
                    three of them different heights. */}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    plan.popular ? "bg-brand-800 text-white" : "invisible"
                  }`}
                >
                  ยอดนิยม
                </span>

                <p
                  className={`mt-2 text-xs font-semibold md:text-sm ${
                    plan.popular ? "text-slate-500" : "text-white/80"
                  }`}
                >
                  ทุก {plan.months} เดือน
                </p>

                {/* The figure carries the card: "%" set small and raised so it
                    reads as one object rather than as a word. */}
                <p
                  className={`mt-1 flex items-start justify-center font-extrabold leading-none tracking-[-0.03em] ${
                    plan.popular ? "text-brand-800" : "text-white"
                  }`}
                >
                  <span className="mt-1 text-lg md:mt-2 md:text-2xl">-</span>
                  <span className="text-[34px] md:text-[60px]">{plan.discountPct}</span>
                  <span className="mt-1 text-lg md:mt-2.5 md:text-2xl">%</span>
                </p>

                <p className="mt-2.5 flex flex-col items-center gap-0 md:mt-4 md:flex-row md:gap-1.5">
                  <span
                    className={`text-xs line-through md:text-sm ${
                      plan.popular ? "text-slate-400" : "text-white/70"
                    }`}
                  >
                    {formatTHB(EXAMPLE_BASE)}
                  </span>
                  <span
                    className={`text-sm font-bold md:text-lg ${
                      plan.popular ? "text-brand-ink" : "text-white"
                    }`}
                  >
                    {formatTHB(after)}
                  </span>
                </p>

                {plan.popular && (
                  // One moment of motion, on the card being recommended and
                  // nothing else — and not at all for a reader who has asked
                  // for less of it.
                  <BorderBeam
                    size={110}
                    duration={7}
                    colorFrom="#00A87B"
                    colorTo="#00AEEF"
                    borderWidth={2}
                    className="motion-reduce:hidden"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="relative mt-3.5 text-center">
        <span className="inline-block rounded-full bg-[#04322c]/55 px-3.5 py-1 text-xs text-white ring-1 ring-white/15 backdrop-blur-sm">
          ตัวอย่างจากยอดสั่งซื้อ {formatTHB(EXAMPLE_BASE)} ต่อรอบ
        </span>
      </p>

      {/* One way in, under everything it was asking about. */}
      <div className="relative mt-8 flex flex-col items-center gap-5 md:mt-11">
        <Link
          href="/subscription"
          className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-brand-800 shadow-[0_16px_34px_-12px_rgba(0,0,0,0.65)] transition-colors hover:bg-brand-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-1000 sm:w-auto"
        >
          ดูแผนสมัครสมาชิก
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
        {/* The three things somebody weighing a recurring charge wants to know
            before they click, rather than after. */}
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl2 bg-[#04322c]/60 px-5 py-2.5 text-xs text-white ring-1 ring-white/15 backdrop-blur-sm">
          {PROMISES.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <Icon size={14} aria-hidden="true" className="text-brand-200" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
