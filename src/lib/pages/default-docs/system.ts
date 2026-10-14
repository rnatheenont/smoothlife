// With the extension, so the unit test can load this file without a bundler
// (tsconfig allows it; see src/sections/breadcrumb/trail.ts for the same
// trade made for the same reason).
import { SCHEMA_VERSION, type PageDoc } from "../doc.ts";

// The pages of wave 1, written as documents.
//
// Every one of these is the page that is already on the site, section by
// section, with the same words and the same marks. That is the whole method:
// a page moves into the system without moving on the screen, somebody checks
// that it did not, and only then does anybody edit it. A default document
// that improves the page it replaces would make that check impossible — there
// would be nothing to compare against.
//
// So the rule while writing these: if something here differs from the
// hand-written page, it is a mistake in here, not an improvement.

/**
 * A document, with its sections numbered.
 *
 * Ids are the section's type and its position, assigned here rather than by a
 * counter that keeps climbing across calls. Two things depend on that: a
 * second call has to produce the same document as the first (a test says so),
 * and the ids are what a preview click and an error report point at — "the
 * second feature_cards" is worth reading in a log, "feature_cards-47" is not.
 */
const doc = (sections: { type: string; v: number; settings: unknown }[]): PageDoc => ({
  schemaVersion: SCHEMA_VERSION,
  sections: sections.map((section, i) => ({ id: `${section.type}-${i + 1}`, ...section })),
});

type Card = { icon: string; title: string; body: string };

/** The shape every page built on ContentPage has: a header, then a grid of
 *  cards. Four of wave 1's pages are exactly this and nothing else. */
function contentPage(
  header: { eyebrow: string; title: string; intro: string; image?: string },
  cards: Card[],
  extra: { type: string; v: number; settings: unknown }[] = []
): PageDoc {
  return doc([
    {
      type: "page_header",
      v: 1,
      settings: {
        eyebrow: header.eyebrow,
        title: header.title,
        intro: header.intro,
        image: header.image ?? "",
        align: "left",
        background: "page",
      },
    },
    {
      type: "feature_cards",
      v: 1,
      settings: { heading: "", columns: "2", items: cards.map((c) => ({ ...c, href: "" })) },
    },
    ...extra,
  ]);
}

const about = (): PageDoc =>
  contentPage(
    {
      eyebrow: "Brand Story",
      title: "ทำไมต้อง Smooth Life",
      intro:
        "Smooth Life คือศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงามอันดับต้นๆ ของไทย ก่อตั้งขึ้นด้วยความตั้งใจให้ทุกคนเข้าถึงผลิตภัณฑ์คุณภาพดี ของแท้ 100% ในราคาที่เข้าถึงได้ พร้อมคำปรึกษาจากผู้เชี่ยวชาญในทุกขั้นตอน",
      image:
        "https://www.smoothlife.com/cdn/shop/files/434082539_932456655336906_65767955414828336_n.jpg?width=1200",
    },
    [
      {
        icon: "heart",
        title: "ใส่ใจทุกรายละเอียด",
        body: "คัดสรรผลิตภัณฑ์ที่ผ่านการรับรองมาตรฐานอย่างเข้มงวด เพื่อสุขภาพและความงามที่ยั่งยืน",
      },
      {
        icon: "shield",
        title: "ของแท้ 100% รับประกัน",
        body: "สินค้าทุกชิ้นนำเข้าและจัดจำหน่ายโดยตรง มีอย. รับรอง ตรวจสอบย้อนกลับได้",
      },
      {
        icon: "users",
        title: "ทีมผู้เชี่ยวชาญ",
        body: "ทีมเภสัชกรและผู้เชี่ยวชาญด้านผิวพร้อมให้คำปรึกษาฟรีทุกช่องทาง",
      },
      {
        icon: "leaf",
        title: "รับผิดชอบต่อสังคม",
        body: "ร่วมลดผลกระทบต่อสิ่งแวดล้อมผ่านบรรจุภัณฑ์ที่ยั่งยืนและกิจกรรมเพื่อสังคม",
      },
    ],
    [
      {
        type: "link_pills",
        v: 1,
        settings: {
          heading: "",
          items: [
            { label: "คุณภาพและมาตรฐาน", href: "/about/quality" },
            { label: "ผู้เชี่ยวชาญและพาร์ทเนอร์", href: "/about/experts" },
            { label: "ความรับผิดชอบต่อสังคม", href: "/about/sustainability" },
            { label: "สาขาและติดต่อเรา", href: "/stores" },
          ],
        },
      },
    ]
  );

