import { PAGES_WAVE1_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import { helpTopics } from "@/data/help";
import ContentPage from "@/components/ContentPage";
import { helpIcon } from "../icons";

export const metadata = { title: "การจัดส่งและคืนสินค้า | Smoothlife.com" };

const topic = helpTopics.find((t) => t.href === "/help/delivery")!;

function DeliveryPageWritten() {
  return (
    <ContentPage
      eyebrow={topic.eyebrow}
      title={topic.title}
      intro={topic.intro}
      sections={topic.sections.map((s) => ({ icon: helpIcon(s.icon), title: s.title, body: s.body }))}
    />
  );
}

/** From the document when wave 1 is on — see the about pages. */
export default function DeliveryPage() {
  if (PAGES_WAVE1_ENABLED) return <SystemPageBody pageKey="help-delivery" />;
  return <DeliveryPageWritten />;
}
