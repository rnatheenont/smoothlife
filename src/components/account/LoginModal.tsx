"use client";

import { useEffect } from "react";
import { Modal } from "@heroui/react";
import { X } from "lucide-react";
import LoginContent from "@/components/LoginContent";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";

// Signing in without leaving the page.
//
// The page at /account/login is still there and still the thing every
// redirect points at. This is for the header: being asked who you are is an
// interruption, and an interruption should give the page back when it is
// over rather than making you find your way to it again.

export default function LoginModal() {
  const { isOpen, close, returnTo } = useLoginModal();
  const { user } = useAuth();

  // Closed by the result, not by each of the five flows inside it. Phone,
  // email, password and the three that leave for another site all finish the
  // same way — a signed-in user — and watching for that covers the ones that
  // come back from elsewhere too.
  useEffect(() => {
    if (user && isOpen) close();
  }, [user, isOpen, close]);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      <Modal.Backdrop className="bg-brand-1000/45 backdrop-blur-sm">
        <Modal.Container placement="center" size="md">
          <Modal.Dialog
            aria-label="เข้าสู่ระบบ"
            className="relative w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-cardHover outline-none sm:p-7"
          >
            <Modal.CloseTrigger className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-surface-soft hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800">
              <X size={18} aria-hidden />
              <span className="sr-only">ปิด</span>
            </Modal.CloseTrigger>
            <Modal.Body className="max-h-[80vh] overflow-y-auto">
              <LoginContent variant="modal" returnTo={returnTo} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
