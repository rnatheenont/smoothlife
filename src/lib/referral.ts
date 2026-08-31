import { randomBytes } from "crypto";

// Server-only (node:crypto) — never import from a "use client" component.
// Shared constants/types live in @/lib/referral-shared instead.

// 8-char base36, uppercased for readability when shared verbally/in chat.
export function generateReferralCode(): string {
  return randomBytes(6).toString("hex").slice(0, 8).toUpperCase();
}

export function generateDiscountCode(prefix: string): string {
  return `${prefix}${randomBytes(4).toString("hex").toUpperCase()}`;
}
