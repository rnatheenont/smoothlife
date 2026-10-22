import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { MAILBOX_PROOF_DAYS } from "@/lib/staff-sale";
import { staffRpc, type RpcResult } from "@/lib/staff-sale-rpc";
import {
  currentStaffRound,
  eligibleAccountEmail,
  mailboxProvedRecently,
  staffPendingOrder,
  staffShippingAddress,
  staffShopItems,
  staffStanding,
  upcomingStaffRound,
} from "@/lib/staff-shop";

// Everything /staff needs to render, in one request.
//
// One request because the page has four states and which one it is in is a
// single answer: no round, not signed in, not verified, or shopping. Four
// fetches would let the page show three of them at once while they land.
//
// Prices are in the response only in the last of those states. Nothing here
// falls through to "send the list and let the page hide it".

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, state: "unavailable" });
  }

  const round = await currentStaffRound();
  if (!round) {
    const next = await upcomingStaffRound();
    return NextResponse.json({
      ok: true,
      state: "closed",
      nextRound: next ? { name: next.name, starts_at: next.starts_at } : null,
    });
  }

  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    // The round's name and dates only. Enough for the page to say what this
    // is and why to sign in, and nothing about what is in it or for how much.
    return NextResponse.json({
      ok: true,
      state: "signin",
      round: { name: round.name, ends_at: round.ends_at },
    });
  }

  let standing = await staffStanding(round.id, userId);

  // Nobody is asked to prove a mailbox they already signed in with.
  //
  // The OTP exists to answer "do you still hold a company address" for an
  // account whose own address is somebody else's — a personal Gmail, say.
  // When the account itself signed in through @smooth-e.com, that question
  // was answered at login, and asking it again is a code sent to the inbox
  // the person is already holding.
  //
  // Still a real verification row, written by the same RPC with the same
  // uniqueness rules — one mailbox to one account per round — so nothing
  // downstream can tell the two routes apart.
  const own = standing ? null : await eligibleAccountEmail(userId);

  if (!standing && own && (await mailboxProvedRecently(userId, own))) {
    const res = await staffRpc<RpcResult>("staff_verify", {
      p_round: round.id,
      p_user: userId,
      p_email: own,
    });
    if (res?.ok) {
      // Marked so it cannot renew its own licence: only a row written by a
      // code read out of the mailbox counts as proof next time.
      await supabaseRest(
        `staff_verifications?round_id=eq.${pgValue(round.id)}&user_id=eq.${pgValue(userId)}`,
        {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ via: "account_email" }),
        },
      ).catch(() => {});
      standing = await staffStanding(round.id, userId);
    }
    // A refusal is almost always `email_or_account_taken`: this mailbox is
    // tied to another account in this round. The panel below says so.
  }

  if (!standing) {
    return NextResponse.json({
      ok: true,
      state: "verify",
      round: { id: round.id, name: round.name, ends_at: round.ends_at, cap_thb: Number(round.cap_thb) },
      // The address to put in the box, when the account already has an
      // eligible one. Someone being asked here has either never read a code
      // out of it, or not for a month — either way they should not have to
      // type the address they are signed in with.
      suggestEmail: own ?? undefined,
      proofDays: MAILBOX_PROOF_DAYS,
    });
  }

  const [items, pending, address] = await Promise.all([
    staffShopItems(round.id, userId),
    staffPendingOrder(round.id, userId),
    staffShippingAddress(userId),
  ]);

  return NextResponse.json({
    ok: true,
    state: "shop",
    round: {
      id: round.id,
      name: round.name,
      ends_at: round.ends_at,
      cap_thb: Number(round.cap_thb),
      payment_window_min: round.payment_window_min,
    },
    standing,
    items,
    pending,
    // Not the address itself beyond what the page needs to show "ส่งไปที่
    // …" and to say if there isn't one yet.
    shipTo: address
      ? {
          summary: [address.address1, address.city, address.province, address.zip]
            .filter(Boolean)
            .join(" "),
          hasPhone: Boolean(address.phone),
        }
      : null,
    serverNow: Date.now(),
  });
}
