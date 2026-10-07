/**
 * The one sale, and the one place every "Sale" on the site points at.
 *
 * The header's tag, the home page's Sale disc and the products that scroll
 * past that tag all read from here, so a change of campaign is a change of
 * one line rather than three that drift apart.
 */
export const SALE_COLLECTION = "sale-up-to-50-off";
export const SALE_HREF = `/collections/${SALE_COLLECTION}`;
