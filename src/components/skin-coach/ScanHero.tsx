import Image from "next/image";
import { SparkleIcon, ChartIcon, FaceIcon, HeartIcon } from "./icons";

// The top of /skin-coach, before anybody has pointed a camera at themselves.
//
// Laid out to TOP's mockup, from the asset kit that came with it: the
// portrait and both mascot poses are transparent PNGs drawn for this, and
// the icons are the kit's own. The sky, the clouds, the sparkles and the
// speech bubble are CSS and SVG, as the kit's README asks — they are flat
// colour and soft edges, which cost nothing to describe in code and stay
// sharp at any size, while a screenshot of them would be neither.
//
// This belongs on this page rather than on /advisor, where it was first
// built by mistake: every word in the artwork is about the camera scan, and
// the four-step bar in it is this page's own stepper.
//
// Shown only at the first step. Once the camera is open the page is the
// scan, and scenery above it is something to scroll past to reach your own
// face.

/** The four reasons, with the kit's icons and the kit's Thai. */
const REASONS = [
  { Icon: SparkleIcon, tint: "bg-[#e8f7f1] text-brand-800", title: "รู้สภาพผิว", body: "อย่างละเอียด" },
  { Icon: ChartIcon, tint: "bg-[#e6f4fb] text-[#1d7fa8]", title: "รับคำแนะนำ", body: "ผลิตภัณฑ์ที่เหมาะกับคุณ" },
  { Icon: FaceIcon, tint: "bg-[#eef3fd] text-[#4a6fd1]", title: "เข้าใจปัญหาผิว", body: "แบบง่ายๆ" },
  { Icon: HeartIcon, tint: "bg-[#e6f4fb] text-[#1d7fa8]", title: "ฟรี ไม่มีค่าใช้จ่าย", body: "ใช้งานได้ทันที" },
];

/** A four-pointed star, the shape the artwork scatters through the sky. */
function Sparkle({ className, size }: { className: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={`pointer-events-none absolute ${className}`}>
      {/* Concave sides are what make it read as a sparkle and not a cross. */}
      <path d="M12 0c.6 6.3 5.1 10.8 12 12-6.9 1.2-11.4 5.7-12 12-.6-6.3-5.1-10.8-12-12C6.9 10.8 11.4 6.3 12 0Z" fill="currentColor" />
    </svg>
  );
}

export default function ScanHero() {
  return (
    // Bled to the window's edges, which the rest of this page is not: the
    // sky is the page's background here, and a tinted band with a 16px white
    // margin down each side reads as a card that failed to fit.
    <section className="relative isolate -mx-4 -mt-8 overflow-hidden bg-[linear-gradient(180deg,#e9f5fb_0%,#f1fbfa_52%,#ffffff_100%)] px-4 pt-4 md:-mx-6 md:-mt-10 md:px-6 md:pt-9">
      <Sparkle className="left-[53%] top-4 text-[#9fd4f2]" size={22} />
      <Sparkle className="right-[8%] top-12 text-[#bfe4f7]" size={30} />
      <Sparkle className="left-[47%] top-[34%] text-[#7ec8ec]" size={18} />
      <Sparkle className="left-[40%] top-[52%] text-[#9fd4f2]" size={15} />

      {/* The clouds the reasons stand on: three soft ellipses, which is what
          they are in the artwork too. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-[radial-gradient(60%_78%_at_18%_100%,#fff_0%,transparent_70%),radial-gradient(55%_72%_at_54%_100%,#fff_0%,transparent_72%),radial-gradient(62%_82%_at_88%_100%,#fff_0%,transparent_70%)]"
      />

      <div className="relative">
        {/* The portrait, bleeding off the top right. A transparent cut-out,
            so it needs no mask to hide a background — the first attempt at
            this page used a rectangle cropped out of the mockup and spent
            an elliptical mask hiding its corners. */}
        <div className="pointer-events-none absolute -right-7 -top-7 w-[62%] max-w-[390px] md:-right-3 md:w-[52%]">
          <Image
            src="/skin-coach/hero-woman.webp"
            alt=""
            width={720}
            height={769}
            priority
            sizes="(max-width: 768px) 54vw, 360px"
            className="h-auto w-full"
          />
        </div>

        <div className="relative max-w-[18.5rem] sm:max-w-[25rem]">
          <p className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[9.5px] font-bold tracking-[0.06em] text-brand-800 shadow-product md:gap-1.5 md:px-3 md:py-1.5 md:text-[11px]">
            <SparkleIcon size={11} />
            AI SKIN ANALYSIS
          </p>

          <h1 className="mt-3 text-[1.7rem] font-bold leading-[1.15] text-brand-ink md:text-[2.5rem]">
            สแกนผิวกับน้อง
            {/* One sentence, so one heading — the name is a span, not a
                second h1. */}
            <span className="mt-0.5 block bg-brand-gradient bg-clip-text text-[2.2rem] text-transparent md:text-[3.2rem]">
              Smoothie
            </span>
          </h1>

          <p className="mt-1.5 max-w-[20rem] text-[12.5px] leading-snug text-slate-500 md:text-[15px] md:leading-relaxed">
            ประเมินผิวจากรูปถ่าย เพื่อความสวยงาม ไม่ใช่การวินิจฉัยทางการแพทย์
          </p>
        </div>

      </div>

      {/* The mascot takes no space of its own.
          
          This had a row to itself, and that row was most of why the hero ran
          about seventy pixels taller than the artwork's. Measuring the
          artwork settled it: the mascot's bottom edge is at 0.713 of the page
          width and the reasons' icons start at 0.64 — it is standing among
          them, between รับคำแนะนำ and เข้าใจปัญหาผิว, not above them. Out of
          the flow, so the reasons row sits where it does in the artwork and
          the mascot overlaps it.
          
          Sizes are the artwork's too: 0.263 of the page width across, its
          left edge at 0.521. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden md:block" aria-hidden />
      <div className="pointer-events-none absolute left-[52%] top-[46%] z-10 w-[26%] max-w-[190px]">
        <p className="absolute bottom-[58%] right-[86%] w-max rounded-[14px] rounded-br-sm bg-white px-2.5 py-1.5 text-center text-[11px] font-bold leading-tight text-brand-ink shadow-product md:text-[13px]">
          มาสแกน
          <br />
          ผิวกันเถอะ!
        </p>
        <Image
          src="/skin-coach/mascot-camera.webp"
          alt="น้อง Smoothie"
          width={380}
          height={398}
          sizes="(max-width: 768px) 112px, 190px"
          className="h-auto w-full"
        />
      </div>

      {/* Four across at every width: each is an icon and two short lines, not
          a sentence, so they fit even on the narrowest phone. */}
      {/* Pushed down to where the artwork puts it: its icons start at 0.64
          of the page width from the top of the hero, and with the mascot out
          of the flow this row was landing at 0.51. The space is not empty —
          it is where the portrait and the mascot are. */}
      <ul className="relative mt-[13%] grid grid-cols-4 gap-1 pb-1 md:mt-0 md:gap-4 md:pb-9">
        {REASONS.map(({ Icon, tint, title, body }) => (
          <li key={title} className="flex flex-col items-center text-center">
            <span className={`grid size-10 place-items-center rounded-full md:size-14 ${tint}`}>
              <Icon size={19} />
            </span>
            <p className="mt-1.5 text-[10.5px] font-bold leading-tight text-brand-ink md:text-sm">{title}</p>
            <p className="mt-0.5 text-[9.5px] leading-tight text-slate-500 md:text-xs">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
