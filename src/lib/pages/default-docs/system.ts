// With the extension, so the unit test can load this file without a bundler
// (tsconfig allows it; see src/sections/breadcrumb/trail.ts for the same
// trade made for the same reason).
import { type PageDoc } from "../doc.ts";
import { doc } from "./build.ts";
import { WAVE2_DEFAULT_DOCS } from "./system-wave2.ts";

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


const helpDelivery = (): PageDoc =>
  contentPage(
    {
      eyebrow: "Delivery and Returns",
      title: "การจัดส่งและคืนสินค้า",
      intro: "เราจัดส่งสินค้าอย่างรวดเร็วและปลอดภัยทั่วประเทศไทย พร้อมนโยบายคืนสินค้าที่เป็นธรรม",
    },
    [{"icon": "truck", "title": "ส่งฟรีทั่วไทย ทุกออเดอร์", "body": "จัดส่งฟรีทุกคำสั่งซื้อ ไม่มียอดขั้นต่ำ ทั่วประเทศ"}, {"icon": "clock", "title": "จัดส่งภายใน 1-3 วันทำการ", "body": "พื้นที่กรุงเทพฯ และปริมณฑลอาจได้รับสินค้าเร็วกว่ากำหนด"}, {"icon": "package-search", "title": "ติดตามพัสดุได้แบบเรียลไทม์", "body": "ดูสถานะคำสั่งซื้อได้ที่หน้าบัญชีของฉัน > คำสั่งซื้อและติดตามพัสดุ"}, {"icon": "rotate-ccw", "title": "คืนสินค้าได้ภายใน 14 วัน", "body": "หากสินค้าชำรุดหรือไม่ตรงตามที่สั่ง สามารถแจ้งคืนได้ภายใน 14 วันหลังได้รับสินค้า"}]
  );

const helpPayment = (): PageDoc =>
  contentPage(
    {
      eyebrow: "Payment",
      title: "ช่องทางการชำระเงิน",
      intro: "เลือกวิธีการชำระเงินที่สะดวกและปลอดภัยที่สุดสำหรับคุณ",
    },
    [{"icon": "qr-code", "title": "PromptPay QR", "body": "สแกนจ่ายผ่านแอปธนาคารได้ทันที ยืนยันคำสั่งซื้อรวดเร็ว"}, {"icon": "credit-card", "title": "บัตรเครดิต/เดบิต", "body": "รองรับ Visa, Mastercard และ JCB พร้อมระบบเข้ารหัสความปลอดภัย"}, {"icon": "banknote", "title": "โอนเงินผ่านธนาคาร", "body": "โอนเงินและแนบสลิปเพื่อยืนยันคำสั่งซื้อผ่านระบบอัตโนมัติ"}, {"icon": "truck", "title": "เก็บเงินปลายทาง (COD)", "body": "ชำระเงินสดเมื่อได้รับสินค้า สำหรับพื้นที่ที่รองรับบริการ"}]
  );

/** The help centre's front door: the title, the three ways in, and the
 *  questions. The cards are the same topics the sub-pages are built from,
 *  written out here because the document is what the editor edits — a
 *  document that read src/data/help.ts at render time would be a page the
 *  admin could not change, wearing a section's clothes. */
const help = (): PageDoc =>
  doc([
    {
      type: "page_header",
      v: 1,
      settings: {
        eyebrow: "",
        title: "ศูนย์ช่วยเหลือ",
        intro: "เรามีคำตอบให้ทุกคำถามของคุณ",
        image: "",
        align: "left",
        background: "page",
        layout: "document",
      },
    },
    { type: "help_topics", v: 1, settings: { items: [{"icon": "truck", "label": "การจัดส่งและคืนสินค้า", "href": "/help/delivery"}, {"icon": "qr-code", "label": "การชำระเงิน", "href": "/help/payment"}, {"icon": "message-circle", "label": "แชทและติดต่อเรา", "href": "/help/contact"}] } },
    {
      type: "faq",
      v: 1,
      settings: { heading: "คำถามที่พบบ่อย", source: "help", items: [] },
    },
  ]);


