// The help centre's actual content, in one place.
//
// It lives here rather than inside the pages because Smoothie answers from it
// too. Two copies of a shipping policy is one copy that quietly goes stale —
// and the version customers get told in chat would be the one nobody
// remembers to update.
//
// Plain data, no React: the chat route imports this on the server and must not
// pull an icon library in with it. Pages map `icon` to a component themselves.

export type HelpFaq = { q: string; a: string };

export type HelpSection = {
  /** Key the page maps to a lucide icon. */
  icon: string;
  title: string;
  body: string;
};

export type HelpTopic = {
  href: string;
  label: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections: HelpSection[];
};

export const helpFaqs: HelpFaq[] = [
  { q: "สั่งซื้อสินค้าอย่างไร?", a: "เลือกสินค้าที่ต้องการ กดเพิ่มลงตะกร้า แล้วดำเนินการชำระเงินผ่านหน้าตะกร้าสินค้า" },
  { q: "ใช้เวลาจัดส่งกี่วัน?", a: "โดยทั่วไปจัดส่งภายใน 1-3 วันทำการทั่วประเทศไทย" },
  { q: "สินค้าของแท้หรือไม่?", a: "สินค้าทุกชิ้นนำเข้าและจัดจำหน่ายโดยตรง 100% พร้อมการรับรองจาก อย." },
  { q: "เข้าสู่ระบบด้วยวิธีไหนได้บ้าง?", a: "รองรับการเข้าสู่ระบบผ่าน OTP เบอร์โทรศัพท์, LINE Login และอีเมล" },
  {
    q: "สะสมคะแนนได้อย่างไร?",
    a: "ทุกการสั่งซื้อที่เข้าสู่ระบบแล้วจะได้รับคะแนนสะสมโดยอัตโนมัติ ดูรายละเอียดได้ที่หน้าคะแนนสะสม",
  },
];

export const helpTopics: HelpTopic[] = [
  {
    href: "/help/delivery",
    label: "การจัดส่งและคืนสินค้า",
    eyebrow: "Delivery and Returns",
    title: "การจัดส่งและคืนสินค้า",
    intro: "เราจัดส่งสินค้าอย่างรวดเร็วและปลอดภัยทั่วประเทศไทย พร้อมนโยบายคืนสินค้าที่เป็นธรรม",
    sections: [
      { icon: "truck", title: "ส่งฟรีทั่วไทย ทุกออเดอร์", body: "จัดส่งฟรีทุกคำสั่งซื้อ ไม่มียอดขั้นต่ำ ทั่วประเทศ" },
      { icon: "clock", title: "จัดส่งภายใน 1-3 วันทำการ", body: "พื้นที่กรุงเทพฯ และปริมณฑลอาจได้รับสินค้าเร็วกว่ากำหนด" },
      {
        icon: "package-search",
        title: "ติดตามพัสดุได้แบบเรียลไทม์",
        body: "ดูสถานะคำสั่งซื้อได้ที่หน้าบัญชีของฉัน > คำสั่งซื้อและติดตามพัสดุ",
      },
      {
        icon: "rotate-ccw",
        title: "คืนสินค้าได้ภายใน 14 วัน",
        body: "หากสินค้าชำรุดหรือไม่ตรงตามที่สั่ง สามารถแจ้งคืนได้ภายใน 14 วันหลังได้รับสินค้า",
      },
    ],
  },
  {
    href: "/help/payment",
    label: "การชำระเงิน",
    eyebrow: "Payment",
    title: "ช่องทางการชำระเงิน",
    intro: "เลือกวิธีการชำระเงินที่สะดวกและปลอดภัยที่สุดสำหรับคุณ",
    sections: [
      { icon: "qr-code", title: "PromptPay QR", body: "สแกนจ่ายผ่านแอปธนาคารได้ทันที ยืนยันคำสั่งซื้อรวดเร็ว" },
      {
        icon: "credit-card",
        title: "บัตรเครดิต/เดบิต",
        body: "รองรับ Visa, Mastercard และ JCB พร้อมระบบเข้ารหัสความปลอดภัย",
      },
      { icon: "banknote", title: "โอนเงินผ่านธนาคาร", body: "โอนเงินและแนบสลิปเพื่อยืนยันคำสั่งซื้อผ่านระบบอัตโนมัติ" },
      {
        icon: "truck",
        title: "เก็บเงินปลายทาง (COD)",
        body: "ชำระเงินสดเมื่อได้รับสินค้า สำหรับพื้นที่ที่รองรับบริการ",
      },
    ],
  },
];

/**
 * The same facts, flattened for the system prompt.
 *
 * Written out in full rather than summarised: the point is that Smoothie
 * quotes the published policy instead of a plausible-sounding version of it.
 */
export function helpKnowledgeForPrompt(): string {
  const topics = helpTopics
    .map((t) => `${t.title} (${t.href})\n${t.sections.map((s) => `- ${s.title}: ${s.body}`).join("\n")}`)
    .join("\n\n");
  const faqs = helpFaqs.map((f) => `- ${f.q} — ${f.a}`).join("\n");
  return `${topics}\n\nคำถามที่พบบ่อย (/help)\n${faqs}`;
}
