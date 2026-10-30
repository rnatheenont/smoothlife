/**
 * The one sale, and the one place every "Sale" on the site points at.
 *
 * The header's tag, the home page's Sale disc and the products that scroll
 * past that tag all read from here, so a change of campaign is a change of
 * one line rather than three that drift apart.
 */
// sale-up-to-50-off until 30 Oct 2026, when it turned out Shopify no longer
// had it: every Sale on the site led to a 404 and the ticker quietly fell
// back to the rest of the catalogue's markdowns. Standing in for it until
// "Clearance Sale: Nov'26" (clearance-sale-70-off) is published to the
// sales channel — it exists in Shopify but is not published anywhere yet,
// so the Storefront API cannot see it and a build cannot either.
export const SALE_COLLECTION = "buy-1-get-1-free-deal";
export const SALE_HREF = `/collections/${SALE_COLLECTION}`;
