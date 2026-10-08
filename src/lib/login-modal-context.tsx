"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Opening the sign-in dialog from anywhere.
//
// The page at /account/login stays exactly where it was — middleware
// redirects, OAuth callbacks and every link that already points at it have
// to keep working, and a dialog cannot be linked to. What this adds is the
// other way in: from the header, without throwing away the page somebody was
// reading to ask them who they are.

type LoginModalValue = {
  isOpen: boolean;
  /** Where to send them once they are in. Defaults to wherever they were. */
  returnTo: string;
  open: (returnTo?: string) => void;
  close: () => void;
};

const Ctx = createContext<LoginModalValue | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [returnTo, setReturnTo] = useState("/account");

  const open = useCallback((to?: string) => {
    // The page they are on, including its query, so a sign-in that leaves
    // for LINE or Google comes back to the same place rather than dumping
    // them in the account area.
    setReturnTo(to ?? (typeof window === "undefined" ? "/account" : window.location.pathname + window.location.search));
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, returnTo, open, close }), [isOpen, returnTo, open, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLoginModal(): LoginModalValue {
  const ctx = useContext(Ctx);
  // Outside the provider — /admin and the campaign shells — asking to sign
  // in does the one thing that always works.
  return (
    ctx ?? {
      isOpen: false,
      returnTo: "/account",
      open: () => {
        if (typeof window !== "undefined") window.location.href = "/account/login";
      },
      close: () => {},
    }
  );
}
