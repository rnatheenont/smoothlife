import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Gift, PartyPopper, Ticket } from "lucide-react";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { holdsPrize } from "@/lib/receipt-campaign";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";
import ClaimPrize from "./ClaimPrize";

// "คุณได้สิทธิ" — one page, one question answered.
//
// The same words were already on the campaign page, in a card above the
// upload form. That is the right place for somebody who came to send a
// receipt and the wrong one for somebody who was sent a link saying they
// won: they arrive at a page about entering a competition they have already
// won, and the thing they came for is a card they have to find.
//
// So it is a page of its own with an address worth putting in a message.
// It decides nothing — who holds a prize is the same rule the console and
// the campaign page use, read from the same rows — it only says it plainly.

export const metadata = {
  title: "สิทธิ์รับรางวัลของคุณ | Smoothlife.com",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string;
  prize_type: "vip" | "lucky_fan";
  rank: number;
  status: "pending_confirm" | "confirmed" | "forfeited";
  confirm_deadline: string;
};

const PRIZE_NAME: Record<Row["prize_type"], string> = {
  vip: "รางวัล VIP",
  lucky_fan: "รางวัล Lucky Fan",
};

function thaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PrizePage({ params }: { params: Promise<{ campaign: string }> }) {
  const campaign = campaignKeyFrom((await params).campaign);
  const content = await loadCampaignContent(campaign);
  if (!content.published) notFound();

  // Signed out, they are sent to sign in and brought straight back here —
  // not dropped on the home page to find their way again.
  const uid = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) {
    redirect(`/account/login?returnTo=${encodeURIComponent(`/campaigns/${campaign}/prize`)}`);
  }

  const all = supabaseConfigured()
    ? await supabaseRest<Row[]>(
        `receipt_campaign_winners?campaign_key=eq.${campaign}` +
          `&select=id,user_id,prize_type,rank,status,confirm_deadline&order=rank`,
      ).catch(() => [] as Row[])
    : [];

  // Holding is not the same as having been drawn: a forfeit above you moves
  // you up, and until it happens the reserve below is not holding anything.
  const holding = new Set<string>();
  for (const type of ["vip", "lucky_fan"] as const) {
    for (const w of holdsPrize(all.filter((p) => p.prize_type === type))) holding.add(w.id);
  }

  const mine = all.filter((w) => w.user_id === uid);
  const won = mine.filter((w) => holding.has(w.id) && w.status !== "forfeited");
  const reserve = mine.filter((w) => !holding.has(w.id) && w.status !== "forfeited");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--rc-ink)]">
        {content.eyebrow}
      </p>

      {won.length > 0 ? (
        <>
          <h1 className="mt-2 flex items-start gap-2 text-3xl font-extrabold leading-tight text-black sm:text-4xl">
            <PartyPopper className="mt-1 shrink-0 text-[var(--rc-ink)]" size={30} aria-hidden />
            ยินดีด้วย! คุณได้รับรางวัล
          </h1>

          <div className="mt-6 flex flex-col gap-4">
            {won.map((w) => (
              <div
                key={w.id}
                className="rounded-3xl bg-white p-5 shadow-[0_18px_50px_rgb(76_29_149/0.08)] sm:p-6"
              >
                <p className="flex items-center gap-2 text-[20px] font-extrabold text-black sm:text-[22px]">
                  <Gift size={20} className="shrink-0 text-[var(--rc-ink)]" aria-hidden />
                  {PRIZE_NAME[w.prize_type]}
                </p>

                {w.status === "confirmed" ? (
                  <p className="mt-2 text-[15px] leading-relaxed text-emerald-800">
                    คุณยืนยันรับรางวัลแล้ว — ทีมงานจะติดต่อกลับเพื่อนัดรับรางวัล
                    ใช้เบอร์และอีเมลเดียวกับที่สั่งซื้อไว้
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-[15px] leading-relaxed text-black/70">
                      กรุณากดยืนยันสิทธิ์ภายใน{" "}
                      <span className="font-bold text-black">{thaiDate(w.confirm_deadline)}</span>{" "}
                      ถ้าไม่ยืนยันภายในกำหนด สิทธิ์จะถูกส่งต่อให้ลำดับสำรอง
                    </p>
                    <div className="mt-5">
                      <ClaimPrize campaign={campaign} prizeId={w.id} />
                    </div>
                    <p className="mt-3 text-[12px] text-black/45">
                      ถ้าไม่ต้องการรับรางวัลนี้ กรุณาแจ้งทีมงานผ่านช่องทางติดต่อของร้าน
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      ) : reserve.length > 0 ? (
        <>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-black sm:text-4xl">
            คุณอยู่ลำดับสำรอง
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-black/70">
            ชื่อของคุณถูกจับได้ในลำดับสำรอง ถ้ามีผู้ได้รับรางวัลสละสิทธิ์หรือไม่ยืนยันภายในกำหนด
            สิทธิ์จะเลื่อนมาที่คุณตามลำดับ และหน้านี้จะเปลี่ยนเป็นปุ่มยืนยันให้เอง
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-black sm:text-4xl">
            ยังไม่มีรางวัลในชื่อของคุณ
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-black/70">
            {all.length === 0
              ? "ยังไม่ถึงเวลาประกาศผล — เมื่อประกาศแล้ว หน้านี้จะบอกคุณเองว่าได้รางวัลหรือไม่"
              : "ประกาศผลไปแล้วและรอบนี้ยังไม่ใช่ของคุณ ขอบคุณที่ร่วมสนุกนะคะ"}
          </p>
        </>
      )}

      {/* Always a way back to the campaign: somebody who did not win is
          still somebody who sent in receipts, and the page they came from
          is where their entries are. */}
      <Link
        href={`/campaigns/${campaign}`}
        className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--rc-ink)] underline-offset-2 hover:underline"
      >
        <Ticket size={16} aria-hidden /> ดูสิทธิ์และใบเสร็จของฉัน
      </Link>
    </div>
  );
}
