"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type CartDrawerValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const Ctx = createContext<CartDrawerValue | null>(null);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function useCartDrawer() {
  const ctx = useContext(Ctx);
  if (!ctx) return { open: false, setOpen: () => {} } as CartDrawerValue;
  return ctx;
}
