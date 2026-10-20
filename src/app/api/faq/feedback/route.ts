import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { revalidateTag } from "next/cache";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { recordGap } from "@/lib/kb-gaps";

// Was this answer helpful?
//
// The counts steer the order questions appear in, so the endpoint has to be
// dull to abuse: one vote per visitor per question, enforced by a stored hash
// rather than by a cookie the voter controls.
//
// The hash is of the IP and the user agent with a server-side salt, truncated.
// That is enough to stop the same browser voting twice and not enough to
// identify anybody — there is no account here, nothing is joined to a
// customer, and the raw IP is never stored. Where it matters: a shared office
// network sharing a user agent gets one vote between them. Fine; a vote count
// on an FAQ is not a ballot.
export const dynamic = "force-dynamic";

const REASONS = new Set(["wrong-question", "not-enough", "incorrect"]);
const RATE = { attempts: 20, windowMs: 60_000 };

function visitorHash(req: NextRequest, articleId: string) {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const agent = req.headers.get("user-agent") ?? "";
  return createHash("sha256").update(`${salt}:${clientIp(req)}:${agent}:${articleId}`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  if (isRateLimited(`faq-feedback:${clientIp(req)}`, RATE.attempts, RATE.windowMs)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

  let body: { article_id?: unknown; helpful?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const articleId = typeof body.article_id === "string" ? body.article_id : "";
  const helpful = body.helpful === true;
  const reason = typeof body.reason === "string" && REASONS.has(body.reason) ? body.reason : null;
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    // Must be a question somebody can actually read. Without this the
    // endpoint would accept votes for the draft answers and for the
    // assistant-only ones, and the counts it feeds decide what goes first on
    // a public page.
    const article = await supabaseRest<{ id: string; public_slug: string | null; title: string }[]>(
      `kb_articles?id=eq.${pgValue(articleId)}&status=eq.published&visibility=eq.public&public_slug=not.is.null&select=id,public_slug,title&limit=1`
    );
    const found = article?.[0];
    if (!found) return NextResponse.json({ ok: false }, { status: 404 });

    const hash = visitorHash(req, articleId);
    const already = await supabaseRest<{ id: number }[]>(
      `faq_feedback?article_id=eq.${pgValue(articleId)}&visitor_hash=eq.${pgValue(hash)}&select=id&limit=1`
    );
    // Answered "thank you" either way. Telling somebody their second vote was
    // refused invites them to find out why it was refused.
    if (already?.[0]) return NextResponse.json({ ok: true, counted: false });

    try {
      await supabaseRest("faq_feedback", {
        method: "POST",
        returning: false,
        body: JSON.stringify({ article_id: articleId, helpful, reason, visitor_hash: hash }),
      });
    } catch (err) {
      // The unique index is the rule; the read above is only the fast path.
      // Two taps that arrive together both read "has not voted", and the
      // loser of that race has already had its vote counted by the winner.
      if (String(err).includes("23505")) return NextResponse.json({ ok: true, counted: false });
      throw err;
    }

    await supabaseRest("rpc/faq_feedback_tally", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ p_article_id: articleId, p_helpful: helpful }),
    });

    // A thumbs-down on an answer that exists is still a question the shop
    // has not answered well enough — §8.4 counts it the same as a search
    // that found nothing. The question recorded is the FAQ's own, because
    // that is what the reader was looking at when they said it did not help.
    if (!helpful && found.title) {
      void recordGap({ question: found.title, source: "faq" });
    }

    // The counts order the list, so the page has to be rebuilt to show it.
    revalidateTag("kb-public", { expire: 0 });
    if (found.public_slug) revalidateTag(`kb-public:${found.public_slug}`, { expire: 0 });

    return NextResponse.json({ ok: true, counted: true });
  } catch (err) {
    console.error("[faq] feedback failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
