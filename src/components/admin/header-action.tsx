"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

// The primary action of an admin page ("สร้างแคมเปญใหม่", "เพิ่ม…") belongs in
// the top right of the console, the way every CMS back-office puts it — but
// only the page itself knows what that action is and how to run it. So a page
// registers one with useAdminAction, and the shell renders it in its header.

export type AdminAction = { label: string; icon?: ReactNode; onClick: () => void; disabled?: boolean };

const Ctx = createContext<{ action: AdminAction | null; setAction: (a: AdminAction | null) => void }>({
  action: null,
  setAction: () => {},
});

export function AdminActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<AdminAction | null>(null);
  const value = useMemo(() => ({ action, setAction }), [action]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Register this page's primary action. `label` identifies it, so a page whose
 * button changes text (create / edit) re-registers on its own.
 */
export function useAdminAction(action: AdminAction | null) {
  const { setAction } = useContext(Ctx);
  const { label, disabled } = action ?? {};
  const icon = action?.icon;
  // The page hands in a fresh closure (and a fresh icon element) on every
  // render; registering those directly would re-register forever. Only the
  // label and the disabled flag decide when the button changes — the click
  // always runs the newest handler.
  const latest = useRef(action?.onClick);
  useEffect(() => {
    latest.current = action?.onClick;
  });

  useEffect(() => {
    if (!label) {
      setAction(null);
      return;
    }
    setAction({ label, icon, onClick: () => latest.current?.(), disabled });
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- icon is a node, and the handler is read from the ref
  }, [label, disabled, setAction]);
}

/** Rendered by the admin shell, in its header. */
export function AdminActionButton() {
  const { action } = useContext(Ctx);
  if (!action) return null;
  return (
    <Button onClick={action.onClick} disabled={action.disabled} className="shrink-0">
      {action.icon}
      {action.label}
    </Button>
  );
}
