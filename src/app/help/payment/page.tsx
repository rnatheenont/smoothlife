import { helpTopics } from "@/data/help";
import ContentPage from "@/components/ContentPage";
import { helpIcon } from "../icons";

export const metadata = { title: "การชำระเงิน | Smoothlife.com" };

const topic = helpTopics.find((t) => t.href === "/help/payment")!;

export default function PaymentPage() {
  return (
    <ContentPage
      eyebrow={topic.eyebrow}
      title={topic.title}
      intro={topic.intro}
      sections={topic.sections.map((s) => ({ icon: helpIcon(s.icon), title: s.title, body: s.body }))}
    />
  );
}
