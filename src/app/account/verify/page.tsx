"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { AlertTriangle, Check, Loader2, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { Button } from "@/components/ui";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { toE164Thai } from "@/lib/thai-phone";
import { askToSendOtp } from "@/lib/otp-allowance";
import { CHANNELS, channelLabel, type ChannelKey } from "@/lib/account-identities";

// "ช่องทางเข้าสู่ระบบ" — every way in, and one account behind them.
//
// The page exists because signing in by email today and by phone tomorrow
// made two accounts, each with half the history, and nothing in the app
// ever said so. It does two things: shows which channels this account
// answers to, and lets a shopper prove another one. If that other channel
// turns out to belong to an account of their own, it offers to fold the
// two together — with the orders and points of each on screen first,
// because the merge cannot be undone.

type Identity = { provider: ChannelKey; masked: string; verifiedAt: string | null };
type Account = { name: string; createdAt: string; points: number; orders: number };
type PreviewAccount = {
  id: string;
  name: string;
  created_at: string;
  orders: number;
  points: number;
  channels: string[];
  has_shopify: boolean;
};
type Preview = { survivor: string; accounts: PreviewAccount[]; shopify_conflict: boolean };

const ICONS: Record<ChannelKey, typeof Mail> = {
  email: Mail,
  phone_otp: Phone,
  google: Sparkles,
  line: Sparkles,
};

function thaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function VerifyContent() {
  const [account, setAccount] = useState<Account | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState<ChannelKey | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const [merge, setMerge] = useState<{ ticket: string; preview: Preview } | null>(null);
  const [merging, setMerging] = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [recaptchaKey, setRecaptchaKey] = useState(0);

  const load = useCallback(async () => {
    // Two questions on every load: what does this account answer to, and
    // did a Google or LINE redirect just leave a decision parked in a
    // cookie for this page to put on screen.
    const [res, pendingRes] = await Promise.all([
      fetch("/api/account/identities"),
      fetch("/api/account/identities/pending"),
    ]);
    const data = await res.json();
    if (data.ok) {
      setAccount(data.account);
      setIdentities(data.identities);
    }
    const waiting = await pendingRes.json().catch(() => null);
    if (waiting?.pending) {
      setMerge({ ticket: waiting.pending.ticket, preview: waiting.pending.preview });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ?linked=google comes back on the redirect, so the shopper is told the
  // button they pressed did something — before this, signing in with a
  // provider while already signed in silently moved them to another
  // account, which is the behaviour this page exists to undo.
  useEffect(() => {
    const linked = new URLSearchParams(window.location.search).get("linked");
    if (linked) {
      setDone(`เชื่อม ${channelLabel(linked)} กับบัญชีนี้แล้ว`);
      window.history.replaceState(null, "", "/account/verify");
    }
  }, []);

  function reset() {
    setOpen(null);
    setEmail("");
    setPhone("");
    setCode("");
    setSent(false);
    setError("");
    confirmationRef.current = null;
  }

  async function sendEmailCode() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/email-otp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) return setError(data.error || "ส่งรหัสไม่สำเร็จ");
    setSent(true);
  }

  async function sendPhoneCode() {
    setError("");
    setBusy(true);
    try {
      // Permission before the SMS. See @/lib/otp-allowance.
      const allowed = await askToSendOtp(phone);
      if (!allowed.ok) {
        setError(allowed.error);
        return;
      }
      const auth = getFirebaseAuth();
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, "verify-recaptcha", { size: "invisible" });
      }
      confirmationRef.current = await signInWithPhoneNumber(auth, toE164Thai(phone), recaptchaRef.current);
      setSent(true);
    } catch (err) {
      console.error("[verify phone] send failed", err);
      setError("ส่งรหัส SMS ไม่สำเร็จ กรุณาตรวจสอบเบอร์แล้วลองใหม่");
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setRecaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  // The one place a proof turns into either a link or an offer to merge.
  async function submitProof() {
    setError("");
    setBusy(true);
    try {
      let body: Record<string, unknown>;
      if (open === "email") {
        body = { provider: "email", email: email.trim().toLowerCase(), code: code.trim() };
      } else {
        if (!confirmationRef.current) return;
        const credential = await confirmationRef.current.confirm(code.trim());
        body = { provider: "phone_otp", idToken: await credential.user.getIdToken() };
      }
      const res = await fetch("/api/account/identities/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) return setError(data.error || "ยืนยันไม่สำเร็จ");

      if (data.state === "merge_required") {
        setMerge({ ticket: data.ticket, preview: data.preview });
        reset();
        return;
      }
      setDone(data.alreadyMine ? "ช่องทางนี้ผูกกับบัญชีนี้อยู่แล้ว" : "เชื่อมช่องทางเรียบร้อยแล้ว");
      reset();
      await load();
    } catch (err) {
      console.error("[verify] proof failed", err);
      setError("รหัสไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMerge() {
    if (!merge) return;
    setMerging(true);
    const res = await fetch("/api/account/identities/merge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket: merge.ticket }),
    });
    const data = await res.json();
    setMerging(false);
    if (!data.ok) {
      setError(data.error || "รวมบัญชีไม่สำเร็จ");
      setMerge(null);
      return;
    }
    // The session may now belong to the other account, so everything on
    // screen — the header, the points, the order list — is stale. A reload
    // is the honest way to show an account that changed underneath.
    window.location.href = "/account/verify?merged=1";
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> กำลังโหลด…
      </div>
    );
  }

  const held = new Set(identities.map((i) => i.provider));

  return (
    <div className="max-w-2xl">
      <div key={recaptchaKey} id="verify-recaptcha" />

      <header className="mb-5">
        <div className="mb-1 flex items-center gap-2 text-brand-800">
          <ShieldCheck size={20} />
          <span className="text-sm font-semibold">ช่องทางเข้าสู่ระบบ</span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          เข้าสู่ระบบด้วยช่องทางไหนก็ได้ แล้วมาที่บัญชีเดียวกัน
          ถ้าเคยสมัครไว้หลายช่องทาง ยืนยันช่องทางนั้นที่นี่เพื่อรวมแต้มและประวัติการสั่งซื้อเข้าด้วยกัน
        </p>
      </header>

      {account && (
        <div className="mb-5 rounded-xl2 bg-brand-gradient-soft p-5">
          <p className="text-xs text-slate-500">บัญชีที่ใช้อยู่ตอนนี้</p>
          <p className="text-base font-bold text-brand-ink">{account.name}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["สมาชิกตั้งแต่", thaiDate(account.createdAt)],
                ["แต้มสะสม", account.points.toLocaleString("th-TH")],
                ["คำสั่งซื้อ", String(account.orders)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/70 py-2">
                <dt className="text-[11px] leading-tight text-slate-500">{label}</dt>
                <dd className="text-sm font-bold text-brand-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {done && (
        <p className="mb-4 flex items-center gap-2 rounded-xl2 bg-brand-gradient-soft px-4 py-3 text-sm font-semibold text-brand-800">
          <Check size={16} /> {done}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {CHANNELS.map((channel) => {
          const mine = identities.find((i) => i.provider === channel.key);
          const Icon = ICONS[channel.key];
          const isOpen = open === channel.key;
          return (
            <li key={channel.key} className="rounded-xl2 border border-surface-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-soft text-brand-800">
                    <Icon size={18} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-ink">{channel.label}</p>
                    <p className="truncate text-xs text-slate-500">
                      {mine ? mine.masked || "เชื่อมแล้ว" : channel.hint}
                    </p>
                  </div>
                </div>
                {mine ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-gradient-soft px-3 py-1.5 text-xs font-semibold text-brand-800">
                    <Check size={13} /> เชื่อมแล้ว
                  </span>
                ) : channel.how === "otp" ? (
                  <button
                    type="button"
                    onClick={() => (isOpen ? reset() : (reset(), setOpen(channel.key)))}
                    className="h-11 shrink-0 rounded-full px-4 text-xs font-semibold text-brand-800"
                  >
                    {isOpen ? "ยกเลิก" : "เชื่อมต่อ"}
                  </button>
                ) : (
                  // Nothing to type: the provider answers for them. The
                  // callback attaches it to this account and comes back
                  // here, rather than signing them into a different one.
                  <a
                    href={`/api/auth/${channel.key}/start?returnTo=${encodeURIComponent("/account/verify")}`}
                    className="inline-flex h-11 shrink-0 items-center rounded-full px-4 text-xs font-semibold text-brand-800"
                  >
                    เชื่อมต่อ
                  </a>
                )}
              </div>

              {isOpen && (
                <div className="mt-4 border-t border-surface-line pt-4">
                  {!sent ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type={channel.key === "email" ? "email" : "tel"}
                        inputMode={channel.key === "email" ? "email" : "tel"}
                        autoComplete={channel.key === "email" ? "email" : "tel"}
                        value={channel.key === "email" ? email : phone}
                        onChange={(e) =>
                          channel.key === "email" ? setEmail(e.target.value) : setPhone(e.target.value)
                        }
                        placeholder={channel.key === "email" ? "you@example.com" : "08x-xxx-xxxx"}
                        className="w-full rounded-xl2 bg-surface-soft px-4 py-3 text-sm outline-hidden focus:ring-2 focus:ring-brand-teal/40"
                      />
                      <Button
                        size="none"
                        className="shrink-0 px-6 py-3 text-sm"
                        disabled={busy}
                        loading={busy}
                        onClick={channel.key === "email" ? sendEmailCode : sendPhoneCode}
                      >
                        ส่งรหัส
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="รหัส 6 หลัก"
                        className="w-full rounded-xl2 bg-surface-soft px-4 py-3 text-sm tracking-widest outline-hidden focus:ring-2 focus:ring-brand-teal/40"
                      />
                      <Button
                        size="none"
                        className="shrink-0 px-6 py-3 text-sm"
                        disabled={busy || code.trim().length < 4}
                        loading={busy}
                        onClick={submitProof}
                      >
                        ยืนยัน
                      </Button>
                    </div>
                  )}
                  {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!held.has("email") && !held.has("phone_otp") && (
        <p className="mt-4 text-xs text-slate-500">
          บัญชีนี้ยังไม่มีอีเมลหรือเบอร์โทรผูกไว้ — เพิ่มอย่างน้อยหนึ่งช่องทางเพื่อให้กู้คืนบัญชีได้ถ้าเข้าไม่ได้
        </p>
      )}

      {merge && (
        <MergePanel
          merge={merge}
          busy={merging}
          onCancel={() => {
            setMerge(null);
            // A ticket parked by a social redirect would otherwise reopen
            // this panel on the next load, which reads as the page refusing
            // to take no for an answer.
            fetch("/api/account/identities/pending", { method: "DELETE" }).catch(() => {});
          }}
          onConfirm={confirmMerge}
        />
      )}
    </div>
  );
}

function MergePanel({
  merge,
  busy,
  onCancel,
  onConfirm,
}: {
  merge: { ticket: string; preview: Preview };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { survivor, accounts, shopify_conflict } = merge.preview;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/40 p-0 sm:place-items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white p-6 sm:max-w-lg sm:rounded-3xl">
        <h2 className="text-base font-bold text-brand-ink">ช่องทางนี้เป็นของอีกบัญชีหนึ่ง</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          ถ้าทั้งสองบัญชีเป็นของคุณ รวมเข้าด้วยกันได้เลย — แต้ม คำสั่งซื้อ ที่อยู่ และรีวิวจะย้ายมารวมกันทั้งหมด
          <strong className="font-semibold text-brand-ink"> รวมแล้วย้อนกลับไม่ได้</strong>
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {accounts.map((a) => {
            const keeps = a.id === survivor;
            return (
              <li
                key={a.id}
                className={`rounded-xl2 p-4 ${keeps ? "bg-brand-gradient-soft" : "bg-surface-soft"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-brand-ink">{a.name}</p>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-brand-800">
                    {keeps ? "บัญชีที่เก็บไว้" : "จะถูกรวมเข้าไป"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  สมาชิกตั้งแต่ {thaiDate(a.created_at)} · {a.orders} คำสั่งซื้อ ·{" "}
                  {a.points.toLocaleString("th-TH")} แต้ม
                </p>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs text-slate-500">
          ระบบเก็บบัญชีที่สมัครก่อน เพราะเป็นบัญชีที่ผูกกับประวัติการสั่งซื้อไว้แล้ว
        </p>

        {shopify_conflict && (
          <p className="mt-3 flex items-start gap-2 rounded-xl2 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            ทั้งสองบัญชีผูกกับลูกค้าคนละรายในระบบหลังบ้าน เรารวมฝั่งเว็บให้ได้ทันที
            ส่วนประวัติฝั่งร้านทีมงานจะตรวจให้อีกครั้ง
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-12 rounded-full px-6 text-sm font-semibold text-slate-600"
          >
            ไว้ก่อน
          </button>
          <Button size="none" className="px-6 py-3 text-sm" disabled={busy} loading={busy} onClick={onConfirm}>
            รวมบัญชี
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AccountLayout>
      <VerifyContent />
    </AccountLayout>
  );
}
