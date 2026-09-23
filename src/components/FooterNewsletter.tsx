"use client";

import { useState } from "react";
import { Button, Description, FieldError, Input, Label, TextField } from "@heroui/react";
import { Send, CheckCircle2 } from "lucide-react";

// Split out of Footer.tsx so the footer itself can stay a server component —
// this form is the only part of it that needs state, and it was dragging the
// whole footer (four link columns, contact block, payment row) into the client
// bundle on every page of the site.
//
// HeroUI v3 (TextField/Input/Label/Description/FieldError/Button) rather than
// a hand-built input: it carries the label/description/error wiring — the
// aria-describedby and aria-invalid this form used to set by hand — and the
// Button's pending state. Their CSS is registered in src/app/heroui.css.
export default function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setError("สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <p
        // Announced, not just shown: the form is replaced on success, and a
        // screen reader user gets no other signal that it worked.
        role="status"
        className="flex items-center gap-1.5 text-sm font-medium text-brand-800"
      >
        <CheckCircle2 size={16} aria-hidden /> สมัครรับข่าวสารสำเร็จแล้วค่ะ
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <TextField
        type="email"
        isRequired
        value={email}
        onChange={setEmail}
        isInvalid={Boolean(error)}
        fullWidth
      >
        {/* `after:content-none` drops HeroUI's required asterisk. isRequired
            stays, so the field keeps aria-required and the browser still
            blocks an empty submit — but a lone optional newsletter box in a
            footer has no second field to be marked apart from, and a red *
            there reads as a warning rather than as "this one is needed". */}
        <Label className="text-sm font-semibold text-brand-ink after:content-none">
          รับข่าวโปรโมชั่นและสินค้าใหม่ก่อนใคร
        </Label>
        <Description className="text-xs text-slate-600">ส่งเดือนละครั้ง ยกเลิกได้ทุกเมื่อ</Description>
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder="อีเมลของคุณ"
            autoComplete="email"
            className="h-11 min-w-0 flex-1 rounded-full border border-surface-line bg-white px-4 text-sm text-brand-ink placeholder:text-slate-400"
          />
          <Button
            type="submit"
            isDisabled={status === "loading"}
            isPending={status === "loading"}
            aria-label="สมัครรับข่าวสาร"
            // 44px: WCAG 2.5.5 target size. The old hand-built button was 36px.
            // The brand gradient is the site's own primary fill, kept over
            // HeroUI's default so the footer matches every other CTA.
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient p-0 text-white hover:opacity-90"
          >
            <Send size={16} aria-hidden />
          </Button>
        </div>
        <FieldError className="mt-1.5 block text-xs text-rose-700">{error}</FieldError>
      </TextField>
    </form>
  );
}
