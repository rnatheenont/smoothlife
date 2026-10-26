import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { createMergeTicket } from "@/lib/merge-ticket";

// What a Google or LINE callback should do when somebody is already signed
// in.
//
// Before this, both callbacks did the same thing whatever the state of the
// session: find-or-create an account for the provider's id and hand the
// session to it. For a shopper already signed in by email, pressing the
// LINE button therefore did not add LINE to their account — it put them in
// a different one, usually a brand new one, with none of their orders. That
// is half of how this shop came to have four people holding two accounts
// each, and the half that keeps making more of them.
//
// So the callbacks ask here first. No session, and nothing changes: signing
// in is still signing in. With a session, the provider's id is attached to
// the account they are already in, and they stay in it.

export type SocialLinkOutcome =
  /** Nobody was signed in — carry on and sign them in as before. */
  | { kind: "no_session" }
  /** Already theirs. Nothing to do, and nothing to tell them. */
  | { kind: "already_linked"; userId: string }
  /** Attached to the account they are signed in as. */
  | { kind: "linked"; userId: string }
  /**
   * It belongs to another account. Not switched to silently and not
   * attached by force: the shopper is shown both accounts and decides.
   */
  | { kind: "merge_required"; ticket: string };

export async function linkSocialToSession(
  req: NextRequest,
  provider: "google" | "line",
  providerUid: string,
): Promise<SocialLinkOutcome> {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return { kind: "no_session" };

  // A session cookie outlives the account it names if that account was
  // merged away, so this confirms the account is still there before
  // treating the session as a place to attach anything.
  const [me] = await supabaseRest<{ id: string }[]>(
    `users?id=eq.${pgValue(uid)}&select=id&limit=1`,
  ).catch(() => []);
  if (!me) return { kind: "no_session" };

  const [owner] = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.${pgValue(provider)}&provider_uid=eq.${pgValue(providerUid)}` +
      `&select=user_id&limit=1`,
  ).catch(() => []);

  if (owner?.user_id === uid) return { kind: "already_linked", userId: uid };

  if (owner?.user_id) {
    return {
      kind: "merge_required",
      ticket: createMergeTicket({
        session: uid,
        other: owner.user_id,
        via: provider,
        uid: providerUid,
      }),
    };
  }

  // Free, and the provider just vouched for it: verified the moment it is
  // written, the same as a code read out of a mailbox.
  await supabaseRest("auth_identities", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: uid,
      provider,
      provider_uid: providerUid,
      verified_at: new Date().toISOString(),
    }),
  });

  return { kind: "linked", userId: uid };
}
