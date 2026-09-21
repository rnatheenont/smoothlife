import type { Metadata } from "next";
import { withSeoOverride } from "@/lib/seo-overrides";

// The pages that are not generated from the catalogue.
//
// Products, categories, concerns and brands get their title and description
// from the thing they are about. The rest of the site — the shop index, the
// help centre, the knowledge hub — had a bare `title` written inline and no
// description at all, so Google wrote its own snippet for every one of them,
// and nobody could change a word of it without a deploy.
//
// Keeping them in one list is what makes them editable in /admin/seo like
// everything else: a page here is a row the team can override, and the text
// below is only the default it falls back to.

export const SITE_TITLE = "Smoothlife.com — สุขภาพและความงามครบวงจร";
export const SITE_DESCRIPTION =
  "Smoothlife.com ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม ช้อปง่าย ครบจบทุก lifestyle ที่เดียว";

export type SitePage = {
  /** The seo_overrides page_key, and the id used in the admin list. */
  key: string;
  path: string;
  /** What this page is called in the admin list. */
  label: string;
  title: string;
  description: string;
};

export const SITE_PAGES: SitePage[] = [
  {
    key: "home",
    path: "/",
    label: "หน้าแรก",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  {
    key: "shop",
    path: "/shop",
    label: "สินค้าทั้งหมด",
    title: "ช้อปสินค้าสุขภาพและความงามทั้งหมด | Smoothlife.com",
    description:
      "รวมสินค้าดูแลผิว ช่องปาก เส้นผม ผิวกาย และอาหารเสริมจากแบรนด์ชั้นนำ ของแท้ 100% มี อย. ส่งฟรีทั่วไทยไม่มียอดขั้นต่ำ",
  },
  {
    key: "brands",
    path: "/brands",
    label: "แบรนด์ทั้งหมด",
    title: "แบรนด์ทั้งหมดที่เราจำหน่าย | Smoothlife.com",
    description:
      "รวมแบรนด์สุขภาพและความงามที่ Smoothlife.com จำหน่าย ทั้ง Smooth E, Smooth Life, Dentiste และแบรนด์ชั้นนำอื่น ๆ ของแท้จากผู้จัดจำหน่าย",
  },
  {
    key: "concern",
    path: "/concern",
    label: "เลือกตามปัญหา",
    title: "เลือกสินค้าตามปัญหาที่กังวล | Smoothlife.com",
    description:
      "สิว ผิวแห้ง จุดด่างดำ ริ้วรอย ปัญหาเส้นผมและหนังศีรษะ นอนไม่หลับ — เลือกดูสินค้าที่ตรงกับปัญหาของคุณโดยตรง",
  },
  {
    key: "collections",
    path: "/collections",
    label: "คอลเลกชันทั้งหมด",
    title: "คอลเลกชันทั้งหมด | Smoothlife.com",
    description: "รวมทุกคอลเลกชันและโปรโมชันจาก Smoothlife.com เลือกดูตามแคมเปญและชุดสินค้าที่ทีมคัดมาให้",
  },
  {
    key: "promotions",
    path: "/promotions",
    label: "โปรโมชั่น",
    title: "โปรโมชั่นและดีลเด็ด | Smoothlife.com",
    description: "รวมสินค้าลดราคา ซื้อ 1 แถม 1 และเซ็ตสุดคุ้มที่กำลังจำหน่ายอยู่จริงบน Smoothlife.com",
  },
  {
    key: "knowledge",
    path: "/knowledge",
    label: "ความรู้",
    title: "ความรู้เรื่องผิว สุขภาพ และการดูแลตัวเอง | Smoothlife.com",
    description: "บทความ วิธีใช้ และคำแนะนำเรื่องการดูแลผิว ช่องปาก เส้นผม และสุขภาพ จากทีมงาน Smoothlife.com",
  },
  {
    key: "knowledge-questions",
    path: "/knowledge/questions",
    label: "คำถามที่พบบ่อย",
    title: "คำถามที่พบบ่อย | Smoothlife.com",
    description: "คำถามที่ลูกค้าถามเข้ามาจริง พร้อมคำตอบจากทีมงาน Smoothlife.com",
  },
  {
    key: "about",
    path: "/about",
    label: "เกี่ยวกับเรา",
    title: "ทำไมต้อง Smooth Life | Smoothlife.com",
    description: "เรื่องราว มาตรฐานคุณภาพ และผู้เชี่ยวชาญที่อยู่เบื้องหลังสินค้าที่เราคัดมาจำหน่าย",
  },
  {
    key: "stores",
    path: "/stores",
    label: "สาขาและติดต่อเรา",
    title: "สาขาและช่องทางติดต่อ | Smoothlife.com",
    description: "ที่ตั้งสาขา เวลาทำการ และช่องทางติดต่อทีมงาน Smoothlife.com ทั้งโทรศัพท์ อีเมล และ LINE",
  },
  {
    key: "help",
    path: "/help",
    label: "ศูนย์ช่วยเหลือ",
    title: "ศูนย์ช่วยเหลือ: จัดส่ง ชำระเงิน คืนสินค้า | Smoothlife.com",
    description: "คำตอบเรื่องการจัดส่ง การชำระเงิน การคืนสินค้าภายใน 14 วัน และวิธีติดต่อทีมงาน",
  },
  {
    key: "loyalty",
    path: "/loyalty",
    label: "สิทธิสมาชิก",
    title: "สิทธิสมาชิกและการสะสมแต้ม | Smoothlife.com",
    description: "สมัครสมาชิกฟรีรับ 100 คะแนน สะสมแต้มจากทุกยอดซื้อ แลกเป็นส่วนลดและสิทธิพิเศษตามระดับสมาชิก",
  },
  {
    key: "subscription",
    path: "/subscription",
    label: "สมัครสมาชิกรายรอบ",
    title: "สมัครรับสินค้าประจำรายรอบ | Smoothlife.com",
    description: "เลือกสินค้าที่ใช้ประจำ กำหนดรอบส่งเอง 3 / 6 หรือ 12 เดือน ยิ่งรอบยาวยิ่งได้ส่วนลดมากขึ้น",
  },
  {
    key: "advisor",
    path: "/advisor",
    label: "ผู้ช่วยเลือกสินค้า",
    title: "น้อง Smoothie ผู้ช่วยเลือกสกินแคร์ | Smoothlife.com",
    description: "ตอบไม่กี่คำถามหรือสแกนผิวด้วยกล้องหน้า ให้ผู้ช่วย AI แนะนำสินค้าที่เหมาะกับผิวและปัญหาของคุณ",
  },
];

export function getSitePage(key: string) {
  return SITE_PAGES.find((p) => p.key === key);
}

/**
 * The metadata for one of those pages, with whatever the team has written in
 * /admin/seo layered over the default.
 *
 * openGraph is set here too: without it a shared link falls back to the site
 * title from the root layout, so every page of the site looked identical in a
 * LINE or Facebook preview.
 */
export async function pageMetadata(key: string): Promise<Metadata> {
  const page = getSitePage(key);
  if (!page) return {};
  const meta = await withSeoOverride("page", page.key, {
    title: page.title,
    description: page.description,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: page.path },
    openGraph: { title: meta.title, description: meta.description, url: page.path },
  };
}