const aboutQuality = (): PageDoc =>
  contentPage(
    {
      eyebrow: "Quality and Product Standards",
      title: "คุณภาพและมาตรฐานของเรา",
      intro:
        "ทุกผลิตภัณฑ์ที่จำหน่ายบน Smooth Life ผ่านกระบวนการตรวจสอบคุณภาพอย่างเข้มงวด ตั้งแต่แหล่งผลิตจนถึงมือคุณ",
    },
    [
      {
        icon: "badge-check",
        title: "ได้รับการรับรองจาก อย.",
        body: "ผลิตภัณฑ์ทุกชิ้นผ่านการขึ้นทะเบียนกับสำนักงานคณะกรรมการอาหารและยา",
      },
      {
        icon: "flask",
        title: "ตรวจสอบจากห้องปฏิบัติการ",
        body: "สินค้าคัดสรรผ่านการทดสอบความปลอดภัยและประสิทธิภาพก่อนวางจำหน่าย",
      },
      {
        icon: "package-check",
        title: "นำเข้าและจัดจำหน่ายโดยตรง",
        body: "ไม่ผ่านพ่อค้าคนกลาง ลดความเสี่ยงสินค้าปลอมหรือหมดอายุ",
      },
      {
        icon: "truck",
        title: "ควบคุมอุณหภูมิการจัดเก็บ",
        body: "คลังสินค้าและการขนส่งได้มาตรฐานเพื่อรักษาคุณภาพผลิตภัณฑ์",
      },
    ]
  );

const aboutExperts = (): PageDoc =>
  contentPage(
    {
      eyebrow: "Experts and Partners",
      title: "ผู้เชี่ยวชาญและพาร์ทเนอร์ของเรา",
      intro:
        "เราทำงานร่วมกับเภสัชกร แพทย์ผิวหนัง และแบรนด์พันธมิตรระดับโลก เพื่อมอบคำแนะนำและผลิตภัณฑ์ที่ดีที่สุดให้กับคุณ",
    },
    [
      {
        icon: "stethoscope",
        title: "ทีมเภสัชกรที่ปรึกษา",
        body: "พร้อมให้คำแนะนำเรื่องผลิตภัณฑ์และการใช้งานที่ถูกต้องปลอดภัย",
      },
      {
        icon: "graduation",
        title: "ที่ปรึกษาด้านผิวหนัง",
        body: "ร่วมพัฒนาเนื้อหาความรู้และตรวจสอบความถูกต้องของข้อมูลผลิตภัณฑ์",
      },
      {
        icon: "heart-handshake",
        title: "พันธมิตรแบรนด์ระดับโลก",
        body: "Smooth E, CeraVe, Bioderma, Eucerin และอีกมากมายที่ไว้วางใจให้เราเป็นตัวแทนจำหน่าย",
      },
      {
        icon: "handshake",
        title: "โครงการ Affiliate",
        body: "เปิดโอกาสให้พันธมิตรและครีเอเตอร์ร่วมแนะนำสินค้าและสร้างรายได้ไปด้วยกัน",
      },
    ]
  );

const aboutSustainability = (): PageDoc =>
  contentPage(
    {
      eyebrow: "Responsibility and Sustainability",
      title: "ความรับผิดชอบต่อสังคมและสิ่งแวดล้อม",
      intro: "เราเชื่อว่าธุรกิจที่ดีต้องเติบโตไปพร้อมกับสังคมและสิ่งแวดล้อมอย่างยั่งยืน",
    },
    [
      {
        icon: "recycle",
        title: "บรรจุภัณฑ์ยั่งยืน",
        body: "ลดใช้พลาสติกและเปลี่ยนมาใช้วัสดุที่ย่อยสลายได้ในบรรจุภัณฑ์จัดส่ง",
      },
      {
        icon: "leaf",
        title: "จัดหาอย่างรับผิดชอบ",
        body: "คัดเลือกคู่ค้าที่คำนึงถึงผลกระทบต่อสิ่งแวดล้อมในกระบวนการผลิต",
      },
      {
        icon: "users-2",
        title: "สนับสนุนชุมชน",
        body: "ร่วมกิจกรรมมอบผลิตภัณฑ์สุขภาพให้กับชุมชนและหน่วยงานที่ขาดแคลน",
      },
      {
        icon: "heart-pulse",
        title: "ส่งเสริมสุขภาพเชิงป้องกัน",
        body: "จัดกิจกรรมให้ความรู้ด้านสุขภาพและความงามแก่สาธารณะอย่างต่อเนื่อง",
      },
    ]
  );

/**
 * The default document for a system page, or nothing.
 *
 * Nothing is the honest answer for a page whose wave has not been written
 * yet: the registry knows the page exists long before its layout does, and a
 * made-up document would be a worse answer than an empty editor.
 */
export const SYSTEM_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  about,
  "about-quality": aboutQuality,
  "about-experts": aboutExperts,
  "about-sustainability": aboutSustainability,
};
