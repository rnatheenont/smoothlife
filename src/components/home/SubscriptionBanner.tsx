import Link from "next/link";
import { Repeat, ArrowRight } from "lucide-react";
import { subscriptionPlans } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { BorderBeam } from "@/components/magicui/border-beam";

// The one bold block on the home page: subscribe, in brand green end to end.
//
// What it used to do, and why none of it is here any more:
//
//  * The button sat above the plans, so the page asked for the click before it
//    had shown the offer. Reading order was badge → headline → copy → button →
//    the three numbers that are the actual argument. The plans come first now
//    and there is one action underneath them, the way every paywall that has
//    been tuned for this does it (Brilliant, Lifesum, Satispay).
//
//  * The three plans looked like controls — card, badge, hover-sized — and
//    were inert divs. Clicking the plan a shopper had just decided on did
//    nothing. They are links now, and they carry the choice through to
//    /subscription?plan=N instead of making someone pick twice.
//
//  * "-20%" with no money attached. Percent is the discount; baht is the
//    decision. Each plan says what ฿1,000 of shopping comes to, which is the
//    one number somebody can hold in their head.
//
//  * The unselected plans were black/15 laid over a gradient that ends in
//    #00AEEF, so their contrast depended on where they happened to land:
//    white on that tile measured about 3.4:1, under AA for the 10px label it
//    was used for. They are a fixed dark green now (about 9:1) and nothing
//    below 12px carries meaning.
//
//  * Mobile and desktop were two separate copies of the plan list. One list.

// What ฿1,000 of shopping comes to on each plan. A worked example rather than
// a real basket, because the discount applies to whatever is in the order —
// labelled as an example under the row so it is not read as a price.
const EXAMPLE_BASE = 1000;

export default function SubscriptionBanner() {
  const maxDiscount = Math.max(...subscriptionPlans.map((p) => p.discountPct));

  return (
    <div className="relative overflow-hidden rounded-feature bg-brand-gradient p-6 text-white md:p-12">
      <div className="grid items-center gap-8 md:grid-cols-[1.05fr_1fr] md:gap-12">
        <div>
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-1000/45 px-3 py-1 text-xs font-semibold">
            <Repeat size={13} aria-hidden="true" /> สมัครสมาชิกรายรอบ ไม่ต้องสั่งซ้ำ
          </span>
          <h2 className="text-2xl font-extrabold leading-tight md:text-4xl md:leading-10">
            เลือกรอบส่ง<span className="whitespace-nowrap">ของคุณเอง</span>{" "}
            <br className="hidden md:block" />
            ยิ่งนานยิ่งประหยัด
          </h2>
          <p className="mt-3 max-w-md text-white">
            สินค้าสุขภาพและความงามที่คุณใช้ประจำ มาเองตามรอบที่เลือก
            ส่วนลดล็อกไว้ทั้งเทอม สูงสุด {maxDiscount}%
          </p>
        </div>

        {/* Three plans, three links. The whole tile is the target rather than
            a word inside it, so the smallest one is still far past the 44px
            a thumb needs. */}
        <div>
          <ul className="grid grid-cols-3 gap-2 md:gap-3">
            {subscriptionPlans.map((plan) => {
              const after = Math.round(EXAMPLE_BASE * (1 - plan.discountPct / 100));
              return (
                <li key={plan.months}>
                  <Link
                    href={`/subscription?plan=${plan.months}`}
                    aria-label={`สมัครรอบ ${plan.months} เดือน ลด ${plan.discountPct}% จ่าย ${formatTHB(after)} จากของ ${formatTHB(EXAMPLE_BASE)}`}
                    className={`relative flex h-full flex-col items-center justify-end gap-0.5 overflow-hidden rounded-xl2 px-2 py-3 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-teal md:px-3 md:py-5 ${
                      plan.popular
                        ? "bg-white text-brand-ink"
                        : "bg-brand-1000/55 text-white"
                    }`}
                  >
                    {/* Inside the tile, not straddling its edge: the badge
                        used to be clipped by the card it was announcing and
                        left the three tiles different heights. */}
                    <span
                      className={`mb-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        plan.popular
                          ? "bg-brand-gradient text-white"
                          : "invisible"
                      }`}
                    >
                      ยอดนิยม
                    </span>
                    <p className="text-xs font-bold md:text-sm">{plan.months} เดือน</p>
                    <span
                      className={`text-xl font-extrabold leading-none md:text-3xl ${
                        plan.popular ? "text-brand-800" : "text-white"
                      }`}
                    >
                      -{plan.discountPct}%
                    </span>
                    <span
                      className={`text-xs md:text-sm ${
                        plan.popular ? "text-slate-600" : "text-white/90"
                      }`}
                    >
                      เหลือ {formatTHB(after)}
                    </span>
                    {plan.popular && (
                      // One quiet moment of motion, on the plan being
                      // recommended and nothing else. Hidden when the reader
                      // has asked for less of it.
                      <BorderBeam
                        size={90}
                        duration={6}
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
          <p className="mt-2 text-center text-xs text-white/90">
            ตัวอย่างจากของ {formatTHB(EXAMPLE_BASE)} ต่อรอบ
          </p>
        </div>
      </div>

      {/* One action, under both columns, so the order reads the same on a
          phone and on a desktop: what it is, what it saves, then the way in. */}
      <div className="mt-8 flex flex-col items-center gap-3 border-t border-white/20 pt-6 sm:flex-row sm:justify-between md:mt-10">
        <Link
          href="/subscription"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-brand-800 transition-colors hover:bg-brand-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-teal sm:w-auto"
        >
          ดูแผนสมัครสมาชิก <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <p className="text-center text-xs text-white sm:text-right">
          ส่งฟรีทุกรอบ · ยกเลิกได้ทุกเมื่อ · ไม่มีต่อเทอมอัตโนมัติ
        </p>
      </div>
    </div>
  );
}
