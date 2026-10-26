import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { WIDGET_DEFAULTS as DEFAULTS, type WidgetRow } from "@/lib/widget-defaults";

export type { WidgetRow };


// No dynamic API is used here, so Next.js would otherwise treat this as a
// static route and cache its response forever within a server process —
// widget on/off state must always be live.
export const dynamic = "force-dynamic";

// Every storefront page load asks for this, but the admin flips these toggles
// rarely — so let Vercel's edge answer for a minute at a time. An admin change
// reaches shoppers within about a minute instead of on the very next request.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ widgets: DEFAULTS });
  try {
    const rows = await supabaseRest<WidgetRow[]>("free_gift_widgets?select=key,label_th,enabled,config&order=key.asc");
    if (rows.length === 0) return NextResponse.json({ widgets: DEFAULTS }, { headers: CACHE_HEADERS });

    // A widget added in code has no row until somebody writes one, and the
    // list used to be whatever the table happened to hold — so a new widget
    // was invisible in the admin, which is a deploy that silently does
    // nothing. The defaults fill the gaps; the stored rows win where they
    // exist, because those carry the shop's own on/off and settings.
    const stored = new Map(rows.map((r) => [r.key, r]));
    const widgets = [...stored.values()];
    for (const fallback of DEFAULTS) {
      if (!stored.has(fallback.key)) widgets.push(fallback);
    }
    widgets.sort((a, b) => a.key.localeCompare(b.key));
    return NextResponse.json({ widgets }, { headers: CACHE_HEADERS });
  } catch (err) {
    // Not cached, so the next request tries the database again.
    console.error("[free-gifts/widgets] fetch failed", err);
    return NextResponse.json({ widgets: DEFAULTS });
  }
}