const promotions = (): PageDoc =>
  doc([
    {
      type: "page_header",
      v: 1,
      settings: {
        eyebrow: "",
        title: "New, Best Sellers and Promotions",
        intro: "รวมโปรโมชั่นและดีลพิเศษประจำเดือนจาก Smooth Life",
        image: "",
        align: "left",
        background: "page",
        layout: "document",
      },
    },
    { type: "promo_list", v: 1, settings: { perPromo: 4, items: [{"slug": "buy-1-get-1-free-deal", "badge": "BOGO", "title": "Buy 1 Get 1 Free", "subtitle": "ซื้อ 1 แถม 1 เฉพาะสินค้าคัดสรร", "image": "/promotions/buy-1-get-1-free-deal.jpg"}, {"slug": "bundel-set-smoothlife", "badge": "Bundle", "title": "Bundle Deal", "subtitle": "รวมเซ็ตคุ้มค่า ประหยัดกว่าซื้อแยก", "image": "/promotions/bundel-set-smoothlife.jpg"}, {"slug": "clearance-sale", "badge": "Sale", "title": "Clearance Sale", "subtitle": "ลดสูงสุด 70% สินค้าคัดสรรพิเศษ", "image": "/promotions/clearance-sale.jpg"}, {"slug": "special-promotion", "badge": "Promotion", "title": "Special Promotion", "subtitle": "โปรโมชั่นพิเศษประจำเดือน", "image": "/promotions/special-promotion.jpg"}] } },
  ]);


/** One locked section and nothing else: on this page the heading, the link
 *  beside it and the table are one layout, so the section owns all three. */
const loyalty = (): PageDoc =>
  doc([
    {
      type: "tier_cards",
      v: 1,
      settings: {
        title: "สิทธิสมาชิกแต่ละระดับ",
        intro: "คำนวณจากยอดใช้จ่ายสะสม 12 เดือน (หรือจำนวนออเดอร์) อัปเดตอัตโนมัติทุกวัน",
        linkLabel: "ไปที่บัญชี →",
        linkHref: "/account",
        rows: [{"label": "อัตราแต้มสะสม", "values": ["1 แต้ม / ฿1", "1 แต้ม / ฿1", "1 แต้ม / ฿1"]}, {"label": "แต้มจากรีวิวสินค้า", "values": ["+5 ถึง +30 แต้ม", "+5 ถึง +30 แต้ม", "+5 ถึง +30 แต้ม"]}, {"label": "คูปองแนะนำเพื่อน", "values": ["฿100 / เพื่อน 1 คน", "฿100 / เพื่อน 1 คน", "฿100 / เพื่อน 1 คน"]}, {"label": "โบนัสวันเกิด", "values": ["+100 แต้ม", "+200 แต้ม + ลด 10%", "+300 แต้ม + ลด 20%"]}, {"label": "อายุแต้มสะสม", "values": ["12 เดือน/ก้อน", "12 เดือน/ก้อน", "12 เดือน/ก้อน"]}],
        footnote: "สิทธิ์บางอย่างต้องมีประวัติสั่งซื้อสินค้าจริงก่อนจึงจะได้รับ (เช่น โบนัสวันเกิด)",
      },
    },
  ]);


/** The page with no network. It fills the screen it is apologising for, and
 *  everything on it works without the connection it is about. */
const offline = (): PageDoc =>
  doc([
    {
      type: "page_state",
      v: 1,
      settings: {
        icon: "wifi-off",
        image: "",
        display: "",
        title: "ตอนนี้ไม่ได้เชื่อมต่ออินเทอร์เน็ต",
        body: "หน้านี้ต้องใช้เน็ตในการโหลดข้อมูลล่าสุด — ราคาและสต็อกเปลี่ยนได้ตลอด เราเลยไม่เก็บของเก่าไว้ให้ดู ลองเชื่อมต่อใหม่แล้วกดโหลดอีกครั้งได้เลยค่ะ",
        button: "ลองใหม่อีกครั้ง",
        href: "/",
        fill: true,
      },
    },
  ]);

