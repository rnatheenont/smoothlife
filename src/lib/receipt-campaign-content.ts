import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { CLOSES_AT, OPENS_AT } from "@/lib/receipt-campaign";

// The words and dates a receipt campaign shows its customers.
//
// These were constants, which meant correcting a date or a line of copy was a
// deploy — and the one date that mattered most was already wrong in public:
// the published terms said 28 September while the system opened on the 23rd.
//
// What is editable is deliberately drawn here: the schedule and the wording.
// The arithmetic that decides entries — ฿690 a step, ฿990 for three, whether
// they multiply — stays in receipt-campaign.ts, because those numbers settle
// who wins ฿55,000 and a typo in a text field should not be able to move them.
//
// The window is the exception that proves it: it is copy *and* a rule, since
// an order outside it earns nothing. So it is loaded from here and passed into
// withinCampaign() rather than read from the constants, and a date shown to a
// customer is always the date the filter used.

export type CampaignStep = { title: string; body: string };

export type CampaignContent = {
  eyebrow: string;
  title: string;
  intro: string;
  opensAt: number;
  closesAt: number;
  announceAt: number;
  confirmDeadline: number;
  steps: CampaignStep[];
  /** The published conditions, one line each, shown on the campaign page. */
  terms: string[];
};

const thaiDate = (ms: number) =>
  new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
const thaiShort = (ms: number) =>
  new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

/** What the page said before any of it was editable. */
export const DEFAULT_CONTENT: CampaignContent = {
  eyebrow: "DENTISTE'S x KENG NAMPING",
  title: "ส่งใบเสร็จ ลุ้นรับรางวัลสุดพิเศษ",
  intro:
    "ซื้อผลิตภัณฑ์ DENTISTE' ที่ Smoothlife.com แล้วส่งใบเสร็จเพื่อรับสิทธิ์ลุ้นรางวัล ยิ่งยอดซื้อมาก ยิ่งมีสิทธิ์มาก",
  opensAt: OPENS_AT,
  closesAt: CLOSES_AT,
  announceAt: Date.parse("2026-11-03T18:00:00+07:00"),
  confirmDeadline: Date.parse("2026-11-05T23:59:59+07:00"),
  steps: [
    { title: "ซื้อผลิตภัณฑ์ DENTISTE'", body: "ที่ Smoothlife.com ระหว่างช่วงเวลาที่กำหนด" },
    { title: "ส่งใบเสร็จ", body: "แนบรูปใบเสร็จของคำสั่งซื้อที่เข้าเงื่อนไข ระบบคำนวณสิทธิ์ให้ทันที" },
    { title: "ลุ้นรางวัล", body: "ประกาศผลและยืนยันสิทธิ์ตามกำหนดการด้านล่าง" },
  ],
  terms: [
    "ยอดช็อปทุกๆ 690 บาทต่อใบเสร็จ ได้รับ 1 สิทธิ์ ทั้งนี้ไม่สามารถรวมยอดจากหลายใบเสร็จได้",
    "ยอดช็อป Set Keychain 990 บาทต่อใบเสร็จ ได้รับ 3 สิทธิ์ ทั้งนี้ไม่สามารถรวมยอดจากหลายใบเสร็จได้",
    "ต้องเป็นคำสั่งซื้อที่ชำระเงินสำเร็จบน Smoothlife.com เท่านั้น",
    "กรุณาเก็บใบเสร็จตัวจริงไว้เป็นหลักฐาน ทีมงานขอสงวนสิทธิ์ในการขอตรวจสอบ",
    "การตัดสินของทีมงานถือเป็นที่สิ้นสุด",
  ],
};

type Row = {
  eyebrow: string | null;
  title: string | null;
  intro: string | null;
  opens_at: string | null;
  closes_at: string | null;
  announce_at: string | null;
  confirm_deadline: string | null;
  steps: CampaignStep[] | null;
  terms: string[] | null;
};

const ms = (iso: string | null | undefined, fallback: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : fallback;
};

/**
 * The campaign as it should be shown right now.
 *
 * Never throws and never blocks: a missing table, an unreachable database or a
 * row nobody has written yet all mean the page renders exactly what it
 * rendered before any of this existed.
 */
export async function loadCampaignContent(campaignKey: string): Promise<CampaignContent> {
  if (!supabaseConfigured()) return DEFAULT_CONTENT;
  const [row] = await supabaseRest<Row[]>(
    `receipt_campaign_settings?campaign_key=eq.${pgValue(campaignKey)}` +
      `&select=eyebrow,title,intro,opens_at,closes_at,announce_at,confirm_deadline,steps,terms&limit=1`
  ).catch(() => [] as Row[]);
  if (!row) return DEFAULT_CONTENT;

  const steps = Array.isArray(row.steps)
    ? row.steps.filter((s): s is CampaignStep => Boolean(s && typeof s.title === "string"))
    : [];
  const terms = Array.isArray(row.terms) ? row.terms.filter((t): t is string => typeof t === "string") : [];

  return {
    eyebrow: row.eyebrow?.trim() || DEFAULT_CONTENT.eyebrow,
    title: row.title?.trim() || DEFAULT_CONTENT.title,
    intro: row.intro?.trim() || DEFAULT_CONTENT.intro,
    opensAt: ms(row.opens_at, DEFAULT_CONTENT.opensAt),
    closesAt: ms(row.closes_at, DEFAULT_CONTENT.closesAt),
    announceAt: ms(row.announce_at, DEFAULT_CONTENT.announceAt),
    confirmDeadline: ms(row.confirm_deadline, DEFAULT_CONTENT.confirmDeadline),
    steps: steps.length ? steps : DEFAULT_CONTENT.steps,
    terms: terms.length ? terms : DEFAULT_CONTENT.terms,
  };
}

/** The window as the eligibility filter wants it. */
export const windowOf = (c: CampaignContent) => ({ opensAt: c.opensAt, closesAt: c.closesAt });

/** The same dates, written the way they are shown to customers. */
export const labelsOf = (c: CampaignContent) => ({
  opens: thaiShort(c.opensAt),
  closes: thaiShort(c.closesAt),
  opensLong: thaiDate(c.opensAt),
  closesLong: thaiDate(c.closesAt),
  announce: thaiDate(c.announceAt),
  confirm: thaiDate(c.confirmDeadline),
});
