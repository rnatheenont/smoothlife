"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Goes straight to the login page instead of showing an interstitial
// "please login" screen the customer has to tap through first.
export default function AccountGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/account/login?returnTo=${encodeURIComponent(pathname || "/account")}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) return <div className="container-page py-20 text-center text-slate-400">กำลังโหลด...</div>;

  return <>{children}</>;
}
