"use client";

import { createContext, useContext } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Inbox,
  MessageSquareText,
  Truck,
  Users,
  Receipt,
  Award,
  CreditCard,
  Zap,
  Gift,
  SlidersHorizontal,
  Repeat,
  BookOpen,
  Search,
  FileText,
  TrendingUp,
  MessageCircle,
  Palette,
  ScrollText,
  UserCog,
} from "lucide-react";

// The console's map of itself, in one place.
//
// The sidebar held this list and the overview page held a second copy: twelve
// of the twenty screens, in a different order, with their own descriptions
// and — the part that mattered — no permission field at all, so a role
// without gift_cards.manage was shown a card that bounced them at the door.
// Two lists of the same thing drift, and this one had.
//
// `desc` moved here from that second copy so the two screens cannot disagree
// about what a page is for. `tone` is new: the overview groups its shortcuts
// the way the sidebar groups its links, and a colour per group is what lets
// somebody find the one they want without reading twenty labels.

const CAMPAIGNS_LABEL = "กิจกรรม";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line on what you go there to do. */
  desc?: string;
  /** The permission needed to open it; null when every role may. */
  permission?: string | null;
  /** The accounts screen, which only the owner may open. */
  ownerOnly?: boolean;
};

/** Which family a group belongs to, carried as a colour so the overview can be
 *  scanned by shape rather than read line by line. */
export type NavTone = "brand" | "sky" | "amber" | "violet" | "slate";

export const TONE_TILE: Record<NavTone, string> = {
  brand: "bg-brand-gradient-soft text-brand-800",
  sky: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  slate: "bg-slate-100 text-slate-600",
};