/** The page for an address the shop does not have. */
const notFoundPage = (): PageDoc =>
  doc([
    {
      type: "page_state",
      v: 1,
      settings: {
        icon: "",
        image: "/mascot/smoothie-say.png",
        display: "404",
        title: "ไม่พบหน้าที่คุณต้องการ",
        body: "",
        button: "กลับหน้าแรก",
        href: "/",
        fill: false,
      },
    },
  ]);


const stores = (): PageDoc =>
  doc([
    {
      type: "page_header",
      v: 1,
      settings: {
        eyebrow: "",
        title: "สาขาและติดต่อเรา",
        intro: "พบกับเราได้ที่สาขาทั่วประเทศ หรือติดต่อทีมงานผ่านช่องทางออนไลน์",
        image: "",
        align: "left",
        background: "page",
        layout: "document",
      },
    },
    { type: "store_list", v: 1, settings: { items: [{"name": "Smooth Life Flagship — สยามพารากอน", "address": "991 ถ.พระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330", "hours": "ทุกวัน 10:00 - 21:00", "phone": "02-123-4567"}, {"name": "Smooth Life — เซ็นทรัลเวิลด์", "address": "999/9 ถ.พระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330", "hours": "ทุกวัน 10:00 - 22:00", "phone": "02-234-5678"}, {"name": "Smooth Life — เมกาบางนา", "address": "39 ถ.บางนา-ตราด กม.8 บางแก้ว บางพลี สมุทรปราการ 10540", "hours": "ทุกวัน 10:00 - 21:00", "phone": "02-345-6789"}, {"name": "Smooth Life — เซ็นทรัล เชียงใหม่ แอร์พอร์ต", "address": "2 ถ.มหิดล ต.หายยา อ.เมือง เชียงใหม่ 50100", "hours": "ทุกวัน 10:00 - 21:00", "phone": "05-312-3456"}] } },
    { type: "contact_channels", v: 1, settings: { heading: "ติดต่อฝ่ายบริการลูกค้า", style: "cards" } },
  ]);


const aiAssistant = (): PageDoc =>
  doc([
    {
      type: "page_header",
      v: 1,
      settings: {
        eyebrow: "ผู้ช่วย AI",
        eyebrowIcon: "sparkles",
        title: "เลือกแบบทดสอบที่ใช่สำหรับคุณ",
        intro: "ให้น้อง Smoothie ช่วยแนะนำสินค้าที่ตรงกับความต้องการของคุณ",
        image: "",
        mascot: "/mascot/smoothie-hi.png",
        align: "left",
        background: "page",
        layout: "page",
      },
    },
    { type: "tool_cards", v: 1, settings: { heading: "", items: [{"icon": "", "title": "น้อง Smoothie", "subtitle": "ผู้ช่วย AI แนะนำสกินแคร์และวิเคราะห์ผิวให้คุณ", "href": "/advisor"}, {"icon": "", "title": "สแกนผิวกับน้อง Smoothie", "subtitle": "วิเคราะห์ผิวจากภาพถ่าย เพื่อความสวยงามเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์", "href": "/skin-coach"}, {"icon": "", "title": "Oral Care Advisor", "subtitle": "ตอบ 3 คำถาม รับเซ็ตดูแลช่องปากที่ใช่สำหรับคุณ", "href": "/oral-care-advisor"}, {"icon": "", "title": "Supplement Advisor", "subtitle": "ตอบ 5 คำถาม รับแพลนอาหารเสริมที่ตรงเป้าหมายและงบของคุณ", "href": "/supplement-advisor"}] } },
  ]);

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
  help,
  "help-delivery": helpDelivery,
  "help-payment": helpPayment,
  promotions,
  loyalty,
  offline,
  "not-found": notFoundPage,
  stores,
  "ai-assistant": aiAssistant,
  ...WAVE2_DEFAULT_DOCS,
};
