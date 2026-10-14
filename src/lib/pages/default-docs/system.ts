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


/** The shape /privacy and /terms share: a narrow column, a title with a
 *  one-line summary, headed clauses of bullets, and a line at the foot
 *  saying where to ask about it. The contents is off because the pages it
 *  replaces do not have one — it is there for whoever decides they should. */
function legalPage(
  header: { title: string; intro: string },
  body: string,
  footnote: string
): PageDoc {
  return doc([
    {
      type: "page_header",
      v: 1,
      settings: {
        eyebrow: "",
        title: header.title,
        intro: "",
        image: "",
        align: "left",
        background: "page",
        layout: "document",
      },
    },
    {
      type: "legal_document",
      v: 1,
      settings: {
        intro: header.intro,
        body,
        updatedAt: "",
        showToc: false,
        footnote,
        footnoteLinkLabel: "ศูนย์ช่วยเหลือ",
        footnoteHref: "/help",
      },
    },
  ]);
}

const privacy = (): PageDoc =>
  legalPage(
    {
      title: "นโยบายความเป็นส่วนตัว",
      intro: "นโยบายนี้อธิบายว่า Smoothlife.com เก็บรวบรวม ใช้ และดูแลข้อมูลส่วนบุคคลของคุณอย่างไร",
    },
    "## ข้อมูลที่เราเก็บรวบรวม\n\n- ข้อมูลบัญชี: ชื่อ, เบอร์โทรศัพท์, อีเมล, เพศ และวันเกิด (เฉพาะที่คุณกรอกเอง)\n- ที่อยู่จัดส่งและที่อยู่สำหรับใบกำกับภาษี ที่คุณบันทึกไว้ในบัญชี\n- ประวัติคำสั่งซื้อและคะแนนสะสม\n- รูปภาพที่คุณอัปโหลดเพื่อวิเคราะห์ผิวหรือถามคำถามในแชท (ใช้ประมวลผลชั่วคราวเท่านั้น ไม่จัดเก็บไว้บนเซิร์ฟเวอร์ของเรา)\n- รีวิวและคำถามที่คุณโพสต์ในหน้าสินค้า (แสดงชื่อที่ใช้ในบัญชี)\n- อีเมลที่ใช้สมัครรับข่าวสาร (หากคุณสมัคร)\n- ข้อมูลการใช้งานเว็บไซต์ เช่น ตะกร้าสินค้า สินค้าที่ถูกใจ และภาษาที่เลือกใช้ (จัดเก็บในเบราว์เซอร์ของคุณ)\n\n## เราใช้ข้อมูลของคุณอย่างไร\n\n- ดำเนินการสั่งซื้อ จัดส่งสินค้า และออกใบกำกับภาษี\n- ยืนยันตัวตนเมื่อเข้าสู่ระบบผ่าน OTP, LINE Login หรืออีเมล\n- คำนวณและจัดการคะแนนสะสม/สิทธิประโยชน์สมาชิก\n- ให้คำแนะนำสินค้าที่เหมาะกับคุณผ่านผู้ช่วย AI (น้อง Smoothie) โดยอ้างอิงจากคำตอบแบบประเมินและตะกร้าสินค้าของคุณ\n- แจ้งโปรโมชั่นหรือข่าวสาร หากคุณสมัครรับข่าวสาร\n- ปรับปรุงและแก้ไขปัญหาการใช้งานเว็บไซต์\n\n## การเปิดเผยข้อมูลให้บุคคลที่สาม\n\n- เราแชร์ข้อมูลที่จำเป็นกับผู้ให้บริการที่เกี่ยวข้องกับการดำเนินธุรกิจ เช่น ระบบร้านค้าและจัดการคำสั่งซื้อ (Shopify), ผู้ให้บริการฐานข้อมูล (Supabase), ผู้ให้บริการยืนยันตัวตน (เช่น Firebase สำหรับ OTP และ LINE สำหรับ LINE Login) และผู้ให้บริการ AI สำหรับผู้ช่วยแชทและวิเคราะห์ภาพ (Anthropic)\n- เราไม่ขายข้อมูลส่วนบุคคลของคุณให้บุคคลที่สามเพื่อวัตถุประสงค์ทางการตลาด\n\n## คุกกี้และการจัดเก็บข้อมูลในเบราว์เซอร์\n\n- เราใช้คุกกี้ที่จำเป็น (เช่น การเข้าสู่ระบบ) และจัดเก็บข้อมูล เช่น ตะกร้าสินค้า สินค้าที่ถูกใจ และภาษาที่เลือก ไว้ในเบราว์เซอร์ของคุณ (localStorage) เพื่อให้ใช้งานเว็บไซต์ได้สะดวกขึ้น\n\n## สิทธิของคุณ\n\n- คุณสามารถเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลในบัญชีของคุณได้ด้วยตัวเองผ่านหน้าบัญชีผู้ใช้\n- คุณสามารถขอลบบัญชีและข้อมูลที่เกี่ยวข้อง หรือถอนความยินยอมในการรับข่าวสาร ได้โดยติดต่อทีมงานผ่านหน้าช่วยเหลือ\n\n## ความปลอดภัยของข้อมูล\n\n- เราจัดเก็บข้อมูลของคุณบนระบบฐานข้อมูลที่มีการควบคุมสิทธิ์การเข้าถึง และเข้ารหัสการเชื่อมต่อ (HTTPS) ระหว่างเบราว์เซอร์ของคุณกับเซิร์ฟเวอร์ของเรา",
    "หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ กรุณาติดต่อทีมงานผ่าน"
  );

