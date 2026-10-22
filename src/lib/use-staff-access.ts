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

export function useStaffAccess(): StaffAccess {
  const [access, setAccess] = useState<StaffAccess>({ available: false });

  useEffect(() => {
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
  }, []);

  return access;
}
