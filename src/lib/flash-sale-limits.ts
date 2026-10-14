// Limits the flash-sale queue is built around.
//
// Here rather than in lib/flash-sale-campaigns.ts, which validates campaigns
// against the catalogue: the live queue screen and the demo both need this
// number and neither needs ~1,000 products to read it.

/** "As many times as they like" — the queue stops counting requeues. */
export const UNLIMITED_REQUEUE = 9999;
