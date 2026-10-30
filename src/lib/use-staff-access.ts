"use client";

import { useEffect, useState } from "react";

// Whether to offer this account the employee shop, asked once per mount.
//
// A boolean and a round name — never a price. The account pages ask on
// every view, so this hits /api/staff/access rather than the route that
// builds the whole price list.

export type StaffAccess = {
  available: boolean;
  roundName?: string;
  ends_at?: string;
};

/** Fired when something on the page may have changed who can see the shop. */
const CHANGED = "staff-access-changed";

/**
 * Tells every useStaffAccess on the page to ask again.
 *
 * The header and the account sidebar ask once, when they mount. Proving a
 * company address at /account/verify changes the answer without a page load,
 * so the menu stayed empty until a refresh — and "I verified, where is it?"
 * was the question that came back (30 Oct 2026).
 */
export function announceStaffAccessChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
}

// `enabled` lets the header skip the request for a signed-out visitor — it
// renders on every page, and the answer for them is always false. Flipping it
// back on (sign in, or a different account) asks again.
export function useStaffAccess(enabled = true): StaffAccess {
  const [access, setAccess] = useState<StaffAccess>({ available: false });
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    const again = () => setAsked((n) => n + 1);
    window.addEventListener(CHANGED, again);
    return () => window.removeEventListener(CHANGED, again);
  }, []);

  // So the next account to sign in does not inherit this one's answer while
  // its own request is in flight. Its own effect, so that asking again for
  // the same account does not blink the menu entry off and back on.
  useEffect(() => {
    if (!enabled) return;
    return () => setAccess({ available: false });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/staff/access")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.ok) {
          setAccess({
            available: Boolean(data.available),
            roundName: data.roundName,
            ends_at: data.ends_at,
          });
        }
      })
      // Silent, and hidden by default: the employee shop is a side door
      // that almost nobody loading an account page has anything to do with,
      // and a failed check must never add a menu entry.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, asked]);

  return enabled ? access : { available: false };
}
