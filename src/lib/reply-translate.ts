const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Staff answer in Thai. A customer who wrote in English, Chinese or Japanese
// should not have to paste that into a translator to read their own support
// reply — so the reply is translated on the way out, and only when it needs to
// be. Staff who already answered in the customer's language have their words
// delivered untouched; a translation round trip could only make those worse.

const SYSTEM = `You translate one customer-support reply so the customer can read it.

You are given recent messages from the customer, then the reply staff wrote.

Rules:
- Work out the language the CUSTOMER writes in. Ignore the staff reply when
  deciding this.
- The customer's messages are given oldest to newest. Weigh the LAST one most:
  someone who wrote Thai earlier and English just now wants English now.
- If the staff reply is already in that language, return it EXACTLY as given,
  character for character. Do not improve it, reword it or fix its typos.
- Otherwise translate it into the customer's language, keeping the warm,
  polite register of a shop's support team.
- Never translate or alter: order numbers, tracking numbers, product codes,
  prices, URLs, email addresses, phone numbers, or names. Copy them verbatim.
- Add nothing. No greeting, no sign-off, no explanation, no quotes around the
  result. Return only the reply text itself.`;

/**
 * The reply as the customer should receive it.
 *
 * Returns null when nothing needs doing (no key, no customer text to judge
 * from, or the call failed) — every caller treats that as "send what staff
 * wrote", because a failed translation must never hold up a support reply.
 */
export async function translateForCustomer(opts: {
  staffReply: string;
  customerMessages: string[];
}): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  const context = opts.customerMessages.filter(Boolean).slice(-6).join("\n");
  if (!key || !context.trim() || !opts.staffReply.trim()) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Recent messages from the customer:\n${context}\n\n---\nStaff reply to deliver:\n${opts.staffReply}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[reply-translate] anthropic error", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const out = (data?.content ?? [])
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("")
      .trim();
    // Same text back means it was already in the customer's language.
    return out && out !== opts.staffReply.trim() ? out : null;
  } catch (err) {
    console.error("[reply-translate] failed", err);
    return null;
  }
}
