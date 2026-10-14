import { PAGES_WAVE1_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import Link from "next/link";
import { MessageCircle, ChevronRight } from "lucide-react";
import Faq from "@/components/Faq";
import { helpFaqs, helpTopics } from "@/data/help";
import { helpIcon } from "./icons";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/site-pages";

export function generateMetadata() {
  return pageMetadata("help");
}

const topics = [
  ...helpTopics.map((t) => ({ href: t.href, label: t.label, icon: helpIcon(t.sections[0].icon) })),
  { href: "/help/contact", label: "แชทและติดต่อเรา", icon: MessageCircle },
];

const faqs = helpFaqs;

function HelpPageWritten() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">ศูนย์ช่วยเหลือ</h1>
      <p className="text-sm text-slate-500 mb-8">เรามีคำตอบให้ทุกคำถามของคุณ</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {topics.map((t) => (
          <Link key={t.href} href={t.href} className="flex items-center gap-3 rounded-xl2 border border-slate-100 p-5 shadow-card hover:border-brand-teal transition-colors">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-800 shrink-0">
              <t.icon size={18} />
            </div>
            <span className="flex-1 text-sm font-medium text-brand-ink">{t.label}</span>
            <ChevronRight size={16} className="text-slate-300" />
          </Link>
        ))}
      </div>

      <h2 className="font-bold text-brand-ink mb-4">คำถามที่พบบ่อย</h2>
      <Faq items={faqs} />
    </div>
  );
}

/**
 * From the document when wave 1 is on, from the markup above when it is not.
 *
 * The two bits of structured data sit out here, outside the switch, because
 * they belong to the route rather than to the page's contents: the FAQ one
 * because the questions on this page come from the shared list either way,
 * and the breadcrumb one because where /help sits in the site is not
 * something an admin edits. Keeping them here also means neither is lost nor
 * duplicated when the switch flips.
 */
export default function HelpPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(faqPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd([{ label: "หน้าแรก", href: "/" }, { label: "ศูนย์ช่วยเหลือ" }])),
        }}
      />
      {PAGES_WAVE1_ENABLED ? <SystemPageBody pageKey="help" /> : <HelpPageWritten />}
    </>
  );
}
