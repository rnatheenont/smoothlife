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

// `enabled` lets the header skip the request for a signed-out visitor — it
// renders on every page, and the answer for them is always false. Flipping it
// back on (sign in, or a different account) asks again.
export function useStaffAccess(enabled = true): StaffAccess {
  const [access, setAccess] = useState<StaffAccess>({ available: false });

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
      // So the next account to sign in does not inherit this one's answer
      // while its own request is in flight.
      setAccess({ available: false });
    };
  }, [enabled]);

  return enabled ? access : { available: false };
}
