import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { helpFaqs, helpTopics } from "@/data/help";
import { featureArticles } from "@/data/kb-features";
import { KB_COLUMNS, reindexArticle, type KbArticle, type KbCategory } from "@/lib/kb";

// Seeding the knowledge base from what the site already publishes — the help
// centre, plus how its own features work (skin scan, shop by concern).
// That content is written by the team and live on the storefront, so it starts
// published — unlike an answer promoted from a chat, which a person approves
// first. Runs are idempotent: an article whose title is already there is left
// alone, so pressing the button twice changes nothing.
export const dynamic = "force-dynamic";

// The help centre groups by page; the knowledge base groups by what a customer
// is asking about.
const TOPIC_CATEGORY: Record<string, KbCategory> = {
  "/help/shipping": "shipping",
  "/help/returns": "policy",
  "/help/payment": "payment",
  "/help/points": "loyalty",
  "/help/membership": "loyalty",
};

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const drafts = [
    ...helpTopics.map((topic) => ({
      title: topic.title,
      category: TOPIC_CATEGORY[topic.href] ?? ("policy" as KbCategory),
      source_ref: topic.href,
      content: [topic.intro, ...topic.sections.map((s) => `${s.title}\n${s.body}`)].filter(Boolean).join("\n\n"),
    })),
    ...helpFaqs.map((faq) => ({
      title: faq.q,
      category: "faq" as KbCategory,
      source_ref: "/help",
      content: faq.a,
    })),
    // The help centre explains the shop; these explain the site. Same footing:
    // written by the team, already on screen, so they start published too.
    ...featureArticles,
  ];

  const existing = await supabaseRest<{ title: string }[]>("kb_articles?select=title&limit=1000");
  const known = new Set(existing.map((a) => a.title));
  const fresh = drafts.filter((d) => !known.has(d.title));
  if (fresh.length === 0) return NextResponse.json({ ok: true, created: 0, skipped: drafts.length });

  const created = await supabaseRest<KbArticle[]>(`kb_articles?select=${KB_COLUMNS}`, {
    method: "POST",
    body: JSON.stringify(
      fresh.map((d) => ({
        ...d,
        status: "published",
        source: "manual",
        last_reviewed_at: new Date().toISOString(),
        reviewed_by: "admin",
      }))
    ),
  });
  for (const article of created) await reindexArticle(article);

  return NextResponse.json({ ok: true, created: created.length, skipped: drafts.length - fresh.length });
}
