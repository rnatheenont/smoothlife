import type { Locale } from "../localized";
import { th, type Messages } from "./th";
import { en } from "./en";

export type { Messages };

/**
 * The shop's own words in one language.
 *
 * Server-side and synchronous on purpose: a section already knows its locale
 * (ctx.locale), so the words it needs are a lookup, not a fetch. A client
 * component gets the one group it needs handed down as a prop from the server
 * component that draws it — which is why there is no provider here. Shipping
 * both dictionaries to the browser to let a clock pick four words out of them
 * would cost every visitor the whole file.
 */
export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : th;
}
