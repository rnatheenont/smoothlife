// "081-234-5678" → "+66812345678".
//
// Lives on its own rather than in firebase-client.ts, where it started: the
// checkout and the product page's subscribe button only need this one line
// of string handling, and importing it from there pulled the Firebase SDK
// (~200 KB) into both — and, through the product page, onto every visitor's
// first load.
export function toE164Thai(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+66" + digits.slice(1);
  if (digits.startsWith("66")) return "+" + digits;
  return "+66" + digits;
}
