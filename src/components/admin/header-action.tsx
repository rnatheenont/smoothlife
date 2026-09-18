"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  const { label, onClick, disabled } = action ?? {};
  const icon = action?.icon;
  const run = useCallback(() => onClick?.(), [onClick]);

  useEffect(() => {
    if (!label) return;
    setAction({ label, icon, onClick: run, disabled });
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- icon is a node; the label and the handler identify the action
  }, [label, disabled, run, setAction]);
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
