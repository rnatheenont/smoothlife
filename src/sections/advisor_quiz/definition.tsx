import { z } from "zod";
import AdvisorQuiz from "@/components/AdvisorQuiz";
import SupplementAdvisorQuiz from "@/components/SupplementAdvisorQuiz";
import OralCareAdvisorQuiz from "@/components/OralCareAdvisorQuiz";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// One of the three advisors, chosen by which page this is.
//
// Locked, and one section with a variant rather than three sections, because
// that is what they are: three sets of questions behind the same idea, each
// one a self-contained quiz that keeps its own answers and hands them to the
// chat when it is done. Nothing about any of them is editable — the questions
// are the product.
//
// The words above them are not here, which is the point of the page having a
// document at all: the header and the band that offers the camera scan are
// their own blocks now, and those are the parts somebody wants to reword.

const schema = z.object({
  variant: z.enum(["skin", "supplement", "oral_care"]).default("skin"),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  // The container and the page's bottom padding are here because the quizzes
  // have neither — they were direct children of the page's own container.
  return (
    <section className="container-page pb-8 md:pb-10">
      {settings.variant === "supplement" ? (
        <SupplementAdvisorQuiz />
      ) : settings.variant === "oral_care" ? (
        <OralCareAdvisorQuiz />
      ) : (
        <AdvisorQuiz />
      )}
    </section>
  );
}

export const advisorQuiz: SectionDefinition<typeof schema> = {
  type: "advisor_quiz",
  version: 1,
  label: "แบบประเมินของที่ปรึกษา",
  description: "ชุดคำถามของที่ปรึกษา — เลือกได้ว่าเป็นชุดผิว อาหารเสริม หรือช่องปาก",
  category: "content",
  schema,
  defaults: { variant: "skin" },
  fields: [
    {
      key: "variant",
      type: "select",
      label: "ชุดคำถาม",
      options: [
        ["skin", "ผิว (น้อง Smoothie)"],
        ["supplement", "อาหารเสริม"],
        ["oral_care", "ช่องปาก"],
      ],
    },
  ],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  Component,
};
