// The campaign types, as the app on Shopify lists them.
//
// Underneath, this shop has one campaign table with four dials on it — what
// the condition counts, whether the ladder has rungs, what the reward is, and
// who it is for. The app sells nine named campaigns instead, which is a
// better way to *choose*: nobody opening the screen is thinking "tiered,
// quantity, order_discount", they are thinking "bigger discounts the more
// they buy".
//
// So the names are the front door and the dials are what they set. A type is
// a preset, not a new kind of row: a campaign created as an Order Goal can
// still be edited into anything else afterwards, and nothing downstream
// cares which card was clicked.

export type CampaignPreset = {
  key: string;
  title: string;
  blurb: string;
  example: string;
  /** What picking this card sets on the form. */
  preset: {
    kind: "spend" | "bxgy" | "tiered";
    rewardType: "gift" | "order_discount";
    triggerType: "cart-value" | "quantity";
  };
  /** Open the sub-conditions straight away, for the types that are about them. */
  openSubConditions?: boolean;
};

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    key: "bxgy",
    title: "ซื้อ X แถม Y",
    blurb: "ซื้อสินค้าที่กำหนด แล้วได้ของแถม",
    example: "ซื้อยาสีฟัน 2 หลอด แถมแปรง 1 ด้าม",
    preset: { kind: "bxgy", rewardType: "gift", triggerType: "quantity" },
  },
  {
    key: "gift-cart-value",
    title: "ซื้อครบยอด แถมของ",
    blurb: "ยิ่งซื้อถึงยอดที่กำหนด ได้ของแถมฟรี",
    example: "ซื้อครบ ฿990 รับถุงผ้า",
    preset: { kind: "spend", rewardType: "gift", triggerType: "cart-value" },
  },
  {
    key: "milestone",
    title: "ขั้นบันไดของแถม",
    blurb: "ยิ่งซื้อเยอะ ยิ่งได้ของแถมมากขึ้นทีละระดับ",
    example: "฿699 ได้ 1 ชิ้น · ฿1,599 ได้ 4 ชิ้น",
    preset: { kind: "tiered", rewardType: "gift", triggerType: "cart-value" },
  },
  {
    key: "gift-quantity",
    title: "ซื้อครบจำนวน แถมของ",
    blurb: "นับเป็นจำนวนชิ้น ไม่ใช่จำนวนเงิน",
    example: "ซื้อครบ 3 ชิ้น รับของแถม",
    preset: { kind: "spend", rewardType: "gift", triggerType: "quantity" },
  },
  {
    key: "gift-collection",
    title: "ซื้อเฉพาะแบรนด์/หมวด แถมของ",
    blurb: "นับเฉพาะสินค้าในแบรนด์หรือหมวดที่เลือก",
    example: "ซื้อ Smooth E ครบ ฿800 รับของแถม",
    preset: { kind: "spend", rewardType: "gift", triggerType: "cart-value" },
    openSubConditions: true,
  },
  {
    key: "order-goal",
    title: "ยิ่งซื้อยิ่งลด (ตามยอด)",
    blurb: "ส่วนลดท้ายบิลเพิ่มขึ้นทีละระดับตามยอดซื้อ",
    example: "฿500 ลด 10% · ฿1,000 ลด 15%",
    preset: { kind: "tiered", rewardType: "order_discount", triggerType: "cart-value" },
  },
  {
    key: "volume",
    title: "ยิ่งซื้อยิ่งลด (ตามจำนวน)",
    blurb: "ส่วนลดท้ายบิลตามจำนวนชิ้นที่ซื้อ",
    example: "ซื้อ 4 ชิ้นขึ้นไป ลด 25%",
    preset: { kind: "spend", rewardType: "order_discount", triggerType: "quantity" },
  },
  {
    key: "custom",
    title: "เงื่อนไขกำหนดเอง",
    blurb: "รวมหลายเงื่อนไข และเจาะกลุ่มลูกค้าได้",
    example: "สมาชิก Gold ซื้อครบ ฿1,000 และครบ 3 ชิ้น",
    preset: { kind: "spend", rewardType: "gift", triggerType: "cart-value" },
    openSubConditions: true,
  },
];
