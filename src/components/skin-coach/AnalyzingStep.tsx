import { Loader2 } from "lucide-react";

const LOOKING_AT = ["สิวและความเรียบเนียน", "รูขุมขน", "จุดด่างดำและสีผิว", "ริ้วรอย", "อายุผิวโดยรวม"];

/**
 * While the one request runs. It lists what the photos are being looked at
 * for, without ticking items off: the analysis happens in a single call, so
 * a checklist completing step by step — or a percentage — would be theatre.
 */
export default function AnalyzingStep({ photos }: { photos: string[] }) {
  return (
    <section aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2.5">
        <Loader2 size={20} className="animate-spin text-brand-800" aria-hidden="true" />
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">น้อง Smoothie กำลังดูผิวของคุณ</h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">ใช้เวลาประมาณครึ่งนาที อย่าเพิ่งปิดหน้านี้</p>

      <div className="mt-5 flex gap-2">
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
        ))}
      </div>

      <div className="mt-5 rounded-xl2 bg-surface-mist p-4">
        <p className="text-sm font-semibold text-brand-ink">สิ่งที่ดูจากรูป</p>
        <ul className="mt-2 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
          {LOOKING_AT.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-800/50" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