export type NavGroup = { label: string; tone: NavTone; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    tone: "brand",
    items: [
      {
        href: "/admin",
        label: "ภาพรวม",
        icon: LayoutDashboard,
        permission: null,
      },
    ],
  },
  {
    // Queues: things that arrive on their own and wait for a person.
    label: "งานประจำวัน",
    tone: "brand",
    items: [
      {
        href: "/admin/inbox",
        label: "กล่องข้อความ",
        icon: Inbox,
        desc: "ตอบแชทลูกค้าทุกช่องทางจากที่เดียว",
        permission: "inbox.manage",
      },
      {
        href: "/admin/reviews",
        label: "รีวิวรออนุมัติ",
        icon: MessageSquareText,
        desc: "ตรวจรีวิวก่อนขึ้นหน้าเว็บ",
        permission: "reviews.manage",
      },
      {
        href: "/admin/tracking-sync",
        label: "เลขพัสดุจากคลัง",
        icon: Truck,
        desc: "ดึงเลขพัสดุจาก soko เข้า Shopify",
        permission: "tracking_sync.manage",
      },
    ],
  },
  {
    label: "ลูกค้า & การเงิน",
    tone: "sky",
    items: [
      {
        href: "/admin/customers",
        label: "ลูกค้า & บัญชีผู้ใช้",
        icon: Users,
        desc: "ค้นหาลูกค้าและผูกบัญชี LINE",
        permission: "customers.manage",
      },
      {
        href: "/admin/checkout-transactions",
        label: "การชำระเงิน & คืนเงิน",
        icon: Receipt,
        desc: "ตรวจการชำระเงินและคืนเงิน",
        permission: "checkout.view",
      },
      {
        href: "/admin/points",
        label: "แต้มสะสม & ของรางวัล",
        icon: Award,
        desc: "ปรับแต้มลูกค้าและตั้งของรางวัล",
        permission: "points.view",
      },
      {
        href: "/admin/gift-cards",
        label: "บัตรของขวัญ",
        icon: CreditCard,
        desc: "ออกและตรวจสอบบัตรของขวัญ",
        permission: "gift_cards.manage",
      },
    ],
  },
  {
    label: "การขาย & โปรโมชั่น",
    tone: "amber",
    items: [
      {
        href: "/admin/flash-sale",
        label: "Events",
        icon: Zap,
        desc: "ตั้งแคมเปญ คิวจริง และหน้าขายแบบพิเศษ",
        permission: "flash_sale.view",
      },
      {
        href: "/admin/campaigns",
        label: CAMPAIGNS_LABEL,
        icon: Receipt,
        desc: "ตรวจใบเสร็จและผู้ร่วมแคมเปญ",
        permission: "receipts.view",
      },
      {
        href: "/admin/free-gifts",
        label: "ของแถม & โปรโมชั่น",
        icon: Gift,
        desc: "ของแถมและแคมเปญหน้าร้าน",
        permission: "free_gifts.manage",
      },
      {
        href: "/admin/free-gifts/widgets",
        label: "กล่องโปรโมชั่นหน้าเว็บ",
        icon: SlidersHorizontal,
        desc: "เปิด/ปิดกล่องโปรโมชั่นบนหน้าร้าน",
        permission: "free_gifts.manage",
      },
      {
        href: "/admin/subscription-products",
        label: "สินค้าสมัครรับประจำ",
        icon: Repeat,
        desc: "เลือกสินค้าที่สมัครรับประจำได้",
        permission: "subscription_products.manage",
      },
    ],
  },
  {
    label: "เนื้อหา & การค้นหา",
    tone: "violet",
    items: [
      {
        href: "/admin/knowledge-base",
        label: "ฐานความรู้ AI",
        icon: BookOpen,
        desc: "คำตอบที่อนุมัติแล้วให้ AI ใช้ตอบลูกค้า",
        permission: "kb.draft",
      },
      {
        href: "/admin/seo",
        label: "SEO หน้าเว็บ",
        icon: Search,
        desc: "ชื่อหน้าและคำโปรยที่ขึ้นบน Google",
        permission: "seo.manage",
      },
      {
        href: "/admin/products/content",
        label: "เนื้อหาสินค้า",
        icon: FileText,
        desc: "รายละเอียดสินค้าแบบอิสระ 2 ภาษา",
        permission: "product_content.view",
      },
      {
        href: "/admin/brand-insights",
        label: "เสียงลูกค้า & คำค้นหา",
        icon: TrendingUp,
        desc: "สิ่งที่ลูกค้าถามและค้นหาบ่อย",
        permission: "brand_signals.view",
      },
      {
        href: "/admin/line-rich-menu",
        label: "เมนู LINE OA",
        icon: MessageCircle,
        desc: "เมนูด้านล่างในแชท LINE ของร้าน",
        permission: "line_rich_menu.manage",
      },
    ],
  },
  {
    label: "ตั้งค่าระบบ",
    tone: "slate",
    items: [
      {
        href: "/admin/design",
        label: "ระบบดีไซน์",
        icon: Palette,
        desc: "สี ตัวอักษร และส่วนประกอบของหลังบ้าน",
        permission: null,
      },
      // Owner only, like the user list: the log is every admin's work, and
      // the page refuses anyone else on its own — this just stops the other
      // roles walking into a wall.
      {
        href: "/admin/audit",
        label: "บันทึกการใช้งาน",
        icon: ScrollText,
        desc: "ใครทำอะไรไว้บ้างในหลังบ้าน",
        ownerOnly: true,
      },
      {
        href: "/admin/users",
        label: "ผู้ใช้ & สิทธิ์",
        icon: UserCog,
        desc: "เพิ่มทีมงานและกำหนดสิทธิ์",
        ownerOnly: true,
      },
    ],
  },
];

export const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export const groupOf = (href: string) =>
  NAV_GROUPS.find((g) => g.items.some((i) => i.href === href))?.label ?? "";

/** Courtesy, not protection: the request is refused by the gate in proxy.ts
 *  whatever the menu shows. This only spares people the walk to a locked
 *  door — an item with no permission of its own is for everyone. */
export function isAllowed(
  item: Pick<NavItem, "permission" | "ownerOnly">,
  access: { permissions: string[]; role: string | null },
) {
  if (item.ownerOnly) return !access.role || access.role === "owner";
  if (!item.permission) return true;
  return (
    access.permissions.includes("*") ||
    access.permissions.includes(item.permission)
  );
}

/** What the signed-in admin may do, so screens inside the console filter the
 *  same way the sidebar does without each fetching /api/admin/me again. */
const AdminAccessContext = createContext<{
  permissions: string[];
  role: string | null;
}>({
  // "*" until the layout answers, matching the sidebar: a flash of too few
  // links reads as missing features, and the gate refuses either way.
  permissions: ["*"],
  role: null,
});

export const AdminAccessProvider = AdminAccessContext.Provider;
export const useAdminAccess = () => useContext(AdminAccessContext);
