import { z } from "zod";
import SmoothieHeroBand from "@/components/home/SmoothieHeroBand";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The band at the very top of the home page: ask Smoothie a question, or send
// it a photo of your skin.
//
// It takes no settings yet. The component holds its own copy and reads its
// suggested questions from /api/chat-suggestions, which the team already
// edits in the AI knowledge base — moving that text in here would give them a
// second place to edit the same words.

const schema = z.object({});

function Component(_props: SectionProps<z.output<typeof schema>>) {
  return <SmoothieHeroBand />;
}

export const smoothieAsk: SectionDefinition<typeof schema> = {
  type: "smoothie_ask",
  version: 1,
  label: "ถามน้อง Smoothie",
  description: "ช่องถาม AI พร้อมคำถามแนะนำ — ข้อความและคำถามแก้ได้ที่ฐานความรู้ AI",
  category: "hero",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["home"],
  maxPerPage: 1,
  Component,
};
