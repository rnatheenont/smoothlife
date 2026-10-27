"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import LoginContent from "@/components/LoginContent";

// The sign-in page, wearing the dialog.
//
// There is no full-page sign-in any more — it is the same card the header
// opens, over a dimmed site, wherever somebody lands on this address.
//
// The route stays because a dialog cannot be linked to and plenty of things
// link here: the account area's own gate, the staff shop, OAuth errors
// coming back from LINE and Google. Turning the route into a redirect
// somewhere else would be worse than keeping it — half of what links here
// is a page that bounces signed-out visitors, so a redirect back to it is a
// loop, and the one place guaranteed not to bounce is the one nobody asked
// for.
//
// So: same markup as components/account/LoginModal, minus the machinery
// that opens and closes it, because here it is simply open.

export default function LoginDialog() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") || "/account";

  function close() {
    // Back where they came from when there is a back to go to — this is a
    // real navigation, and the thing behind the dim is usually the page they
    // were reading. Arriving here cold (a bookmark, a link from LINE) has no
    // history to return to, and the shop is a better answer than nothing.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="เข้าสู่ระบบ"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-1000/45 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-cardHover sm:p-7">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-surface-soft hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
        >
          <X size={18} aria-hidden />
          <span className="sr-only">ปิด</span>
        </button>
        {/* variant="modal" is what drops the page-sized title block inside
            LoginContent; the card supplies its own heading. */}
        <div className="max-h-[80vh] overflow-y-auto">
          <LoginContent variant="modal" returnTo={returnTo} />
        </div>
      </div>
    </div>
  );
}
