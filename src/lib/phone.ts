// Thai phone number rules, shared by every address form so the checkout and
// the account pages can't drift apart on what counts as a valid number.
//
// Two real shapes exist and both have to be accepted — a courier calling a
// Bangkok landline is as normal as calling a mobile:
//   mobile   10 digits, 06/08/09 prefix   e.g. 0891234567
//   landline  9 digits, 02–07 prefix      e.g. 021234567
const THAI_MOBILE = /^0[689]\d{8}$/;
const THAI_LANDLINE = /^0[2-7]\d{7}$/;

export const THAI_PHONE_HINT = "เบอร์ไทย 10 หลัก (เช่น 0891234567) หรือเบอร์บ้าน 9 หลัก (เช่น 021234567)";

/** Keystroke filter: digits only, never longer than a Thai number can be. */
export function sanitiseThaiPhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

export function isThaiPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return THAI_MOBILE.test(digits) || THAI_LANDLINE.test(digits);
}

/**
 * Whether this phone passes for the given country. Only Thailand is checked —
 * the address forms genuinely support shipping to 13 other countries, and
 * rejecting a valid Singaporean number because it isn't a Thai one would be a
 * bug, not a safeguard.
 */
export function isValidPhoneForCountry(value: string, country: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (country && country !== "TH") return trimmed.replace(/[^\d]/g, "").length >= 6;
  return isThaiPhone(trimmed);
}
