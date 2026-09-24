import { CalendarDays, Gift, Receipt, Ticket } from "lucide-react";
import ReceiptForm from "./ReceiptForm";
import { isTestMode } from "@/lib/receipt-campaign";

// DENTISTE'S x KENG NAMPING — the shell. The receipt upload, the entry count
// and the draw land here next; see the plan for what is still waiting on an
// answer from the marketing team (how 690 baht counts, and what "first come
// first serve" is measured from).

export const metadata = {
  title: "DENTISTE'S x KENG NAMPING — ส่งใบเสร็จลุ้นรางวัล | Smoothlife.com",
  description: "ซื้อผลิตภัณฑ์ DENTISTE' ที่ Smoothlife.com แล้วส่งใบเสร็จเพื่อรับสิทธิ์ลุ้นรางวัล",
};

const OPENS = new Date("2026-09-28T00:00:00+07:00");
const CLOSES = new Date("2026-10-26T23:59:59+07:00");
const ANNOUNCED = new Date("2026-11-03T18:00:00+07:00");

export const dynamic = "force-dynamic";

const thaiDate = (d: Date) =>
  d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

const STEPS = [
  { Icon: Receipt, title: "ซื้อผลิตภัณฑ์ DENTISTE'", body: "ที่ Smoothlife.com ระหว่าง 28 ก.ย. – 26 ต.ค. 2569" },
  { Icon: Ticket, title: "ส่งใบเสร็จ", body: "เลือกคำสั่งซื้อของคุณแล้วแนบรูปใบเสร็จ ระบบคำนวณสิทธิ์ให้ทันที" },
  { Icon: Gift, title: "ลุ้นรางวัล", body: "ประกาศผล 3 พ.ย. 2569 เวลา 18:00 น. และยืนยันสิทธิ์ภายใน 5 พ.ย." },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const test = isTestMode((await searchParams).test);
  // Rendered per request: the window opens and closes on a clock, not on a
  // deploy. force-dynamic keeps a build from freezing "not open yet" into the
  // page on the day it opens.
  // eslint-disable-next-line react-hooks/purity -- the clock is the point; force-dynamic renders this per request
  const now = Date.now();
  const open = test || (now >= OPENS.getTime() && now <= CLOSES.getTime());
  const closed = now > CLOSES.getTime();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-black/50">DENTISTE&apos;S x KENG NAMPING</p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-black sm:text-4xl">
        ส่งใบเสร็จ ลุ้นรับรางวัลสุดพิเศษ
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-black/70">
        ซื้อผลิตภัณฑ์ DENTISTE&apos; ที่ Smoothlife.com แล้วส่งใบเสร็จเพื่อรับสิทธิ์ลุ้นรางวัล
        ยิ่งยอดซื้อมาก ยิ่งมีสิทธิ์มาก
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/5 px-4 py-2 text-[13px] font-semibold text-black">
        <CalendarDays size={15} aria-hidden /> เปิดรับใบเสร็จ {thaiDate(OPENS)} – {thaiDate(CLOSES)}
      </div>

      <ol className="mt-10 flex flex-col gap-4">
        {STEPS.map(({ Icon, title, body }, i) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-black/10 p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-black/5 text-black">
              <Icon size={18} aria-hidden />
            </div>
            <div>
              <p className="text-[15px] font-bold text-black">
                {i + 1}. {title}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-black/70">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      {!open && (
        <div className="mt-10 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
          <p className="text-[14px] font-bold text-black">{closed ? "ปิดรับใบเสร็จแล้ว" : "ยังไม่เปิดรับใบเสร็จ"}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-black/70">
            {closed
              ? `หมดเขตส่งใบเสร็จเมื่อ ${thaiDate(CLOSES)} — ประกาศผลวันที่ ${thaiDate(ANNOUNCED)} เวลา 18:00 น.`
              : `ฟอร์มส่งใบเสร็จจะเปิดวันที่ ${thaiDate(OPENS)} และประกาศผลวันที่ ${thaiDate(ANNOUNCED)} เวลา 18:00 น.`}
            {" "}เก็บใบเสร็จตัวจริงไว้เป็นหลักฐานด้วยนะคะ
          </p>
        </div>
      )}

      {/* The form is rendered even while the window is shut, so someone who
          already sent a receipt can still see where it got to. */}
      <div className="mt-10">
        <ReceiptForm open={open} />
      </div>
    </div>
  );
}
