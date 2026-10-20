import type { FaqIndexItem } from "@/lib/faq-public";

// Layer one of the FAQ search: ranking in the browser, with no request.
//
// Thai is the reason this is substring matching rather than token matching.
// There are no spaces between words, so "ตาล้าจากการจ้องจอ" cannot be split
// into words without a dictionary — and shipping a Thai word-break dictionary
// to rank thirty-odd questions would cost more than the whole page. Substring
// matching needs no dictionary and, for a list this size, is exact enough.
//
// The keywords carry the weight. Every question arrived with the words
// customers actually type — "หน้ามัน", "เสียวฟัน", "ตาล้า" — written by
// whoever wrote the answer, which makes a keyword hit the strongest signal
// available here. Scored above a match in the question text for that reason.
//
// This runs on a keystroke, so it does no allocation per item beyond the
// score itself, and the server does the normalising of the index once.

const ZERO_WIDTH = /[​-‍﻿­]/g;

/** Lowercased, zero-width stripped, whitespace collapsed. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(ZERO_WIDTH, "").replace(/\s+/g, " ").trim();
}

const SCORE = {
  /** The whole query appears in the question. */
  phraseInTitle: 10,
  /** One of the author's keywords appears in the query, or the query in it. */
  keyword: 8,
  /** Part of the query appears in the question. */
  partInTitle: 4,
  /** Part of the query appears in the answer excerpt. */
  partInAnswer: 1,
  /** Tie-break only: a question the team pinned. */
  pinned: 1,
} as const;

/**
 * Query parts. Space-separated for English and for the way Thai speakers
 * separate ideas ("หน้ามัน เป็นสิว"), with the whole query kept as one part
 * so an unspaced Thai sentence still matches.
 *
 * Parts shorter than two characters are dropped: a single Thai character
 * appears in almost every question and would flatten the ranking.
 */
function queryParts(query: string): string[] {
  const whole = normalize(query);
  if (!whole) return [];
  const pieces = whole.split(" ").filter((p) => p.length >= 2);
  return pieces.length > 1 ? [whole, ...pieces] : [whole];
}

export type FaqScored = { item: FaqIndexItem; score: number };

/** One question's score against the query, 0 when nothing matched. */
function scoreItem(item: FaqIndexItem, whole: string, parts: string[]): number {
  const title = normalize(item.title);
  const titleEn = item.title_en ? normalize(item.title_en) : "";
  const answer = normalize(item.excerpt);

  let score = 0;

  if (whole && (title.includes(whole) || (titleEn && titleEn.includes(whole)))) {
    score += SCORE.phraseInTitle;
  }

  // Both directions, because the short one can be either side: the customer
  // types "ตาล้า" and the keyword is "ตาล้าจากการจ้องจอ", or the customer
  // types the sentence and the keyword is the short word inside it.
  for (const raw of item.keywords) {
    const kw = normalize(raw);
    if (kw.length < 3) continue;
    if (whole.includes(kw) || kw.includes(whole)) {
      score += SCORE.keyword;
      break;
    }
  }

  for (const part of parts) {
    if (part === whole && score >= SCORE.phraseInTitle) continue;
    if (title.includes(part) || (titleEn && titleEn.includes(part))) score += SCORE.partInTitle;
    else if (answer.includes(part)) score += SCORE.partInAnswer;
  }

  if (score > 0 && item.pinned) score += SCORE.pinned;
  return score;
}

/**
 * The questions that match, best first. An empty query matches everything at
 * score 0, which is what the unfiltered page wants — the caller keeps the
 * index's own order in that case.
 */
export function scoreFaq(index: FaqIndexItem[], query: string): FaqScored[] {
  const parts = queryParts(query);
  if (parts.length === 0) return index.map((item) => ({ item, score: 0 }));
  const whole = parts[0];

  const hits: FaqScored[] = [];
  for (const item of index) {
    const score = scoreItem(item, whole, parts);
    if (score > 0) hits.push({ item, score });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/**
 * Where the query appears in a piece of text, for highlighting. Ranges are
 * merged and in order, so a caller can walk the string once.
 *
 * Returns positions rather than marked-up HTML on purpose: the text comes
 * from a database column, and building HTML here would put the decision about
 * escaping in the wrong place.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const parts = queryParts(query).filter((p) => p.length >= 2);
  if (parts.length === 0) return [];
  const hay = normalize(text);
  // normalize() can shorten the string (collapsed whitespace), which would
  // put every later offset in the wrong place. Only safe to map positions
  // back when nothing moved.
  if (hay.length !== text.length) return [];

  const found: [number, number][] = [];
  for (const part of parts) {
    let from = 0;
    for (;;) {
      const at = hay.indexOf(part, from);
      if (at < 0) break;
      found.push([at, at + part.length]);
      from = at + part.length;
    }
  }
  if (found.length === 0) return [];

  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [found[0]];
  for (const [start, end] of found.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
