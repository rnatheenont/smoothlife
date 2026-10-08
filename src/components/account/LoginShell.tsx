import Image from "next/image";
import { Gift, ScanFace, PackageCheck } from "lucide-react";

// The frame every sign-in view sits in.
//
// Signing in is where a shopper decides whether this shop is worth having an
// account with, and the page was answering that with a 448px card alone in
// 952px of white. The left half is the answer: what an account is actually
// for here — points, order history, and the skin scan keeping its results.
// All three are real pages behind this door, not promises.
//
// The panel belongs to the shell rather than to any one view, so moving
// between the phone form, the code, the password form and registration
// changes only the right-hand column. The half the eye is resting on does
// not flash.

/** Real features, each with somewhere to land after signing in. */
const REASONS = [
  { Icon: Gift, title: "สะสมแต้มทุกออร์เดอร์", body: "แลกเป็นส่วนลดครั้งถัดไปได้เลย" },
  { Icon: PackageCheck, title: "ดูประวัติการสั่งซื้อ", body: "ติดตามพัสดุและสั่งซ้ำได้ในคลิกเดียว" },
  { Icon: ScanFace, title: "สแกนผิวเก็บผลไว้", body: "เทียบผลเก่ากับผลใหม่ได้ว่าผิวดีขึ้นไหม" },
];

export default function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    // Full-bleed rather than inside container-page: a split screen only reads
    // as one if its halves reach the edges of the window.
    <div className="w-full lg:grid lg:min-h-[78vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)]">
      {/* The brand half. Hidden on a phone, where there is no room for two
          columns and the shop's own header is already overhead — what a
          phone gets instead is the compact crest at the top of the form. */}
      <div className="relative hidden overflow-hidden bg-brand-gradient lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-16 xl:px-20">
        {/* Two soft lights over the gradient, so the panel has somewhere to
            look rather than being one flat field of green. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-[460px] rounded-full bg-white/15 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 size-[420px] rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative">
          <p className="text-sm font-medium text-white/80">Smoothlife.com</p>
          <h2 className="mt-3 max-w-[13ch] text-[40px] font-bold leading-[1.25] tracking-[-0.01em] text-white xl:text-[46px]">
            สมัครครั้งเดียว ใช้ได้ทั้งร้าน
          </h2>
          <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-white/85">
            บัญชีเดียวเก็บทั้งแต้ม ประวัติการซื้อ และผลสแกนผิวของคุณไว้ที่เดียว
          </p>
        </div>

        {/* Capped, and the mascot sized to what is left: at the narrow end
            of lg the panel is only 553px wide, and a full-width list ran
            straight under the mascot's feet. */}
        <ul className="relative mt-12 flex max-w-[300px] flex-col gap-5">
          {REASONS.map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25">
                <Icon size={19} strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-white">{title}</span>
                <span className="block text-[13px] leading-relaxed text-white/75">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* Sat on the bottom edge, half out of frame, so the panel reads as a
            window onto the shop rather than a poster of it. */}
        <Image
          src="/mascot/smoothie-new.png"
          alt=""
          width={260}
          height={260}
          aria-hidden
          className="pointer-events-none absolute -bottom-8 right-6 w-[160px] drop-shadow-2xl xl:w-[240px]"
        />
      </div>

      {/* The form half. */}
      <div className="flex items-center justify-center px-4 py-10 md:px-8 md:py-16">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
