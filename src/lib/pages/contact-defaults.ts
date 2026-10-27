// Split out of contact.ts so a client component can read this constant
// without importing zod with it. The contact page is a client component. Pulling it through the schema module
// put a 94 KB validator in the browser to look up some links.
//
// The type comes back as `import type`, which the build erases.

import type { ContactInfo } from "./contact.ts";

export const CONTACT_DEFAULT: ContactInfo = {
  phoneDisplay: "085-489-0549",
  phoneHref: "tel:0854890549",
  hours: "ทุกวัน 09:00–18:00 น.",
  lineHandle: "@smoothlifeofficial",
  lineShopUrl: "https://shop.line.me/@smoothlifeofficial",
  lineChatUrl: "https://line.me/R/ti/p/@smoothlifeofficial",
  facebookUrl: "https://www.facebook.com/smoothlifeofficial",
  instagramUrl: "https://www.instagram.com/smoothlife_official",
  tiktokUrl: "https://www.tiktok.com/@smoothlife_pharmacy",
};
