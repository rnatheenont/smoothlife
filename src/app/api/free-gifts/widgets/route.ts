import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

export type WidgetRow = { key: string; label_th: string; enabled: boolean; config: Record<string, unknown> };

const DEFAULTS: WidgetRow[] = [
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
];

// No dynamic API is used here, so Next.js would otherwise treat this as a
// static route and cache its response forever within a server process —
// widget on/off state must always be live.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ widgets: DEFAULTS });
  try {
    const rows = await supabaseRest<WidgetRow[]>("free_gift_widgets?select=key,label_th,enabled,config&order=key.asc");
    return NextResponse.json({ widgets: rows.length ? rows : DEFAULTS });
  } catch (err) {
    console.error("[free-gifts/widgets] fetch failed", err);
    return NextResponse.json({ widgets: DEFAULTS });
  }
}
