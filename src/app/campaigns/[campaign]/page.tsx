import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarDays, Gift, Receipt, Ticket } from "lucide-react";
import ReceiptForm from "./ReceiptForm";
import { isTestMode } from "@/lib/receipt-campaign";
import { labelsOf, loadCampaignContent } from "@/lib/receipt-campaign-content";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

// DENTISTE'S x KENG NAMPING — the shell. The receipt upload, the entry count
// and the draw land here next; see the plan for what is still waiting on an
// answer from the marketing team (how 690 baht counts, and what "first come
// first serve" is measured from).

export const metadata = {
  title: "DENTISTE'S x KENG NAMPING — ส่งใบเสร็จลุ้นรางวัล | Smoothlife.com",
  description: "ซื้อผลิตภัณฑ์ DENTISTE' ที่ Smoothlife.com แล้วส่งใบเสร็จเพื่อรับสิทธิ์ลุ้นรางวัล",
};

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<{ test?: string }>;
}) {
  const campaign = campaignKeyFrom((await params).campaign);
  const [{ test: testParam }, content] = await Promise.all([searchParams, loadCampaignContent(campaign)]);
  const test = isTestMode(testParam);

  // An unpublished campaign has no page. Whoever set it up can still see it —
  // a draft you cannot look at is a draft you cannot check — but to everybody
  // else the link simply does not exist yet.
  if (!content.published) {
    const admin = verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
    if (!admin) notFound();
  }

  const label = labelsOf(content);

  // Rendered per request: the window opens and closes on a clock, not on a
  // deploy. force-dynamic keeps a build from freezing "not open yet" into the
  // page on the day it opens.
  // eslint-disable-next-line react-hooks/purity -- the clock is the point; force-dynamic renders this per request
  const now = Date.now();
  const open = test || (now >= content.opensAt && now <= content.closesAt);
  const closed = now > content.closesAt;

  const steps = content.steps.map((step, i) => ({
    Icon: [Receipt, Ticket, Gift][i] ?? Receipt,
    ...step,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-black/50">{content.eyebrow}</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight text-black sm:text-4xl">{content.title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-black/70">{content.intro}</p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/5 px-4 py-2 text-[13px] font-semibold text-black">
        <CalendarDays size={15} aria-hidden /> เปิดรับใบเสร็จ {label.opensLong} – {label.closesLong}
      </div>

      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map(({ Icon, title, body }, i) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-black/10 p-5 sm:flex-col sm:gap-3">
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
              ? `หมดเขตส่งใบเสร็จเมื่อ ${label.closesLong} — ประกาศผลวันที่ ${label.announce} เวลา 18:00 น.`
              : `ฟอร์มส่งใบเสร็จจะเปิดวันที่ ${label.opensLong} และประกาศผลวันที่ ${label.announce} เวลา 18:00 น.`}
            {" "}เก็บใบเสร็จตัวจริงไว้เป็นหลักฐานด้วยนะคะ
          </p>
        </div>
      )}

      {/* The form is rendered even while the window is shut, so someone who
          already sent a receipt can still see where it got to. */}
      <div className="mt-10">
        <ReceiptForm campaign={campaign} open={open} opensLabel={label.opens} closesLabel={label.closes} />
      </div>

      {/* The conditions, on the page rather than only in whatever document the
          link came attached to. Published terms and a live system drifting
          apart is not hypothetical here: the terms said the campaign opened on
          28 September while it had been taking receipts since the 23rd. */}
      {content.terms.length > 0 && (
        <section className="mt-14 border-t border-black/10 pt-8">
          <h2 className="text-lg font-bold text-black">เงื่อนไขการร่วมกิจกรรม</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {content.terms.map((term, i) => (
              <li key={term} className="flex gap-3 text-[14px] leading-relaxed text-black/70">
                <span className="shrink-0 tabular-nums text-black/35">{i + 1}.</span>
                <span>{term}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13px] leading-relaxed text-black/50">
            ประกาศผล {label.announce} เวลา 18:00 น. · ยืนยันสิทธิ์ภายใน {label.confirm}
          </p>
        </section>
      )}
    </div>
  );
}
