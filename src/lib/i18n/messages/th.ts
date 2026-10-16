// The words the shop says for itself.
//
// Not the same thing as the two-language fields in localized.ts. Those are
// content: a human typed them into the editor, and a page without a
// translation falls back to the Thai that was typed. These are furniture —
// "สารบัญ", "วัน", "เหลือเวลา" — written by whoever wrote the component, in
// both languages, at the same time. Nobody is ever going to open an admin
// screen to translate the word "วัน".
//
// Thai is the source file and English is checked against it: en.ts declares
// itself as `Messages`, so a key added here and forgotten there is a type
// error rather than an English page with a Thai word in it. (messages.test.ts
// checks the same thing at runtime, for the day somebody reaches for `as`.)
//
// A message that needs a number is a function. It keeps the number inside
// the sentence where the grammar can move it — English puts the unit after
// the figure and Thai does too, but "1 day" and "2 days" differ in English
// and not in Thai, and only the function can know that.

export const th = {
  countdown: {
    /** Read to a screen reader when the clock has no label of its own. */
    label: "นับถอยหลัง",
    day: "วัน",
    hour: "ชม.",
    minute: "นาที",
    second: "วินาที",
    startsIn: "เริ่มใน",
    timeLeft: "เหลือเวลา",
    spokenDays: (d: number, h: number) => `เหลือ ${d} วัน ${h} ชั่วโมง`,
    spokenHours: (h: number, m: number) => `เหลือ ${h} ชั่วโมง ${m} นาที`,
    spokenMinutes: (m: number) => `เหลือ ${m} นาที`,
    spokenSoon: "เหลือไม่ถึง 1 นาที",
  },
  legal: {
    updated: "ปรับปรุงล่าสุด",
    contents: "สารบัญ",
  },
} as const;

/**
 * The shape every language has to fill in.
 *
 * Thai is written `as const`, which makes every value its own literal type —
 * useful for nothing here and fatal for en.ts, which would then be required
 * to answer "สารบัญ" with the string "สารบัญ". Widen() turns each literal
 * back into `string` while leaving a function's arguments exactly as Thai
 * declared them, so English still cannot answer a two-number message with a
 * one-number one.
 */
type Widen<T> = T extends (...args: infer A) => string ? (...args: A) => string : string;

export type Messages = {
  readonly [K in keyof typeof th]: { readonly [P in keyof (typeof th)[K]]: Widen<(typeof th)[K][P]> };
};
