// The rule the receipt campaign is judged by, where the form can read it.
//
// lib/receipt-campaign.ts matches receipt lines against the catalogue, so a
// form that only needs to print the amount cannot import the threshold from
// there without taking the catalogue with it.

/** Spend at or above this, on anything, and a receipt qualifies (THB). */
export const GENERAL_THRESHOLD = 690;
