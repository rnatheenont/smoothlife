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
/* Colours sampled off the reference TOP marked up: everything is the same
   mint-teal and only the heart is blue, which is what makes the heart read
   as the odd one out — the free one — rather than as a fourth colour in a
   row of four. Before this the row ran green, blue, indigo, blue, which was
   four tints doing no work. */
const MINT = "bg-[#e4f6f1] text-[#17b095]";
const SKY = "bg-[#e3f3fb] text-[#2bb0da]";

const REASONS = [
  { Icon: SparkleIcon, tint: MINT, title: "รู้สภาพผิว", body: "อย่างละเอียด" },
  { Icon: ChartIcon, tint: MINT, title: "รับคำแนะนำ", body: "ผลิตภัณฑ์ที่เหมาะกับคุณ" },
  { Icon: FaceIcon, tint: MINT, title: "เข้าใจปัญหาผิว", body: "แบบง่ายๆ" },
  { Icon: HeartIcon, tint: SKY, title: "ฟรี ไม่มีค่าใช้จ่าย", body: "ใช้งานได้ทันที" },
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

export default function ScanHero({ aside }: { aside?: React.ReactNode }) {
  return (
    // Full width because it is not inside the page's column — see page.tsx,
    // which renders this as a sibling of the column rather than a child.
    //
    // Two earlier attempts at the same thing, both worse: breaking out with
    // a negative margin of calc(50% - 50vw), which works but is a few pixels
    // wider than the window on any desktop with a scrollbar because 100vw
    // counts it; and then adding overflow-x-clip to the column to absorb
    // that, which clipped the background back to the column and undid the
    // whole thing. A block element that is simply full width has neither
    // problem.
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#e9f5fb_0%,#f1fbfa_52%,#ffffff_100%)]">
      {/* The words start a little further down the sky than they did — it
            sat high against the top edge with a lot of empty tint under it.
            Measured off the box TOP drew: about 25px lower on a 445px-wide
            page. */}
      {/* The site's full width once the card sits beside the words. Capped at
          900 it was the artwork's column, which is right when the band holds
          one thing; holding two it left the words about 430px and a lot of
          empty sky down both sides of the band. */}
      <div className="container-page relative pt-14 [--page-max:900px] md:pt-12 md:[--page-max:1400px]">
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

      {/* The words and the portrait keep the artwork's own arrangement at
          every width — she floats over the top right and they sit under her.
          What changes on a desktop is what goes beside them: the card that
          starts a scan comes up out of the flow below and fills the sky that
          was otherwise empty there. See page.tsx, which decides where that
          card is rendered. */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] md:items-center md:gap-12">
      {/* Pushed down on a desktop so the words and the reasons sit lower in
          the band than the card beside them, which is where TOP's boxes put
          them. On a phone there is no second column to sit against and the
          sky's own top padding already places it. */}
      <div className="relative md:pt-36">
        {/* The portrait. A transparent cut-out, so it needs no mask to hide
            a background — the first attempt at this page used a rectangle
            cropped out of the mockup and spent an elliptical mask hiding its
            corners. */}
        <div className="pointer-events-none absolute -right-5 -top-2 w-[66%] max-w-[430px] md:-right-3 md:w-[56%]">
          <Image
            src="/skin-coach/hero-woman.webp"
            alt=""
            width={720}
            height={769}
            priority
            sizes="(max-width: 768px) 66vw, 30rem"
            className="h-auto w-full"
          />
        </div>

        <div className="relative max-w-[62%] sm:max-w-[25rem]">
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

          {/* Broken by hand, because the two halves are two different
              things: what this does, and what it is not. Left to wrap on its
              own it split as "…ไม่ใช่การ / วินิจฉัยทางการแพทย์", which cuts
              the disclaimer in half at the least useful point. */}
          <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500 md:text-[15px] md:leading-relaxed">
            ประเมินผิวจากรูปถ่าย เพื่อความสวยงาม
            <br />
            ไม่ใช่การวินิจฉัยทางการแพทย์
          </p>
        </div>

        {/* Inside this column, not across the whole band.
            
            Clear of the portrait: measured off the reference, her skin ends
            at 0.581 of the page width below the top of the sky and the icons
            begin at 0.618, so they sit under her rather than over her — this
            row was starting at 0.499 and running through her shoulder.
            
            And on a desktop it belongs to the words beside it, not to the
            whole band: run full width it passed under the scan card as well,
            which made four reasons look like a caption for a card they have
            nothing to do with. */}
        <ul className="relative mt-[25%] grid grid-cols-4 gap-1 pb-[3%] md:mt-8 md:gap-4 md:pb-9">
          {REASONS.map(({ Icon, tint, title, body }) => (
            <li key={title} className="flex flex-col items-center text-center">
              <span className={`grid size-[3.1rem] place-items-center rounded-full md:size-16 ${tint}`}>
                <Icon size={25} />
              </span>
              <p className="mt-1.5 text-[10.5px] font-bold leading-tight text-brand-ink md:text-sm">{title}</p>
              <p className="mt-0.5 text-[9.5px] leading-tight text-slate-500 md:text-xs">{body}</p>
            </li>
          ))}
          </ul>
      </div>

      {/* The card that starts a scan, when a desktop has room for it beside
          the words. Empty on a phone, where it stays in the flow below. */}
      {aside && <div className="hidden md:block">{aside}</div>}
      </div>

      </div>
    </section>
  );
}