const terms = (): PageDoc =>
  legalPage(
    {
      title: "เงื่อนไขการใช้บริการ",
      intro: "กรุณาอ่านเงื่อนไขการใช้บริการนี้ก่อนใช้งาน Smoothlife.com",
    },
    "## การใช้งานเว็บไซต์\n\n- การใช้งาน Smoothlife.com ถือว่าคุณยอมรับเงื่อนไขการใช้บริการนี้\n- คุณต้องให้ข้อมูลที่ถูกต้องและเป็นจริงเมื่อสมัครสมาชิกหรือสั่งซื้อสินค้า\n- ห้ามใช้เว็บไซต์เพื่อวัตถุประสงค์ที่ผิดกฎหมาย หรือกระทบต่อการให้บริการแก่ผู้ใช้งานรายอื่น\n\n## สินค้าและราคา\n\n- สินค้าทุกชิ้นเป็นของแท้ 100% ตามที่ระบุไว้ในหน้ารายละเอียดสินค้า\n- ราคาสินค้าอาจมีการเปลี่ยนแปลงได้โดยไม่ต้องแจ้งให้ทราบล่วงหน้า ราคาที่ต้องชำระคือราคาที่แสดง ณ เวลาที่คุณทำการสั่งซื้อ\n- รูปภาพสินค้าใช้เพื่อการนำเสนอ สี/ลักษณะจริงของสินค้าอาจแตกต่างจากภาพเล็กน้อย\n\n## การสั่งซื้อและการชำระเงิน\n\n- คำสั่งซื้อจะได้รับการยืนยันหลังจากชำระเงินสำเร็จ\n- รองรับการชำระเงินผ่าน PromptPay, บัตรเครดิต/เดบิต, โอนเงิน หรือเก็บเงินปลายทางตามช่องทางที่เปิดให้บริการ\n- เราขอสงวนสิทธิ์ในการยกเลิกคำสั่งซื้อในกรณีที่สินค้าหมดสต็อกหรือพบความผิดปกติของคำสั่งซื้อ โดยจะแจ้งและคืนเงินให้ตามช่องทางที่ชำระ\n\n## การจัดส่งและการคืนสินค้า\n\n- จัดส่งสินค้าภายใน 1-3 วันทำการทั่วประเทศไทย ส่งฟรีเมื่อซื้อครบตามยอดที่กำหนด\n- รับคืนสินค้าได้ภายใน 14 วันหลังได้รับสินค้า สินค้าต้องอยู่ในสภาพสมบูรณ์ ไม่ผ่านการใช้งาน พร้อมบรรจุภัณฑ์เดิม\n\n## คะแนนสะสมและสิทธิพิเศษสมาชิก\n\n- คะแนนสะสมคำนวณจากยอดสั่งซื้อสุทธิหลังหักส่วนลด และจะเข้าบัญชีเมื่อคำสั่งซื้อเสร็จสมบูรณ์\n- เราขอสงวนสิทธิ์ในการปรับเปลี่ยนเงื่อนไขคะแนนสะสมและสิทธิพิเศษสมาชิกได้ตามความเหมาะสม\n\n## เนื้อหาที่ผู้ใช้เป็นผู้สร้าง (รีวิวและคำถาม)\n\n- รีวิวและคำถามที่คุณโพสต์ต้องเป็นความจริง สุภาพ และไม่ละเมิดสิทธิ์ผู้อื่น\n- เราขอสงวนสิทธิ์ในการลบเนื้อหาที่ไม่เหมาะสม หรือขัดต่อเงื่อนไขนี้ โดยไม่ต้องแจ้งล่วงหน้า\n\n## คำแนะนำจากผู้ช่วย AI\n\n- คำแนะนำจากน้อง Smoothie (ผู้ช่วย AI) เป็นข้อมูลทั่วไปเพื่อประกอบการตัดสินใจซื้อสินค้าเท่านั้น ไม่ใช่คำวินิจฉัยหรือคำแนะนำทางการแพทย์ หากมีข้อสงสัยด้านสุขภาพ ควรปรึกษาแพทย์หรือเภสัชกร",
    "หากมีคำถามเกี่ยวกับเงื่อนไขการใช้บริการนี้ กรุณาติดต่อทีมงานผ่าน"
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
  privacy,
  terms,
};
