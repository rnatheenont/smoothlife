import Image from "next/image";
import { BadgeCheck, RotateCcw, Truck } from "lucide-react";
import SkyClouds from "@/components/SkyClouds";

// The banner at the top of the shop: what you are looking at, and the three
// promises that answer "why buy here" before the grid starts. The promises are
// the store's real policy (data/help.ts) — 1–3 business days, returns within
// 14 days, not the 7 the layout sketch showed.
const PROMISES = [
  { icon: BadgeCheck, title: "ของแท้", sub: "100%" },
  { icon: Truck, title: "จัดส่งเร็ว", sub: "1-3 วัน" },
  { icon: RotateCcw, title: "คืนสินค้าได้", sub: "ภายใน 14 วัน" },
];

export default function ShopHero({
  eyebrow = "PRODUCTS",
  title,
  subtitle,
  image,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  image?: string;
}) {
  return (
    // The same sky the home page opens with. The banner used to be a flat
    // mint wash, which said "a panel goes here" and nothing else; arriving on
    // /shop from the home page now lands under the same weather. isolate so
    // the clouds, which sit on a negative z, stay inside this box rather than
    // sliding behind the page.
    // Full-bleed: the sky is weather, and weather does not stop at a
    // 1280px card with rounded corners. The content inside still lines up
    // with the rest of the page, because the container is on the inner row.
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#cfe9f8_0%,#e4f3fb_52%,#f7fcfe_100%)]">
      <SkyClouds />
      <div className="container-page relative flex items-center gap-4 py-7 md:py-10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.3em] text-brand-800">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-brand-1000 md:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600 md:text-base">{subtitle}</p>
        </div>

        {image && (
          <span className="relative hidden h-32 w-48 shrink-0 md:block lg:h-40 lg:w-64">
            <Image src={image} alt="" fill sizes="256px" className="object-contain mix-blend-multiply" />
          </span>
        )}

        <ul className="hidden shrink-0 gap-2 rounded-2xl bg-white/80 p-4 shadow-xs backdrop-blur-md sm:flex">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex w-24 flex-col items-center gap-1.5 px-1 text-center lg:w-28">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                <p.icon size={26} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="text-xs font-bold leading-tight text-brand-1000 lg:text-[13px]">{p.title}</span>
              <span className="text-[11px] leading-tight text-slate-500">{p.sub}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
