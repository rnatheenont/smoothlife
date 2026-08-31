import Image from "next/image";
import { LucideIcon } from "lucide-react";

export type ContentSection = {
  icon?: LucideIcon;
  title: string;
  body: string;
};

export default function ContentPage({
  eyebrow,
  title,
  intro,
  image,
  sections,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  image?: string;
  sections: ContentSection[];
}) {
  return (
    <div className="container-page py-8 md:py-10">
      <div className="max-w-2xl mb-8">
        {eyebrow && <p className="text-xs font-bold uppercase text-brand-emerald tracking-wide mb-2">{eyebrow}</p>}
        <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-3">{title}</h1>
        <p className="text-sm text-slate-600">{intro}</p>
      </div>
      {image && (
        <div className="relative aspect-21/9 rounded-xl2 overflow-hidden mb-10">
          <Image src={image} alt={title} fill className="object-cover" />
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        {sections.map((s) => (
          <div key={s.title} className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            {s.icon && (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-3">
                <s.icon size={18} />
              </div>
            )}
            <h3 className="font-bold text-brand-ink mb-1.5">{s.title}</h3>
            <p className="text-sm text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
