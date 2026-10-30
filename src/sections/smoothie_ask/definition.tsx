import { z } from "zod";
import SmoothieHeroBand, { type HeroTheme } from "@/components/home/SmoothieHeroBand";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The band at the very top of the home page: ask Smoothie a question, or send
// it a photo of your skin.
//
// The words are not settings: the component holds its own copy and reads its
// suggested questions from /api/chat-suggestions, which the team already
// edits in the AI knowledge base — moving that text in here would give them a
// second place to edit the same words.
//
// The sky is a setting, because a season has a date on it. Switching back is
// the same two clicks as switching on, which is the part that matters: the
// first of November is a morning when somebody has to be able to undo
// October without waiting for a developer.

const schema = z.object({
  theme: z.enum(["sky", "halloween"]).default("sky"),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  return <SmoothieHeroBand theme={settings.theme as HeroTheme} />;
}

export const smoothieAsk: SectionDefinition<typeof schema> = {
  type: "smoothie_ask",
  version: 1,
  label: "ถามน้อง Smoothie",
  description: "ช่องถาม AI พร้อมคำถามแนะนำ — เลือกธีมพื้นหลังได้ ข้อความและคำถามแก้ที่ฐานความรู้ AI",
  category: "hero",
  schema,
  defaults: { theme: "sky" },
  fields: [
    {
      key: "theme",
      type: "select",
      label: "ธีมพื้นหลัง",
      options: [
        ["sky", "ท้องฟ้า (ปกติ)"],
        ["halloween", "ฮาโลวีน"],
      ],
    },
  ],
  enabledOn: ["home"],
  maxPerPage: 1,
  Component,
};
