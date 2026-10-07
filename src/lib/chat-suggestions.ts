import type { Category, Concern } from "@/data/types";

// The starter questions under the chat greeting.
//
// They used to be four hard-coded lines, identical for everyone and identical
// every time — so a customer who had just been reading toothpaste pages was
// still asked whether they wanted a serum recommendation, and someone opening
// the chat for the fifth time saw the same four lines they had already
// decided not to tap.
//
// Two changes: the questions are picked from what the customer has actually
// been looking at, and they rotate. Both come from data the site already has
// (recently-viewed products and the cart) — nothing new is collected.

type Topic = Category | Concern | "general";
type Question = { topic: Topic; th: string; en: string };

const POOL: Question[] = [
  // Kept short on purpose. These are chips, not sentences: a tap target the
  // width of the screen reads as a paragraph someone has to finish before
  // deciding, and three of them stacked pushed the banners off a phone. The
  // question only has to be recognisable — the chat has the rest of it.
  //
  // — by concern: the sharpest signal, so these are weighted highest —
  { topic: "acne", th: "สิวขึ้น เริ่มยังไงดี", en: "Breaking out — where to start?" },
  { topic: "acne", th: "รอยสิวจางช้า ทำไงดี", en: "Acne marks fading slowly" },
  { topic: "dryness", th: "ผิวแห้งลอก ใช้อะไรดี", en: "Dry, flaky skin — what to use?" },
  { topic: "dryness", th: "มอยส์เจอไรเซอร์ตัวไหนดี", en: "Which moisturiser?" },
  { topic: "dark-spots", th: "จุดด่างดำ ดูแลยังไง", en: "How to treat dark spots" },
  { topic: "dark-spots", th: "อยากผิวกระจ่างใส", en: "I want brighter skin" },
  { topic: "aging", th: "เริ่มเรตินอลยังไงดี", en: "How do I start retinol?" },
  { topic: "aging", th: "ริ้วรอยรอบดวงตา", en: "Fine lines around my eyes" },
  { topic: "hair-scalp", th: "ผมร่วงเยอะ เพราะอะไร", en: "Why am I shedding hair?" },
  { topic: "hair-scalp", th: "หนังศีรษะมัน ปลายแห้ง", en: "Oily scalp, dry ends" },
  { topic: "sleep-stress", th: "นอนไม่หลับ กินอะไรดี", en: "Can't sleep — what helps?" },
  { topic: "sleep-stress", th: "ช่วงนี้เครียด กินอะไรดี", en: "Stressed — what should I take?" },

  // — by category: what section of the shop they've been in —
  { topic: "skincare", th: "จัดรูทีนเช้าให้หน่อย", en: "Build me a morning routine" },
  { topic: "skincare", th: "วิตซีคู่เรตินอลได้ไหม", en: "Vitamin C with retinol?" },
  { topic: "skincare", th: "เซรั่มตัวไหนเหมาะกับฉัน", en: "Which serum suits me?" },
  { topic: "oral-care", th: "เหงือกอักเสบ ใช้อะไรดี", en: "Sore gums — what helps?" },
  { topic: "oral-care", th: "กลิ่นปากตอนเช้า แก้ยังไง", en: "How to fix morning breath" },
  { topic: "hair-care", th: "ผมทำสี ใช้แชมพูไหนดี", en: "Shampoo for coloured hair" },
  { topic: "wellness", th: "วิตามินตัวไหนกินคู่กันได้", en: "Which vitamins go together?" },
  { topic: "wellness", th: "อาหารเสริมกินตอนไหนดี", en: "When do I take supplements?" },
  { topic: "body-care", th: "ผิวกายแห้งคัน ทาอะไรดี", en: "Dry, itchy body skin" },
  { topic: "personal-care", th: "ผิวบอบบาง เลือกยังไงดี", en: "Choosing for sensitive skin" },

  // — general: always eligible, so there is something to ask on a first visit —
  { topic: "general", th: "ตอนนี้มีโปรอะไรบ้าง", en: "What promotions are on?" },
  { topic: "general", th: "เลือกของขวัญ งบ 1,000", en: "Pick a gift under ฿1,000" },
  { topic: "general", th: "ส่งกี่วัน ส่งฟรีไหม", en: "Delivery time and cost?" },
  { topic: "general", th: "สมาชิกได้อะไรบ้าง", en: "What do members get?" },
];

const SCORE: Record<"concern" | "category" | "general", number> = {
  concern: 3,
  category: 2,
  general: 1,
};

/**
 * Picks the starter questions.
 *
 * `seed` is what makes them rotate — pass a number that changes each time the
 * panel opens. Within a score band the pool is offset by the seed rather than
 * shuffled randomly, so the customer works through the questions instead of
 * being shown the same top two by chance.
 *
 * Deterministic on purpose: no Math.random, so this can be called during
 * render without the server and client disagreeing.
 */
export function pickSuggestions(opts: {
  lang: string;
  categories?: Category[];
  concerns?: Concern[];
  seed?: number;
  count?: number;
}): string[] {
  const { lang, categories = [], concerns = [], seed = 0, count = 4 } = opts;

  const scored = POOL.map((q, i) => {
    const kind =
      concerns.includes(q.topic as Concern)
        ? "concern"
        : categories.includes(q.topic as Category)
          ? "category"
          : q.topic === "general"
            ? "general"
            : null;
    return kind ? { q, score: SCORE[kind], i } : null;
  }).filter((x): x is { q: Question; score: number; i: number } => x !== null);

  // Highest score first; inside a band, start from a different place each
  // open. Rotating by the *band's* own length is the part that matters — an
  // earlier version offset by the whole pool's length, which only ever moved
  // the handful of questions near the end of the array and left the top of
  // the list identical every time.
  const bands = new Map<number, typeof scored>();
  for (const item of scored) {
    const band = bands.get(item.score);
    if (band) band.push(item);
    else bands.set(item.score, [item]);
  }

  const rotated = [...bands.entries()]
    .sort((a, b) => b[0] - a[0])
    .flatMap(([, items]) => {
      const inOrder = [...items].sort((a, b) => a.i - b.i);
      const offset = ((seed % inOrder.length) + inOrder.length) % inOrder.length;
      return [...inOrder.slice(offset), ...inOrder.slice(0, offset)];
    });

  // At most two questions per topic, so a customer who only ever looks at
  // skincare doesn't get four near-identical prompts.
  const perTopic = new Map<Topic, number>();
  const out: string[] = [];
  for (const { q } of rotated) {
    const used = perTopic.get(q.topic) ?? 0;
    if (used >= 2) continue;
    perTopic.set(q.topic, used + 1);
    out.push(lang === "en" ? q.en : q.th);
    if (out.length === count) break;
  }
  return out;
}

/** Categories and concerns implied by the products someone has been looking at. */
export function interestsFromProducts(
  items: { category: Category; concerns: Concern[] }[]
): { categories: Category[]; concerns: Concern[] } {
  const cats = new Map<Category, number>();
  const cons = new Map<Concern, number>();
  for (const p of items) {
    cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
    for (const c of p.concerns) cons.set(c, (cons.get(c) ?? 0) + 1);
  }
  const top = <T,>(m: Map<T, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  // Two of each: enough to personalise, few enough that one stray tap on an
  // unrelated product doesn't take over the whole list.
  return { categories: top(cats, 2), concerns: top(cons, 2) };
}
