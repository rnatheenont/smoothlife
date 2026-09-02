// Field rules shared by every address/profile form, so the checkout modal and
// the account pages can't disagree about what a valid value looks like.
// Phone lives in ./phone.ts — it had enough rules of its own to earn a file.

/** Thai postcodes are exactly 5 digits and never start with 0. */
export function isThaiPostcode(value: string): boolean {
  return /^[1-9]\d{4}$/.test(value.trim());
}

/**
 * Thai 13-digit tax / national ID, including the mod-11 check digit — length
 * alone would accept a typo'd digit, which is exactly the mistake that later
 * makes a tax invoice unusable for the customer.
 */
export function isThaiTaxId(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

/**
 * Deliberately permissive: something@something.tld. Anything stricter starts
 * rejecting real addresses, and the only test that actually proves an email
 * works is sending to it.
 */
export function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** A recipient a courier can ask for — not a single letter, not a phone number. */
export function isPersonName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && !/^\d+$/.test(trimmed);
}

/** Enough of a street line to be deliverable rather than "-" or "บ้าน". */
export function isAddressLine(value: string): boolean {
  return value.trim().length >= 5;
}

export const VALIDATION_HINTS = {
  postcode: "รหัสไปรษณีย์ไทยมี 5 หลัก",
  taxId: "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลักและถูกต้องตามรูปแบบ",
  email: "รูปแบบอีเมลไม่ถูกต้อง (เช่น name@example.com)",
  name: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร",
  addressLine: "กรุณากรอกที่อยู่ให้ละเอียดกว่านี้ (อย่างน้อย 5 ตัวอักษร)",
} as const;
