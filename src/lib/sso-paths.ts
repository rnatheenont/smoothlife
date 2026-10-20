/**
 * The pages worth a silent round trip to Shopify for.
 *
 * Silent sign-in used to run on every page, which meant every first visit —
 * including a stranger who has never had an account — was sent to Shopify and
 * back before the page was usable. Measured on the home page with Lighthouse
 * on 19 Oct 2026: 23.8 seconds of redirect on a throttled phone, 4.6 on
 * desktop. The visit most likely to be somebody's first was paying the most
 * for a courtesy aimed at returning customers.
 *
 * These three are where not knowing who someone is actually costs them
 * something: the account area is theirs, and the basket and the checkout are
 * where being signed in decides whether they type an address again. Somebody
 * browsing products does not need to be identified to read, and the normal
 * path to buying goes through the basket, so the sign-in still happens before
 * it matters. Everywhere else keeps the login button.
 *
 * Its own module so it can be tested without pulling a "use client"
 * component, its router and its auth context into the test.
 */
export const SSO_PATHS = ["/account", "/cart", "/checkout"];

/**
 * Whether this path is one of them.
 *
 * Matched as a whole segment, not a prefix: "/cartoon" is not the basket, and
 * sending someone reading an article to Shopify and back is the exact thing
 * this list exists to stop.
 */
export function wantsIdentity(path: string): boolean {
  return SSO_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
