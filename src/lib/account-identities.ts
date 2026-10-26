// The login channels an account can hold, named the way a shopper names them.
//
// Browser-safe on purpose: the Verify page and the API both read from here,
// so the four provider strings in auth_identities cannot come to mean one
// thing on the server and another on the page.

export type ChannelKey = "email" | "phone_otp" | "google" | "line";

export type Channel = {
  key: ChannelKey;
  label: string;
  /** What the shopper does to attach it. */
  how: "otp" | "signin";
  hint: string;
};

export const CHANNELS: Channel[] = [
  {
    key: "email",
    label: "อีเมล",
    how: "otp",
    hint: "รับรหัส 6 หลักทางอีเมลเพื่อยืนยันว่าเป็นของคุณ",
  },
  {
    key: "phone_otp",
    label: "เบอร์โทรศัพท์",
    how: "otp",
    hint: "รับรหัส SMS เพื่อยืนยันว่าเป็นเบอร์ของคุณ",
  },
  // Google and LINE prove themselves by signing in: there is no code to
  // type, the provider answers for the shopper. The page says so rather
  // than showing a box that cannot be filled.
  { key: "google", label: "Google", how: "signin", hint: "เข้าสู่ระบบด้วย Google เพื่อผูกเข้ากับบัญชีนี้" },
  { key: "line", label: "LINE", how: "signin", hint: "เข้าสู่ระบบด้วย LINE เพื่อผูกเข้ากับบัญชีนี้" },
];

export function channelLabel(key: string): string {
  return CHANNELS.find((c) => c.key === key)?.label ?? key;
}

/**
 * Enough of the address or number to recognise, not enough to copy down.
 *
 * The page lists channels a shopper may not remember attaching, sometimes
 * on a screen somebody else can see, and the full value is never needed to
 * tell them apart.
 */
export function maskIdentity(provider: string, uid: string): string {
  if (!uid) return "";
  if (provider === "email") {
    const at = uid.lastIndexOf("@");
    if (at < 1) return uid;
    const name = uid.slice(0, at);
    const domain = uid.slice(at);
    const head = name.slice(0, name.length <= 2 ? 1 : 2);
    return `${head}${"•".repeat(Math.max(3, name.length - head.length))}${domain}`;
  }
  if (provider === "phone_otp") {
    const digits = uid.replace(/\D/g, "");
    return digits.length <= 4 ? uid : `${"•".repeat(digits.length - 4)}${digits.slice(-4)}`;
  }
  // A Google subject or a LINE user id is a long opaque string that means
  // nothing to the person it belongs to; the provider's name is the only
  // useful part, so the id is not shown at all.
  return "";
}
