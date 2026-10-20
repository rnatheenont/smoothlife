import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import { subscriptionPlans, subscriptionSets } from "@/data/subscriptions";
import { subscriptionSetProducts } from "@/lib/subscription-catalogue";
import { formatTHB } from "@/lib/format";
import { getSellableSets } from "@/lib/subscription-sets";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The sets the shop assembled, as cards.
//
// Two lists, and they are two different things rather than a tidy-up waiting
// to happen: the first is the sets built in the admin console, read per
// request so a set whose stock ran out stops being offered the same day; the
// second is the sets written into the catalogue in code. Both price off
// today's real prices rather than carrying a SKU of their own.
//
// Locked, because what a set contains and what it costs is not page copy.
// The heading above it is.

const schema = z.object({
  heading: z.string().max(120).default(""),
  intro: z.string().max(300).default(""),
});

type Card = {
  key: string;
  href: string;
  name: string;
  description: string;
  images: string[];
  perCycle: number;
  struck: number | null;
  savingPercent: number;
  /**
   * Which of the two lists this came from, because the two cards are not
   * quite the same card: the coded ones carry a hairline border, animate
   * their pictures on hover, and print the price as plain bold text, while
   * the admin ones can show a struck-through "separately" price beside it.
   * Reproduced rather than unified — unifying them is a change to the page.
   */
  kind: "curated" | "coded";
};

async function load(): Promise<Card[]> {
  const cheapest = subscriptionPlans[0];
  const curated = (await getSellableSets()).map((set) => ({
    key: `curated-${set.id}`,
    href: `/subscription/set/${set.id}`,
    name: set.name,
    description: set.description || `${set.summary.items.length} รายการในชุด · ส่งทุก ${set.interval_days} วัน`,
    images: set.summary.items.map((i) => i.image).filter((src): src is string => Boolean(src)),
    perCycle: Math.round(set.summary.bundle * (1 - cheapest.discountPct / 100)),
    struck: set.summary.saving > 0 ? set.summary.separately : null,
    savingPercent: set.summary.savingPercent,
    kind: "curated" as const,
  }));

  const coded = subscriptionSets.map((set) => {
    const items = subscriptionSetProducts(set);
    const total = items.reduce((sum, p) => sum + p.price, 0);
    return {
      key: `coded-${set.slug}`,
      href: `/subscription/${set.slug}`,
      name: set.name,
      description: set.tagline,
      images: items.map((p) => p.image),
      perCycle: Math.round(total * (1 - cheapest.discountPct / 100)),
      struck: null,
      savingPercent: 0,
      kind: "coded" as const,
    };
  });

  return [...curated, ...coded];
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Card[]>) {
  const cards = data ?? [];

  return (
    <section id="subscription-sets" className="container-page scroll-mt-24 py-10 md:py-14">
      {settings.heading && (
        <h2 className="mb-1 text-xl font-extrabold text-brand-ink md:text-2xl">{settings.heading}</h2>
      )}
      {settings.intro && <p className="mb-6 text-sm text-slate-500">{settings.intro}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
        {cards.map((set) => (
          <Link
            key={set.key}
            href={set.href}
            className={`group flex flex-col overflow-hidden rounded-xl2 bg-white shadow-card transition-shadow hover:shadow-cardHover ${
              set.kind === "coded" ? "border border-slate-100" : ""
            }`}
          >
            <div className="relative grid aspect-4/3 grid-cols-3 gap-px bg-surface-soft p-px">
              {set.images.slice(0, 3).map((src, i) => (
                <div key={`${set.key}-${i}`} className="relative bg-white">
                  <Image
                    src={src}
                    alt=""
                    fill
                    className={
                      set.kind === "coded" ? "object-cover transition-transform duration-500" : "object-cover"
                    }
                    sizes="200px"
                  />
                </div>
              ))}
              {set.savingPercent > 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-sale px-2 py-0.5 text-[11px] font-bold text-white">
                  ประหยัด {set.savingPercent}%
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <h3 className="font-bold text-brand-ink">{set.name}</h3>
              <p className="line-clamp-2 flex-1 text-xs text-slate-500">{set.description}</p>
              <div className="mt-1 flex items-end justify-between">
                <div>
                  <span className="text-[11px] text-slate-500">เริ่มต้น/รอบ</span>
                  {set.kind === "coded" ? (
                    <p className="text-lg font-extrabold text-brand-800">{formatTHB(set.perCycle)}</p>
                  ) : (
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-lg font-extrabold text-brand-800">{formatTHB(set.perCycle)}</span>
                      {set.struck !== null && (
                        <span className="text-xs text-slate-500 line-through">{formatTHB(set.struck)}</span>
                      )}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-0.5 text-xs font-semibold text-brand-800">
                  ดูรายละเอียด <ChevronRight size={13} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export const subscriptionSetsSection: SectionDefinition<typeof schema> = {
  type: "subscription_sets",
  version: 1,
  label: "ชุดสมัครสมาชิก",
  description: "การ์ดชุดสินค้าที่สมัครรายรอบได้ — ชุดจากหลังบ้านและชุดในโค้ด",
  category: "product",
  schema,
  defaults: {
    heading: "เลือกชุดสมัครสมาชิก",
    intro: "ชุดสินค้าที่ทีมคัดมาให้ครบ ไม่ต้องเลือกเอง ใช้ต่อเนื่องได้จริง",
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    { key: "intro", type: "textarea", label: "คำโปรย" },
  ],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
