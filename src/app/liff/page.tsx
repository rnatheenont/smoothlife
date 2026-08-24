"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// Entry point for the LIFF app's "LIFF endpoint URL" (LINE Developers
// Console). Exchanges the LIFF ID token for our own session cookie, then
// hands off to `to` (defaults to the account page) — from there it's just
// the normal site rendering inside LINE's webview, no LIFF-specific code
// needed on any other page. Rich Menu items should link to
// https://liff.line.me/{liffId}?to=/account/checkin etc.
function LiffEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const to = searchParams.get("to") || "/account";
    if (!liffId) {
      setError("ยังไม่ได้ตั้งค่า LIFF");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const idToken = liff.getIDToken();
        if (!idToken) throw new Error("no id token");

        const res = await fetch("/api/liff/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error || "session failed");
        router.replace(to);
      } catch (err) {
        console.error("[liff entry]", err);
        if (!cancelled) setError("เข้าสู่ระบบผ่าน LINE ไม่สำเร็จค่ะ ลองใหม่อีกครั้ง");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="text-sm text-slate-500">{error}</p>;
  }
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Loader2 size={20} className="animate-spin" />
      <span className="text-sm">กำลังเข้าสู่ระบบ...</span>
    </div>
  );
}

export default function LiffEntryPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<Loader2 size={20} className="animate-spin text-slate-400" />}>
        <LiffEntryContent />
      </Suspense>
    </div>
  );
}
