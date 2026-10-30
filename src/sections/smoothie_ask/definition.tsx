import { z } from "zod";
import SmoothieHeroBand, { type HeroThemeSetting } from "@/components/home/SmoothieHeroBand";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The band at the very top of the home page: ask Smoothie a question, or send
// it a photo of your skin.
//
// The words are not settings: the component holds its own copy and reads its
// suggested questions from /api/chat-suggestions, which the team already
// edits in the AI knowledge base — moving that text in here would give them a
// second place to edit the same words.
//
// The sky is a setting, because a season has a date on it. "auto" follows
// Smoothie's outfit (/admin/mascot, which itself follows the calendar), so
// the band and the mascot change together and nobody has to undo October on
// the first of November. Picking one sky by hand still pins it.

const schema = z.object({
  theme: z.enum(["auto", "sky", "halloween", "christmas", "newyear"]).default("auto"),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  return <SmoothieHeroBand theme={settings.theme as HeroThemeSetting} />;
}

export const smoothieAsk: SectionDefinition<typeof schema> = {
  type: "smoothie_ask",
  version: 1,
  label: "ถามน้อง Smoothie",
  description: "ช่องถาม AI พร้อมคำถามแนะนำ — เลือกธีมพื้นหลังได้ ข้อความและคำถามแก้ที่ฐานความรู้ AI",
  category: "hero",
  schema,
  defaults: { theme: "auto" },
  fields: [
    {
      key: "theme",
      type: "select",
      label: "ธีมพื้นหลัง",
      options: [
        ["auto", "ตามชุดน้อง Smoothie (แนะนำ)"],
        ["sky", "ท้องฟ้า (ปกติ)"],
        ["halloween", "ฮาโลวีน"],
        ["christmas", "คริสต์มาส"],
        ["newyear", "ปีใหม่"],
      ],
    },
  ],
  enabledOn: ["home"],
  maxPerPage: 1,
  Component,
};
