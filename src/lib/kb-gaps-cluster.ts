// Folding the same question, asked five different ways, into one row.
//
// "ส่งกี่วัน", "ใช้เวลาส่งกี่วัน", "กว่าของจะถึงกี่วัน" are one gap and one
// answer. Left apart they are three rows an admin reads as three jobs, and
// the counts that decide which to write first are split three ways — so the
// question asked most often can look like the question asked least.
//
// Two ways to tell they are the same, in order of how much they know:
// embeddings when the rows have them, and character bigrams when they do not.
// The fallback is not a placeholder; it is what runs today, because nothing
// has an embedding yet, and it is what keeps running the day the embedding
// provider is down.

export type GapRow = {
  id: string;
  question: string;
  examples: string[] | null;
  hits: number | null;
  sources: string[] | null;
  embedding: number[] | null;
  first_seen?: string | null;
  last_seen?: string | null;
};

export type GapCluster = {
  /** The row the others fold into: the one asked most often. */
  keep: GapRow;
  merge: GapRow[];
  /** What the kept row becomes once the others are folded in. */
  merged: { hits: number; examples: string[]; sources: string[] };
  /**
   * Whether this may be merged without asking.
   *
   * True only when every pair in it was judged by embeddings. A text-only
   * group is a suggestion for a person to accept or reject — see the note on
   * NEAR_BY_TEXT for why that distinction is not caution for its own sake.
   */
  confident: boolean;
};

/** Cosine similarity. Both vectors are already unit length from Voyage, but
 *  the division is kept so a stored vector that is not cannot skew a merge. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Dice coefficient over character bigrams — Thai has no word boundaries. */
export function textSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = s.toLowerCase().replace(/\s+/g, "");
    const out = new Set<string>();
    for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

/** §8.4 puts the embedding threshold at 0.85. */
export const NEAR_BY_EMBEDDING = 0.85;
/**
 * The text threshold, and why nothing merges on it by itself.
 *
 * Measured against real pairs from this shop:
 *
 *   0.933  สมัครสมาชิกยังไง / สมัครสมาชิกยังไงคะ        — same question
 *   0.917  ส่งกี่วันถึง / ส่งกี่วันถึงคะ                  — same question
 *   0.875  ครีมกันแดดสำหรับผิวมัน… / …ผิวแห้ง…           — DIFFERENT question
 *   0.846  ส่งกี่วันถึง / ส่งกี่วันถึงครับ                 — same question
 *   0.696  ส่งกี่วัน / ใช้เวลาส่งกี่วัน                   — same question
 *
 * The different one sits inside the range of the same ones, so no threshold
 * separates them: set it low enough to catch "ครับ" and it swallows a
 * question about dry skin into one about oily skin; set it high enough to be
 * safe and it misses most of what it exists to catch.
 *
 * That is a fact about character overlap, not a number that needs tuning —
 * two Thai sentences about this shop share most of their characters by being
 * Thai sentences about this shop. So a text-only group is never merged
 * automatically. It is offered, and a person says yes.
 *
 * What the threshold is for, then, is deciding what to show — and since
 * showing is free and a person answers, it is set below every same-question
 * pair above (0.80) rather than above the different one. The sunscreen pair
 * gets offered and rejected; "ครับ" gets offered and accepted. The two
 * clearly-different pairs (0.696, 0.684) stay out, so the list does not fill
 * with noise.
 */
export const NEAR_BY_TEXT = 0.8;

function near(a: GapRow, b: GapRow): { near: boolean; byEmbedding: boolean } {
  if (a.embedding && b.embedding) {
    return { near: cosine(a.embedding, b.embedding) >= NEAR_BY_EMBEDDING, byEmbedding: true };
  }
  return { near: textSimilarity(a.question, b.question) >= NEAR_BY_TEXT, byEmbedding: false };
}

/**
 * Group the open gaps.
 *
 * Returns only the groups that would actually change something, so a caller
 * can report "merged 4 into 2" rather than walking a list that is mostly
 * single rows. The row kept is the one asked most often; on a tie, the one
 * seen first, so repeated runs settle rather than swapping rows about.
 *
 * Each group says whether it may be applied without asking. Only the ones
 * judged by embeddings may.
 */
export function clusterGaps(rows: GapRow[]): GapCluster[] {
  const taken = new Set<string>();
  const clusters: GapCluster[] = [];

  const ordered = [...rows].sort((a, b) => {
    const byHits = (b.hits ?? 0) - (a.hits ?? 0);
    if (byHits !== 0) return byHits;
    return String(a.first_seen ?? "").localeCompare(String(b.first_seen ?? ""));
  });

  for (const row of ordered) {
    if (taken.has(row.id)) continue;
    taken.add(row.id);

    const merge: GapRow[] = [];
    let confident = true;
    for (const other of ordered) {
      if (taken.has(other.id)) continue;
      const verdict = near(row, other);
      if (!verdict.near) continue;
      merge.push(other);
      taken.add(other.id);
      if (!verdict.byEmbedding) confident = false;
    }
    if (merge.length === 0) continue;

    const all = [row, ...merge];
    clusters.push({
      keep: row,
      merge,
      confident,
      merged: {
        hits: all.reduce((n, r) => n + (r.hits ?? 0), 0),
        // The wordings are why a person can write the answer, so every
        // variant is kept, newest last, capped the same as a single row.
        examples: [...new Set(all.flatMap((r) => r.examples ?? []))].slice(-10),
        sources: [...new Set(all.flatMap((r) => r.sources ?? []))],
      },
    });
  }

  return clusters;
}
