import type {
  StaffEligibility,
  StaffOrder,
  StaffRound,
  StaffRoundItem,
} from "@/lib/staff-sale";

// What the console's API routes hand back, as the tabs see it.
//
// Separate from the row types in @/lib/staff-sale because these carry the
// numbers the routes computed on top of the rows — the same shapes the
// fetches in this folder parse, named once.

export type RoundStats = {
  verified: number;
  buyers: number;
  sold_thb: number;
  pending: number;
};

export type RoundWithStats = StaffRound & { stats: RoundStats };

export type RoundOverview = {
  verified: number;
  buyers: number;
  sold_thb: number;
  orders_paid: number;
  orders_pending: number;
  needs_refund: number;
  sync_failed: number;
  top: { variant_id: string; slug: string; qty: number; thb: number }[];
};

/**
 * A price-list row with the words a person reads.
 *
 * The stored row keys off a slug and a variant id; these come from the
 * catalogue on the way out (see the round route's `describe`) so the table
 * can show a picture, a name and the SKU of the exact size. Null when the
 * product has left the catalogue — the row still shows, by slug.
 */
export type StaffRoundItemView = StaffRoundItem & {
  name: string | null;
  brand: string | null;
  image: string | null;
  size: string | null;
  sku: string | null;
};

export type RoundDetail = {
  round: StaffRound;
  items: StaffRoundItemView[];
  orders: StaffOrder[];
  verifications: { user_id: string; staff_email_canonical: string; verified_at: string }[];
  entitlements: { user_id: string; cap_thb: number; reserved_thb: number; spent_thb: number }[];
  overview: RoundOverview;
};

export type AdminStaffOrder = StaffOrder & {
  round_name: string | null;
  display_name: string | null;
  shopify_customer_id: string | null;
};

export type EligibilityRule = StaffEligibility;

/** One variant as the product picker lists it. */
export type PickerVariant = {
  variant_id: string;
  size: string;
  sku: string | null;
  price: number;
  compare_at: number | null;
  in_stock: boolean;
  quantity: number | null;
};

export type PickerProduct = {
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  variants: PickerVariant[];
};

export type CollectionSummary = { handle: string; title: string; count: number };
