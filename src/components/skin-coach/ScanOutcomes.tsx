import Image from "next/image";
import { SearchIcon, FaceIcon, BulbIcon, HeartIcon } from "./icons";

// What a scan gives back, and the mascot's send-off — the bottom of the
// mockup, under the card that starts the scan.
//
// Shown only at the first step, like ScanHero. Somebody who is already
// photographing their face has decided; a list of reasons under the camera
// is an argument with a person who has stopped arguing.

const OUTCOMES = [
  { Icon: SearchIcon, title: "สภาพผิวโดยรวม", body: "เช่น ความชุ่มชื้น รูขุมขน ความมัน" },
  { Icon: FaceIcon, title: "ปัญหาผิวที่พบ", body: "เช่น สิว รอยดำ จุดด่างดำ" },
  { Icon: BulbIcon, title: "คำแนะนำการดูแล", body: "และผลิตภัณฑ์ที่เหมาะกับคุณ" },
  { Icon: HeartIcon, title: "ติดตามพัฒนาการ", body: "สแกนซ้ำเพื่อดูผลลัพธ์" },
];

export default function ScanOutcomes() {
  return (
    <div className="mt-7 space-y-5">
      <section>
        <h2 className="mb-3 text-lg font-bold text-brand-ink">สแกนแล้วได้อะไรบ้าง?</h2>
        <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          {OUTCOMES.map(({ Icon, title, body }) => (
            <li key={title} className="rounded-2xl bg-white p-3.5 shadow-product md:p-4">
              <span className="grid size-10 place-items-center rounded-full bg-[#eaf6fb] text-[#1d7fa8]">
                <Icon size={19} />
              </span>
              <p className="mt-2.5 text-[13px] font-bold leading-tight text-brand-ink">{title}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-3 rounded-[20px] bg-[linear-gradient(100deg,#f1faf6_0%,#fdfdf8_60%,#fef8ee_100%)] px-4 py-3 md:gap-5 md:px-6">
        <div className="relative h-20 w-20 shrink-0 md:h-24 md:w-24">
          <Image src="/skin-coach/mascot-clipboard.webp" alt="" width={320} height={332} sizes="96px" className="h-full w-full object-contain" />
        </div>
        <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-brand-ink md:text-sm">
          มาเริ่มดูแลผิวไปด้วยกัน กับน้อง Smoothie นะคะ
        </p>
        {/* The hand-lettered line in the artwork. Italic and underlined
            rather than a webfont nobody else on the site loads: one more
            font file for five words is not a trade worth making. */}
        <p className="hidden shrink-0 -rotate-2 border-b-2 border-brand-teal pb-0.5 text-sm font-bold italic text-brand-800 sm:block md:text-base">
          ผิวดี…เริ่มได้วันนี้
        </p>
      </div>
    </div>
  );
}
