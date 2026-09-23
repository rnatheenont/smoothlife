// The chat assistant's way into the customer's own loyalty account: points
// balance, tier, progress to the next tier, and the discount codes they
// already qualify for.
//
// The rule this exists to enforce: the assistant never states a customer's
// points from memory or from anything the customer typed. "ผมมี 5000 แต้ม
// ใช่ไหม" is not evidence — the balance comes from this tool or the
// assistant says it cannot see the account.
//
// Security: the tool takes NO customer identifier. The signed-in user is
// passed in server-side from the session cookie, so a customer cannot ask
// the assistant to read someone else's balance, and a prompt-injected
// message cannot smuggle another user's id through the model.
import type Anthropic from "@anthropic-ai/sdk";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getUserLoyalty } from "@/lib/user-tier";
import { loyaltyTierProgress, TIER_RANK, type TierName } from "@/lib/loyalty-shared";
import { coupons } from "@/data/coupons";

export const MEMBER_TOOL: Anthropic.Tool = {
  name: "get_member_status",
  description:
    "Look up the SIGNED-IN customer's own loyalty account: points balance, membership tier, how far they are from the next tier, " +
    "and which discount codes they currently qualify for. " +
    "Takes no arguments — it always reads the customer who is signed in to this chat and can never look up anyone else. " +
    "Use it whenever the customer asks about their points or score (แต้ม, คะแนน, พอยท์), their tier or membership level, " +
    "what they can redeem, or which promotion or discount applies to them. " +
    "Never state a points balance, a tier, or a discount code from memory or from a number the customer typed — it must come from this tool. " +
    "If it reports that nobody is signed in, ask them to sign in instead of guessing.",
  input_schema: { type: "object", properties: {}, required: [] },
};

/** Codes the customer passes the gate for, with the condition still attached. */
function eligibleCoupons(signedIn: boolean, tier: TierName) {
  const today = Date.now();
  return coupons.filter((c) => {
    if (c.memberOnly && !signedIn) return false;
    if (c.tier && TIER_RANK[tier] < TIER_RANK[c.tier]) return false;
    const expiry = Date.parse(c.expires);
    if (!Number.isNaN(expiry) && expiry < today) return false;
    return true;
  });
}

/**
 * Runs the tool for the signed-in user. `uid` comes from the session cookie,
 * never from the model — see the security note at the top of this file.
 */
export async function runMemberTool(uid: string | null): Promise<string> {
  if (!uid) {
    return (
      "This customer is not signed in, so their account cannot be read. " +
      "Do not guess a balance or a tier. Ask them to sign in to see their points, " +
      "and offer to answer anything else in the meantime."
    );
  }
  if (!supabaseConfigured()) {
    return "The membership system could not be reached. Tell the customer you cannot see their points right now and offer to pass this to the team.";
  }

  let balance = 0;
  let loyalty: { tier: TierName; spend: number; orders: number };
  try {
    const [balanceRow] = await supabaseRest<{ balance: number }[]>(
      `points_balance?user_id=eq.${uid}&select=balance`
    );
    balance = balanceRow?.balance ?? 0;
    loyalty = await getUserLoyalty(uid);
  } catch (err) {
    console.error("[chat] member status lookup failed", err);
    return "The membership system could not be reached. Tell the customer you cannot see their points right now and offer to pass this to the team.";
  }

  const progress = loyaltyTierProgress(loyalty.spend, loyalty.orders);
  const offers = eligibleCoupons(true, loyalty.tier);

  const lines = [
    `Points balance: ${balance.toLocaleString("en-US")}`,
    `Tier: ${loyalty.tier}`,
    `Rolling 12-month spend: ฿${loyalty.spend.toLocaleString("en-US")} across ${loyalty.orders} orders`,
    progress.next
      ? `Next tier: ${progress.next} — ฿${progress.remaining.toLocaleString("en-US")} more spend to reach it (${progress.percent}% of the way)`
      : `Already at the top tier.`,
  ];

  const offerText = offers.length
    ? offers
        .map((c) => {
          const cond = [
            c.minSpend ? `min spend ฿${c.minSpend.toLocaleString("en-US")}` : null,
            c.tier ? `${c.tier} tier and above` : c.memberOnly ? "members only" : null,
            c.brand ? `${c.brand} only` : null,
            c.maxDiscount ? `capped at ฿${c.maxDiscount.toLocaleString("en-US")}` : null,
            `expires ${c.expires}`,
          ]
            .filter(Boolean)
            .join(", ");
          return `- ${c.code} — ${c.titleTh} (${cond})`;
        })
        .join("\n")
    : "- none right now";

  return (
    `${lines.join("\n")}\n\n` +
    `Discount codes this customer qualifies for:\n${offerText}\n\n` +
    `Report these figures as they stand. Quote a code only if it is listed above, and always state its condition ` +
    `(minimum spend, tier, expiry) alongside it so the customer is not surprised at checkout. ` +
    `Do not invent codes, do not promise a discount that is not listed, and do not describe how points are earned, ` +
    `expire or are redeemed from memory — that is shop policy, so search the knowledge base for it.`
  );
}
