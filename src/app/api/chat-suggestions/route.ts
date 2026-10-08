import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// The questions offered under the AI field as a shopper types.
//
// The whole list goes over the wire once and the field filters it in the
// browser. That is deliberate: it is a few dozen short strings, and matching
// them on the server would mean a request per keystroke to answer something
// the page already holds.

export type QuestionSuggestion = { id: string; text: string };

/** Enough to cover any prefix a shopper types without being a page of data. */
const LIMIT = 120;

export const dynamic = "force-dynamic";

// Admins edit this rarely and shoppers read it on every visit, so let the
// edge answer for five minutes at a time.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" };

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ questions: [] });
  try {
    const rows = await supabaseRest<QuestionSuggestion[]>(
      `chat_question_suggestions?select=id,text&enabled=is.true&order=asked_count.desc,text.asc&limit=${LIMIT}`
    );
    return NextResponse.json({ questions: rows }, { headers: CACHE_HEADERS });
  } catch (err) {
    // Not cached, so the next request tries again. An empty list is a field
    // with no hints under it, which is what it was before this existed.
    console.error("[chat-suggestions] fetch failed", err);
    return NextResponse.json({ questions: [] });
  }
}
