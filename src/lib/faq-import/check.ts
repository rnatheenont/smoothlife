// What has to be true before an answer can face a customer.
//
// Two levels, because they are two different questions. A block is "this row
// is not a usable record" — no question, a slug that points at nothing, an
// editor's note left in the text. A warning is "a person should look at this
// before it speaks for the shop" — a price that will go stale, a word that
// turns a supplement into a medicine, an answer so long nobody reads it.
//
// Pure, and told rather than asking: the catalogue and the existing articles
// arrive as lookups so this can be unit-tested and so the same rules run in
// the import preview, in the editor, and at publish time without each of
// those reaching for a database of its own.

export type CheckLevel = "block" | "warn";
export type CheckIssue = { level: CheckLevel; field: string; message: string };

export type CheckableItem = {
  source_ref?: string | null;
  question_th: string;
  answer_th: string;
  question_en?: string | null;
  answer_en?: string | null;
  product_slugs?: string[];
  public_slug?: string | null;
  cta_href?: string | null;
};

export type CheckContext = {
  /** undefined = no such product; false = exists but cannot be bought today. */
  productStatus?: (slug: string) => { exists: boolean; buyable: boolean };
  /** Public slugs already taken by a different article. */
  slugTaken?: (slug: string) => boolean;
};

/**
 * Notes an editor left for themselves.
 *
 * `xxx` is matched with word boundaries on purpose: it is a placeholder on
 * its own and a substring of ordinary words, and flagging every "xxx" inside
 * a URL or a product code would train people to ignore the warning.
 */
const PLACEHOLDER = /\[\s*(fill in|เติม|confirm|ใส่)|(^|\W)(TODO|TBD|xxx)(\W|$)/i;

const PRICE = /฿\s?\d|\d+\s?บาท/;

/**
 * Words that turn a cosmetic or a supplement into a medical claim.
 *
 * Thai advertising rules for food supplements and cosmetics do not allow
 * claims to treat, cure or prevent disease, and this shop sells both. The
 * list is deliberately blunt and the result is only a warning: "รักษา" is
 * also the ordinary word in "รักษาความชุ่มชื้น", so a person decides.
 */
const RISKY_TH = ["รักษา", "หายขาด", "ป้องกันโรค", "ยานอนหลับ", "ลดน้ำหนัก", "การันตี"];

/**
 * The English half needs word boundaries; the Thai half must not have them.
 *
 * Thai is written without spaces, so a boundary would match almost nothing —
 * "รักษา" has to be found inside a run of characters. English is the
 * opposite, and matching it loosely is worse than not matching at all: "heal"
 * is inside "health", "healthy" and "healthcare", which between them appear
 * in most supplement answers this shop will ever write, and "cure" is inside
 * "secure" and "manicure". Run against the real thirty-three, the loose
 * version flagged four answers for the word "health" — the exact way a
 * warning teaches people to click past it.
 */
const RISKY_EN = ["cure", "cures", "treat", "treats", "heal", "heals", "guarantee", "guaranteed"];

const LONG_ANSWER = 600;

export function checkItem(item: CheckableItem, ctx: CheckContext = {}): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const add = (level: CheckLevel, field: string, message: string) => issues.push({ level, field, message });

  if (!item.question_th.trim()) add("block", "question_th", "ต้องมีคำถามภาษาไทย");
  if (!item.answer_th.trim()) add("block", "answer_th", "ต้องมีคำตอบภาษาไทย");

  const all = [item.question_th, item.answer_th, item.question_en ?? "", item.answer_en ?? ""].join("\n");

  if (PLACEHOLDER.test(all)) {
    add("block", "answer_th", "มีข้อความค้างของคนเขียน เช่น [เติม…] หรือ TODO — ลบออกก่อน");
  }

  if (item.public_slug && ctx.slugTaken?.(item.public_slug)) {
    add("block", "public_slug", `ลิงก์ /faq/${item.public_slug} ถูกใช้โดยข้ออื่นแล้ว`);
  }

  const slugs = item.product_slugs ?? [];
  if (ctx.productStatus && slugs.length > 0) {
    const status = slugs.map((s) => ({ slug: s, ...ctx.productStatus!(s) }));
    const missing = status.filter((s) => !s.exists);
    for (const m of missing) add("block", "product_slugs", `ไม่มีสินค้า "${m.slug}" ในร้าน`);

    const present = status.filter((s) => s.exists);
    if (present.length > 0 && present.every((s) => !s.buyable)) {
      add("warn", "product_slugs", "สินค้าที่แนะนำหมดหรือถูกซ่อนทุกตัว — คำตอบจะไม่มีการ์ดสินค้าเลย");
    }
  }

  if (PRICE.test(all)) {
    add("warn", "answer_th", "มีราคาเขียนอยู่ในข้อความ — ราคาจะเก่าเมื่อโปรเปลี่ยน ให้ปล่อยให้การ์ดสินค้าแสดงราคาแทน");
  }

  const hit = [
    ...RISKY_TH.filter((w) => all.includes(w)),
    ...RISKY_EN.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(all)),
  ];
  if (hit.length > 0) {
    add("warn", "answer_th", `มีคำที่อาจเข้าข่ายโฆษณาสรรพคุณ: ${hit.join(", ")} — ให้ฝ่ายที่ดูแลเรื่องนี้อ่านก่อน`);
  }

  if (item.answer_th.length > LONG_ANSWER) {
    add("warn", "answer_th", `คำตอบยาว ${item.answer_th.length} ตัวอักษร — ประโยคแรกควรตอบให้จบใน 2 ประโยค`);
  }

  if (!item.question_en?.trim() || !item.answer_en?.trim()) {
    add("warn", "question_en", "ยังไม่มีฉบับภาษาอังกฤษ — AI จะตอบคำถามภาษาอังกฤษได้แย่กว่า");
  }

  if (item.cta_href && !/^\/(?!\/)/.test(item.cta_href)) {
    add("warn", "cta_href", "ลิงก์ปุ่มควรเป็นลิงก์ภายในเว็บ เช่น /collections/… ");
  }

  return issues;
}

export const blocking = (issues: CheckIssue[]) => issues.filter((i) => i.level === "block");
export const warnings = (issues: CheckIssue[]) => issues.filter((i) => i.level === "warn");
export const canPublish = (issues: CheckIssue[]) => blocking(issues).length === 0;
