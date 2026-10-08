import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Pulls the questions customers actually ask into the suggestion list.
//
// Run by hand from the admin screen rather than on a schedule: what comes
// out is shown to every shopper on the home page, so somebody should be
// looking at it when it changes. Rows land disabled for the same reason —
// the refresh proposes, an admin publishes.
//
// Gated by "/api/admin/chat-suggestions" -> kb.draft, the same rule as the
// list itself (admin-route-permissions.ts); the prefix covers this path.

/** How far back to look. A question nobody has asked in three months is not
 *  what the shop is being asked today. */
const WINDOW_DAYS = 90;
/** Taken from the top of the count, after the filters below. */
const KEEP = 30;
/** Short enough to sit in a chip, long enough to be a question. */
const MIN_LEN = 8;
const MAX_LEN = 60;
/** Below this it is one person's question, not a common one. */
const MIN_ASKS = 2;
/** Attachment and system markers the chat writes into the message body. */
const MARKER = /\[\[[^\]]+\]\]/;

type Msg = { content: string };

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();

  let rows: Msg[];
  try {
    rows = await supabaseRest<Msg[]>(
      `chat_messages?select=content&role=eq.user&created_at=gte.${since}&order=created_at.desc&limit=5000`
    );
  } catch (err) {
    console.error("[chat-suggestions/refresh] read failed", err);
    return NextResponse.json({ ok: false, error: "อ่านประวัติแชทไม่สำเร็จ" }, { status: 502 });
  }

  // Grouped on the text as typed, bar case and padding. Deliberately not
  // clustered by meaning: two wordings of the same question are two things
  // an admin may want to keep or merge by hand, and guessing which is which
  // is how a list like this fills up with near-duplicates nobody chose.
  const counts = new Map<string, { text: string; n: number }>();
  for (const r of rows) {
    const text = (r.content ?? "").replace(/\s+/g, " ").trim();
    if (text.length < MIN_LEN || text.length > MAX_LEN) continue;
    // "[[PHOTO]] …" and anything else in double brackets is a marker the
    // chat puts in for an attachment, not something a customer typed. It was
    // the most-counted line in the history by a distance, and it is not a
    // question anyone can be offered.
    if (MARKER.test(text)) continue;
    const key = text.toLowerCase();
    const seen = counts.get(key);
    if (seen) seen.n += 1;
    else counts.set(key, { text, n: 1 });
  }

  const top = [...counts.values()]
    .filter((c) => c.n >= MIN_ASKS)
    .sort((a, b) => b.n - a.n)
    .slice(0, KEEP);

  if (top.length === 0) return NextResponse.json({ ok: true, added: 0, scanned: rows.length });

  try {
    // merge-duplicates so a question an admin already wrote keeps its own
    // text and enabled state and only takes the new count.
    await supabaseRest("chat_question_suggestions?on_conflict=text", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(
        top.map((c) => ({ text: c.text, source: "auto", asked_count: c.n, enabled: false }))
      ),
    });
  } catch (err) {
    console.error("[chat-suggestions/refresh] upsert failed", err);
    return NextResponse.json({ ok: false, error: "บันทึกคำถามไม่สำเร็จ" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, added: top.length, scanned: rows.length });
}
