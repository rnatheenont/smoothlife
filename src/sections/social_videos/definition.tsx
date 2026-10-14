import { z } from "zod";
import TrendingOnSocial, { type SocialClip } from "@/components/TrendingOnSocial";
import { products } from "@/data/products";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The product clips that run across "กระแสฮอตบนโซเชียล".
//
// These were two parallel arrays in app/page.tsx — one of video URLs, one of
// product slugs — which had to stay the same length and in the same order or
// a clip ended up labelled with someone else's product. They are one list of
// pairs now, which is the shape the data always was.

const schema = z.object({
  clips: z
    .array(
      z.object({
        video: z.string().url(),
        /** The product the clip is about. Optional: a brand clip that sells
         *  nothing in particular is still worth showing. */
        productSlug: z.string().optional(),
      })
    )
    .min(1)
    .max(12),
  /** Which clip the carousel opens on. The home page starts on the fourth
   *  rather than the first, so the one worth seeing is the one in the middle
   *  of the rail where the eye lands. */
  startAt: z.number().int().min(0).max(11).default(0),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const clips: SocialClip[] = settings.clips.map((c) => ({
    video: c.video,
    // A product deleted from the catalogue leaves the clip playing without a
    // card attached, rather than taking the section down with it.
    product: c.productSlug ? products.find((p) => p.slug === c.productSlug) : undefined,
  }));
  // A startAt past the end of a shortened list would open on nothing.
  const startAt = Math.min(settings.startAt, Math.max(0, clips.length - 1));
  return <TrendingOnSocial clips={clips} initialIndex={startAt} />;
}

export const socialVideos: SectionDefinition<typeof schema> = {
  type: "social_videos",
  version: 1,
  label: "คลิปสินค้าจากโซเชียล",
  description: "คาโรเซลวิดีโอสินค้า เลื่อนดูได้ แตะเพื่อเปิดสินค้าในคลิป",
  category: "content",
  schema,
  defaults: {
    startAt: 3,
    clips: [
      {
        video: "https://cdn6.fireworktv.com/medias/2025/11/27/1764238313-wfckresm/transcoded/720/KRU20AOM20Formalab.mp4",
        productSlug: "dentiste-anticavity-max-fluoride-toothpaste",
      },
      {
        video: "https://cdn4.fireworktv.com/medias/2025/10/16/1760607737-gyoksnwq/transcoded/720/ASTA20Whi2030ml.mp4",
        productSlug: "smooth-e-sun-asta-white-spot-clear",
      },
      {
        video: "https://cdn4.fireworktv.com/medias/2025/10/16/1760608144-edpsbonv/transcoded/720/Serum2030ml.mp4",
        productSlug: "sme-retinal-plus-deep-wrinkle-repair-30-g",
      },
      {
        video: "https://cdn1.fireworktv.com/medias/2025/10/24/1761300428-djtmelvp/transcoded/720/chaladgin.mp4",
        productSlug: "dentiste-repaire-rex3-70g",
      },
      {
        video: "https://cdn1.fireworktv.com/medias/2025/10/17/1760681861-jxlvtwfn/transcoded/720/Hair20W201.mp4",
        productSlug: "smooth-e-anti-hair-loss-hair-thickening-shampoo",
      },
      {
        video: "https://cdn7.fireworktv.com/medias/2025/10/16/1760608081-pwsygcbo/transcoded/720/Foam20Hya201.mp4",
        productSlug: "smooth-e-babyface-hydration-foam",
      },
      {
        video: "https://cdn3.fireworktv.com/medias/2025/10/16/1760608006-pzikfjsq/watermarked/720/Foam20AHA.mp4",
        productSlug: "smooth-e-white-babyface-spot-clear",
      },
    ],
  },
  fields: [
    {
      key: "clips",
      type: "json",
      label: "คลิป",
      help: "ลิงก์วิดีโอและสินค้าในคลิป — ฟอร์มจริงมาในเฟสถัดไป",
    },
    { key: "startAt", type: "number", label: "เปิดที่คลิปลำดับ (เริ่มจาก 0)", min: 0, max: 11 },
  ],
  enabledOn: ["home", "page", "campaign", "brand", "system", "template"],
  maxPerPage: 1,
  Component,
};
