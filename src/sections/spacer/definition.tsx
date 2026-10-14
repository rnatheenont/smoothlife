import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Air between two sections.
//
// Sized in steps rather than pixels: a free number invites 37px here and 41px
// there, and a page whose gaps nearly match is harder to look at than one
// whose gaps clearly differ.

const schema = z.object({
  size: z.enum(["sm", "md", "lg"]).default("md"),
  divider: z.boolean().default(false),
});

const HEIGHT: Record<string, string> = { sm: "h-6 md:h-8", md: "h-10 md:h-14", lg: "h-16 md:h-24" };

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  if (!settings.divider) return <div aria-hidden="true" className={HEIGHT[settings.size]} />;
  return (
    <div aria-hidden="true" className={`container-page flex items-center ${HEIGHT[settings.size]}`}>
      <span className="h-px w-full bg-surface-line" />
    </div>
  );
}

export const spacer: SectionDefinition<typeof schema> = {
  type: "spacer",
  version: 1,
  label: "เว้นระยะ",
  description: "ช่องว่างระหว่าง section ใส่เส้นคั่นได้",
  category: "layout",
  schema,
  defaults: { size: "md", divider: false },
  fields: [
    { key: "size", type: "select", label: "ความสูง", options: [["sm", "น้อย"], ["md", "กลาง"], ["lg", "มาก"]] },
    { key: "divider", type: "toggle", label: "ใส่เส้นคั่น" },
  ],
  enabledOn: ["home", "page", "campaign", "brand", "system", "template"],
  Component,
};
