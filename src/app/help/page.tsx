import Link from "next/link";
import { MessageCircle, ChevronRight } from "lucide-react";
import Faq from "@/components/Faq";
import { helpFaqs, helpTopics } from "@/data/help";
import { helpIcon } from "./icons";

export const metadata = { title: "ศูนย์ช่วยเหลือ | Smoothlife.com" };

const topics = [
  ...helpTopics.map((t) => ({ href: t.href, label: t.label, icon: helpIcon(t.sections[0].icon) })),
  { href: "/help/contact", label: "แชทและติดต่อเรา", icon: MessageCircle },
];

const faqs = helpFaqs;

export default function HelpPage() {
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
