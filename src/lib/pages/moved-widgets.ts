import { PAGES_HOME_ENABLED } from "@/lib/feature-flags";

// Widgets whose settings have moved onto the page itself.
//
// Four of the twelve rows in free_gift_widgets were really sections of the
// home page wearing a different hat: the admin added the section in the page
// editor and it still drew nothing until somebody found the matching toggle
// on another screen, and the words inside it were edited in a third place.
// Those four now keep their settings in the section, where the thing being
// edited is visible while it is edited, and on/off is the section's own
// eye icon rather than a row in a list.
//
// The other eight are not sections at all — a popup, a floating button, the
// badge on a product card, the bar in the cart — so they stay where they are.
//
// This list is what the admin panel and the write route read to know which
// rows to stop accepting edits for, so the two cannot disagree.
export const WIDGETS_MOVED_TO_PAGES: Record<string, { section: string; page: string }> = {
  deal_of_day: { section: "ดีลประจำวัน", page: "หน้าแรก" },
  promotion_card: { section: "โปรของแถม", page: "หน้าแรก" },
  flash_sale_bar: { section: "แถบ Flash Sale", page: "หน้าแรก" },
  flash_sale_shelf: { section: "ชั้นสินค้า Flash Sale", page: "หน้าแรก" },
};

/**
 * Whether this widget's row is now read-only.
 *
 * Tied to the switch that decides which home page is served, not to the
 * deploy: while the hard-coded home page is still the live one, the widget
 * row is what it reads, so locking the row then would leave the team unable
 * to change what customers see. The moment the page system takes over, the
 * row stops being read and the panel says so.
 */
export function widgetIsReadOnly(key: string): boolean {
  return PAGES_HOME_ENABLED && key in WIDGETS_MOVED_TO_PAGES;
}
