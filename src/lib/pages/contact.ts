import { z } from "zod";

// How to reach the shop, in one place.
//
// Before this, the phone number lived in four files — the footer, /stores,
// /help/contact and the campaign pages' chrome — and the comment at the top
// of the footer asked whoever changed it to keep the others in step. That
// request has no enforcement and no reminder; it survives exactly as long as
// the person who read it.
//
// Now there is one shape and one default, and a document that can override it
// without a deploy. The default is still in code on purpose: the footer is on
// every page of the shop, so "we could not reach the database" must never
// mean "the shop has no phone number".
//
// Nothing here touches the database, deliberately — the contact tiles on
// /help/contact are inside a client component, and a module that reads
// Supabase cannot be imported from one. The reader lives in contact-server.

export const contactSchema = z.object({
  phoneDisplay: z.string().max(40).default(""),
  /** The tel: target. Separate from the display because one has spaces and
   *  dashes for reading and the other must not. */
  phoneHref: z.string().max(40).default(""),
  hours: z.string().max(80).default(""),
  lineHandle: z.string().max(40).default(""),
  /** "Follow us" — the shop page. */
  lineShopUrl: z.string().max(200).default(""),
  /** "Talk to us" — adds the OA as a friend, so there is somewhere to type. */
  lineChatUrl: z.string().max(200).default(""),
  facebookUrl: z.string().max(200).default(""),
  instagramUrl: z.string().max(200).default(""),
  tiktokUrl: z.string().max(200).default(""),
});

export type ContactInfo = z.infer<typeof contactSchema>;

/** The channels the team actually answers, from their contact sheet. */
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

/** The section inside the global document that holds the fields. */
export const CONTACT_SECTION = "contact_info";
