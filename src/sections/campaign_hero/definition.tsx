import { z } from "zod";
import Link from "next/link";
import Countdown from "@/components/campaign/Countdown";
import { mediaAssetFor } from "@/lib/media-lookup";
import { srcSetFor } from "@/lib/media";
import { lText, thaiOf, tx } from "@/lib/i18n/localized";
import { getMessages } from "@/lib/i18n/messages";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The top of a campaign page: one picture, one sentence, one clock.
//
// Two pictures, in fact, because a banner drawn for a desktop is unreadable
// at 390px — the text in it is baked in, so there is no reflowing it. A
// campaign without a mobile banner still works; it just gets the desktop one,
// which is the lesser of the two wrongs available.
//
// The clock is the part worth getting right. What it counts towards depends
// on where the campaign is: before the sale, the hours until it starts; during
// it, the hours until it is over. Asking the admin to retype that date in two
// places is how the two end up disagreeing, so it is read from the campaign
// itself (ctx.times) and only a third option asks for a date.

const schema = z.object({
  image: z.string().default(""),
  imageMobile: z.string().default(""),
  alt: lText(140).default(""),
  heading: lText(120).default(""),
  subheading: lText(200).default(""),
  ctaLabel: lText(40).default(""),
  ctaHref: z.string().default(""),
  countdown: z.enum(["auto", "none", "custom"]).default("auto"),
  countdownTo: z.string().default(""),
  countdownLabel: lText(40).default(""),
});

type Settings = z.output<typeof schema>;
type Asset = Awaited<ReturnType<typeof mediaAssetFor>>;
type Data = { desktop?: Asset; mobile?: Asset };

async function load(settings: Settings): Promise<Data> {
  const [desktop, mobile] = await Promise.all([
    settings.image ? mediaAssetFor(settings.image) : null,
    settings.imageMobile ? mediaAssetFor(settings.imageMobile) : null,
  ]);
  return { desktop, mobile };
}

/** What the clock counts towards, and what to call it. Null means no clock:
 *  a campaign that is over has nothing left to count. */
function targetOf(settings: Settings, ctx: SectionProps<Settings>["ctx"]) {
  const words = getMessages(ctx.locale).countdown;
  if (settings.countdown === "none") return null;
  if (settings.countdown === "custom") {
    // tx() before the ||, or a translated label would be an object — and an
    // object wins every ||, so the clock would be handed {th, en} to print.
    const label = tx(settings.countdownLabel, ctx.locale) || words.timeLeft;
    return settings.countdownTo ? { to: settings.countdownTo, label } : null;
  }

  const times = ctx.times;
  if (!times) return null;
  if (ctx.phase === "teaser" && times.liveAt) return { to: times.liveAt, label: words.startsIn };
  if (ctx.phase === "live" && times.extendedAt) return { to: times.extendedAt, label: words.timeLeft };
  if ((ctx.phase === "live" || ctx.phase === "extended") && times.endsAt) {
    return { to: times.endsAt, label: words.timeLeft };
  }
  return null;
}

