// Answers the advisors key off, where both the question and the rule can
// read them.
//
// The rule that acts on this one lives in lib/supplement-advisor.ts, which
// reads the catalogue — so the quiz cannot import it from there without
// taking ~1,000 products with it.

/** Said by someone who should talk to a pharmacist, not to a quiz: the
 *  supplement advisor recommends nothing at all for this answer. */
export const PREGNANT_OR_BREASTFEEDING = "กำลังตั้งครรภ์/ให้นมบุตร";
