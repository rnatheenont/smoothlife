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
  // — by concern: the sharpest signal, so these are weighted highest —
  { topic: "acne", th: "สิวขึ้นช่วงนี้ ควรเริ่มดูแลยังไงดี", en: "I'm breaking out — where should I start?" },
  { topic: "acne", th: "รอยสิวจางช้า มีตัวช่วยไหม", en: "What helps acne marks fade faster?" },
  { topic: "dryness", th: "ผิวแห้งลอก ควรใช้อะไรก่อน-หลัง", en: "My skin is dry and flaky — what order do I use things?" },
  { topic: "dryness", th: "มอยส์เจอไรเซอร์แบบไหนเหมาะกับผิวแห้ง", en: "Which moisturiser suits dry skin?" },
  { topic: "dark-spots", th: "จุดด่างดำกับรอยแดง ต่างกันยังไง ดูแลต่างกันไหม", en: "Dark spots vs. red marks — treated differently?" },
  { topic: "dark-spots", th: "อยากให้ผิวดูกระจ่างขึ้น เริ่มจากอะไรดี", en: "I want brighter skin — where do I begin?" },
  { topic: "aging", th: "เริ่มใช้เรตินอลตอนไหนดี และเริ่มยังไงไม่ให้ผิวพัง", en: "When and how should I start retinol safely?" },
  { topic: "aging", th: "ริ้วรอยรอบดวงตา ดูแลยังไงได้บ้าง", en: "How do I look after fine lines around my eyes?" },
  { topic: "hair-scalp", th: "ผมร่วงเยอะช่วงนี้ เกิดจากอะไรได้บ้าง", en: "I'm shedding a lot of hair — what causes that?" },
  { topic: "hair-scalp", th: "หนังศีรษะมันแต่ปลายผมแห้ง ควรสระยังไง", en: "Oily scalp but dry ends — how should I wash?" },
  { topic: "sleep-stress", th: "นอนไม่ค่อยหลับ มีอาหารเสริมช่วยได้ไหม", en: "Any supplements that help me sleep?" },
  { topic: "sleep-stress", th: "ช่วงเครียด ๆ ควรเสริมอะไรให้ร่างกาย", en: "What should I take when I'm stressed?" },

  // — by category: what section of the shop they've been in —
  { topic: "skincare", th: "ช่วยจัดรูทีนเช้าแบบง่าย ๆ ให้หน่อย", en: "Build me a simple morning routine" },
  { topic: "skincare", th: "ใช้วิตามินซีคู่กับเรตินอลได้ไหม", en: "Can I use vitamin C with retinol?" },
  { topic: "skincare", th: "เซรั่มตัวไหนเหมาะกับฉันที่สุด", en: "Which serum suits me best?" },
  { topic: "oral-care", th: "ยาสีฟันแบบไหนเหมาะกับเหงือกอักเสบ", en: "Which toothpaste is right for sore gums?" },
  { topic: "oral-care", th: "กลิ่นปากตอนเช้า แก้ยังไงได้บ้าง", en: "How do I deal with morning breath?" },
  { topic: "hair-care", th: "แชมพูแบบไหนเหมาะกับผมทำสี", en: "Which shampoo suits colour-treated hair?" },
  { topic: "wellness", th: "วิตามินตัวไหนควรกินคู่กัน กินพร้อมกันได้ไหม", en: "Which vitamins can I take together?" },
  { topic: "wellness", th: "อาหารเสริมควรกินก่อนหรือหลังอาหาร", en: "Before or after meals — when do I take supplements?" },
  { topic: "body-care", th: "ผิวกายแห้งคัน ควรทาอะไร", en: "Dry, itchy body skin — what should I use?" },
  { topic: "personal-care", th: "เลือกของใช้ส่วนตัวยังไงให้เหมาะกับผิวบอบบาง", en: "Choosing personal care for sensitive skin?" },

  // — general: always eligible, so there is something to ask on a first visit —
  { topic: "general", th: "มีโปรโมชั่นอะไรน่าสนใจตอนนี้บ้าง", en: "What promotions are running right now?" },
  { topic: "general", th: "ช่วยเลือกของขวัญให้หน่อย งบไม่เกิน 1,000", en: "Help me pick a gift under ฿1,000" },
  { topic: "general", th: "สั่งของแล้วกี่วันถึง ส่งฟรีไหม", en: "How long is delivery, and is it free?" },
  { topic: "general", th: "สมัครสมาชิกแล้วได้อะไรบ้าง", en: "What do I get as a member?" },
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