function Component({ settings, data, index, ctx }: SectionProps<Settings, Data>) {
  const target = targetOf(settings, ctx);
  // Read into words first: "is there anything to show" is a question about
  // text, and every one of these is an object once it carries a translation.
  const alt = tx(settings.alt, ctx.locale);
  const heading = tx(settings.heading, ctx.locale);
  const subheading = tx(settings.subheading, ctx.locale);
  const ctaLabel = tx(settings.ctaLabel, ctx.locale);

  const hasText = Boolean(heading || subheading || ctaLabel || target);
  if (!settings.image && !hasText) return null;

  const priority = index === 0;
  const cta = ctaLabel && settings.ctaHref;

  return (
    <section className="relative overflow-hidden">
      {settings.image && (
        <picture>
          {settings.imageMobile && (
            <source
              media="(max-width: 767px)"
              srcSet={srcSetFor(data?.mobile?.sources ?? undefined) ?? settings.imageMobile}
              sizes="100vw"
            />
          )}
          {/* A plain img, not next/image: the project runs with
              images.unoptimized, so next/image would add a host allowlist and
              resize nothing. The three widths come from the library and are
              offered to the browser directly. (No eslint-disable needed —
              the rule does not fire inside <picture>.) */}
          <img
            src={settings.image}
            srcSet={srcSetFor(data?.desktop?.sources ?? undefined)}
            sizes="100vw"
            alt={alt}
            // The first section on a campaign page is the largest image on
            // it, and the one the page is judged by.
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            // The picture's own shape, so the page does not jump when the
            // largest image on a campaign page arrives. The drawn size is
            // still h-auto w-full.
            width={data?.desktop?.width ?? undefined}
            height={data?.desktop?.height ?? undefined}
            className="h-auto w-full"
          />
        </picture>
      )}

      {hasText && (
        <div className={settings.image ? "container-page -mt-8 pb-8 md:-mt-14" : "container-page py-10 md:py-14"}>
          <div className="rounded-xl2 bg-white/95 p-5 shadow-sm backdrop-blur md:p-7">
            {heading && (
              <h1 className="text-xl font-bold leading-tight text-brand-ink md:text-3xl">{heading}</h1>
            )}
            {subheading && (
              <p className="mt-1.5 text-sm leading-relaxed text-grey-600 md:text-base">{subheading}</p>
            )}
            {(target || cta) && (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {target && (
                  <Countdown
                    to={target.to}
                    label={target.label}
                    words={getMessages(ctx.locale).countdown}
                    size="lg"
                  />
                )}
                {cta && (
                  <Link
                    href={settings.ctaHref}
                    className="inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold"
                    style={{ backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" }}
                  >
                    {ctaLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export const campaignHero: SectionDefinition<typeof schema> = {
  type: "campaign_hero",
  version: 1,
  label: "แบนเนอร์แคมเปญ",
  description: "แบนเนอร์ใหญ่ + ข้อความ + นับถอยหลังในตัว",
  category: "hero",
  schema,
  defaults: {
    image: "",
    imageMobile: "",
    alt: "",
    heading: "",
    subheading: "",
    ctaLabel: "ช้อปเลย",
    ctaHref: "/shop",
    countdown: "auto",
    countdownTo: "",
    countdownLabel: "",
  },
  fields: [
    { key: "image", type: "image", label: "แบนเนอร์ (คอมพิวเตอร์)" },
    { key: "imageMobile", type: "image", label: "แบนเนอร์ (มือถือ)", help: "ไม่ใส่ก็ได้ แต่ตัวหนังสือในรูปคอมจะเล็กมากบนมือถือ" },
    { key: "alt", type: "text", label: "คำบรรยายรูป", localized: true },
    { key: "heading", type: "text", label: "หัวข้อ", localized: true },
    { key: "subheading", type: "textarea", label: "ข้อความรอง", localized: true },
    { key: "ctaLabel", type: "text", label: "ข้อความบนปุ่ม", localized: true },
    { key: "ctaHref", type: "text", label: "ลิงก์ของปุ่ม" },
    {
      key: "countdown",
      type: "select",
      label: "นับถอยหลัง",
      options: [
        ["auto", "ตามช่วงของแคมเปญ (ก่อนงานนับถึงวันงาน / วันงานนับถึงวันจบ)"],
        ["custom", "กำหนดเวลาเอง"],
        ["none", "ไม่ต้องมี"],
      ],
    },
    { key: "countdownTo", type: "datetime", label: "นับถึงเวลา (เฉพาะแบบกำหนดเอง)" },
    { key: "countdownLabel", type: "text", label: "คำนำหน้าตัวเลข (เฉพาะแบบกำหนดเอง)", localized: true },
  ],
  enabledOn: ["campaign"],
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  // check() is handed the settings and no locale, which is right: publishing
  // asks whether the page is finished in the language it is written in, and
  // that language is Thai. thaiOf() is how it asks — "" for a field nobody
  // has filled in, whether it is a plain string or a pair.
  check: async (settings) => {
    const issues = [];
    if (!settings.image && !thaiOf(settings.heading)) {
      issues.push({ level: "error" as const, message: "แบนเนอร์แคมเปญยังไม่มีทั้งรูปและหัวข้อ" });
    }
    if (settings.image && !thaiOf(settings.alt)) {
      issues.push({ level: "warning" as const, message: "แบนเนอร์แคมเปญยังไม่มีคำบรรยายรูป" });
    }
    if (!settings.imageMobile && settings.image) {
      issues.push({ level: "warning" as const, message: "ยังไม่มีแบนเนอร์สำหรับมือถือ — คนส่วนใหญ่เข้าจากมือถือ" });
    }
    if (settings.countdown === "custom" && !settings.countdownTo) {
      issues.push({ level: "error" as const, message: "เลือกนับถอยหลังแบบกำหนดเอง แต่ยังไม่ได้ใส่เวลา" });
    }
    return issues;
  },
  Component,
};
