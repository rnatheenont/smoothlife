import { PAGES_WAVE1_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import { helpTopics } from "@/data/help";
import ContentPage from "@/components/ContentPage";
import { helpIcon } from "../icons";

export const metadata = { title: "การชำระเงิน | Smoothlife.com" };

const topic = helpTopics.find((t) => t.href === "/help/payment")!;

function PaymentPageWritten() {
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
export default function PaymentPage() {
  if (PAGES_WAVE1_ENABLED) return <SystemPageBody pageKey="help-payment" />;
  return <PaymentPageWritten />;
}
