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
    <div className="mt-5 space-y-3.5 md:mt-7 md:space-y-5">
      <section>
        <h2 className="mb-2 text-[16px] font-bold text-brand-ink md:mb-3 md:text-lg">สแกนแล้วได้อะไรบ้าง?</h2>
        {/* Four across at every width, as the artwork has them. Two-by-two
            was my own doing and it made the row twice as tall for no gain:
            each card is an icon, a short title and one line of examples,
            which fits a quarter of a phone. */}
        <ul className="grid grid-cols-4 gap-1.5 md:gap-4">
          {OUTCOMES.map(({ Icon, title, body }) => (
            <li key={title} className="rounded-2xl bg-white p-1.5 shadow-product md:p-4">
              <span className="grid size-7 place-items-center rounded-full bg-[#eaf6fb] text-[#1d7fa8] md:size-10">
                <Icon size={15} />
              </span>
              <p className="mt-1.5 text-[10.5px] font-bold leading-tight text-brand-ink md:text-[13px]">{title}</p>
              <p className="mt-0.5 text-[9px] leading-tight text-slate-500 md:mt-1 md:text-[11px]">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-2.5 rounded-[20px] bg-[linear-gradient(100deg,#f1faf6_0%,#fdfdf8_60%,#fef8ee_100%)] px-3 py-2 md:gap-5 md:px-6 md:py-3">
        <div className="relative h-14 w-14 shrink-0 md:h-24 md:w-24">
          <Image src="/skin-coach/mascot-clipboard.webp" alt="" width={320} height={332} sizes="96px" className="h-full w-full object-contain" />
        </div>
        <p className="min-w-0 flex-1 text-[11.5px] font-bold leading-snug text-brand-ink md:text-sm">
          มาเริ่มดูแลผิวไปด้วยกัน กับน้อง Smoothie นะคะ
        </p>
        {/* The hand-lettered line in the artwork. Italic and underlined
            rather than a webfont nobody else on the site loads: one more
            font file for five words is not a trade worth making. */}
        {/* Shown at every width. It was hidden below sm, which got the
            arithmetic right and the brief wrong: the artwork this is laid
            out to is a phone screen and has this line on it, so hiding it on
            a phone hides it from almost everybody who sees the page. */}
        <p className="shrink-0 -rotate-2 border-b-2 border-brand-teal pb-0.5 text-[12px] font-bold italic text-brand-800 md:text-base">
          ผิวดี…เริ่มได้วันนี้
        </p>
      </div>
    </div>
  );
}
