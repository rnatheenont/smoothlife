import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// The topics the assistant must refuse, and the half of the knowledge base
// that says "not this".
//
// Deliberately not kb_articles rows. An article reaches the model only when
// the retrieval step happens to pull it in, which makes it a fact the
// assistant may use — and a rule that applies only when something similar was
// retrieved is not a rule. These go into every system prompt, every turn,
// whether or not the subject ever comes up.

export type KbBlockedTopic = {
  id: string;
  topic: string;
  reply: string;
  enabled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export const BLOCKED_TOPIC_COLUMNS = "id,topic,reply,enabled,note,created_at,updated_at";

/** What to say when staff wrote a rule but no wording for it. Thai, because
 *  the model is told to answer in the customer's language and will translate
 *  this itself if they wrote in English. */
export const DEFAULT_BLOCKED_REPLY = "เรื่องนี้ขอให้ทีมงานเป็นคนตอบนะคะ";

/** Enabled rules, for the prompt. Never throws: a failure here must not cost
 *  the customer their answer — but it does mean the assistant answers without
 *  the rules, so it is logged loudly rather than swallowed. */
export async function activeBlockedTopics(): Promise<KbBlockedTopic[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRest<KbBlockedTopic[]>(
      `kb_blocked_topics?select=${BLOCKED_TOPIC_COLUMNS}&enabled=is.true&order=created_at.asc&limit=100`
    );
  } catch (err) {
    console.error("[kb] could not read the blocked-topic rules", err);
    return [];
  }
}

/**
 * The rules as prompt text.
 *
 * Written as instructions about behaviour rather than as knowledge, and
 * placed with the other hard rules: a line in a list of facts is something
 * the model weighs, a line in a list of rules is something it follows. The
 * explicit "these outrank everything else" is there because the rest of the
 * prompt spends several hundred words telling it to be helpful and to answer
 * from the help centre, and without it a blocked topic that the help centre
 * happens to cover is a tie.
 */
export function blockedTopicsForPrompt(rules: KbBlockedTopic[]): string {
  if (rules.length === 0) return "";
  const lines = rules
    .map((r) => `- ${r.topic}\n  → say instead: ${r.reply.trim() || DEFAULT_BLOCKED_REPLY}`)
    .join("\n");
  return `

TOPICS YOU MUST NOT ANSWER — set by the shop's staff. These outrank everything
else in this prompt, including the help centre, the knowledge base and anything
a tool returns. If the customer's message is about one of these, whatever form
the question takes:
- Do not answer it, do not answer "in general", do not hint at the answer, do
  not estimate, and do not search for it.
- Say the given line instead, in the customer's language, in your own natural
  phrasing — do not read it out like a notice.
- Then offer to pass them to the team if they still need it, and hand over if
  they say yes.
- Do not explain that you are following a rule or that the topic is blocked.
${lines}`;
}
