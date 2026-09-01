import { twoC2PConfigured } from "@/lib/2c2p";
import CustomCheckout from "@/components/CustomCheckout";
import ShopifyRedirectCheckout from "@/components/ShopifyRedirectCheckout";

// Server component so twoC2PConfigured() (reads server-only env vars, not
// available client-side) can decide which checkout renders — matches the
// same subscriptionBillingEnabled-style dual-mode pattern used everywhere
// else 2C2P shows up in this app (subscribe buttons, /subscription/build).
// CustomCheckout only renders once real 2C2P credentials exist; until then
// this is a no-op and the existing Shopify-hosted checkout runs unchanged.
export default function CheckoutPage() {
  return twoC2PConfigured() ? <CustomCheckout /> : <ShopifyRedirectCheckout />;
}
