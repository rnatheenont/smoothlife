export type WidgetRow = { key: string; label_th: string; enabled: boolean; config: Record<string, unknown> };

// Every widget this codebase knows how to draw, whether or not the database
// has heard of it yet.
//
// It lived inside the public read route, which meant a widget added in code
// existed only once somebody wrote a row for it by hand — a deploy that
// silently does nothing. Both the read route and the write route read this
// now, so "the code has a widget" and "the admin can switch it on" cannot
// drift apart again.
export const WIDGET_DEFAULTS: WidgetRow[] = [
  { key: "milestone_bar", label_th: "มิลสโตนบาร์", enabled: true, config: {} },
  { key: "deal_of_day", label_th: "ดีลประจำวัน", enabled: false, config: {} },
  { key: "tiered_box", label_th: "กล่องรางวัลขั้นบันได", enabled: false, config: {} },
  { key: "promotion_card", label_th: "การ์ดโปรโมชั่น", enabled: false, config: {} },
  { key: "promotion_badge", label_th: "แบดจ์โปรโมชั่น", enabled: false, config: {} },
  { key: "cart_drawer_offer", label_th: "ข้อเสนอในตะกร้าเลื่อน", enabled: false, config: {} },
  { key: "popup", label_th: "ป๊อปอัพ", enabled: false, config: {} },
  { key: "floating_button", label_th: "ปุ่มลอย", enabled: false, config: {} },
  { key: "congrats_bar", label_th: "แถบแสดงความยินดี", enabled: false, config: {} },
  { key: "gifts_on_slide_cart", label_th: "ของแถมในตะกร้าเลื่อน", enabled: false, config: {} },
  { key: "flash_sale_bar", label_th: "แถบ Flash Sale นับถอยหลัง", enabled: false, config: {} },
  { key: "flash_sale_shelf", label_th: "แบนเนอร์ Flash Sale + ชั้นวางสินค้า", enabled: false, config: {} },
  { key: "thankyou_offer", label_th: "ข้อเสนอหน้าขอบคุณ", enabled: false, config: {} },
];

export const widgetDefault = (key: string) => WIDGET_DEFAULTS.find((w) => w.key === key);
