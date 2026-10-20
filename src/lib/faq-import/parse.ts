// Turning what the content team wrote into rows the knowledge base can hold.
//
// Four shapes arrive here, and the importer works out which one it is rather
// than asking: the person pasting a document knows what they pasted, not what
// this code calls it.
//
// The two document shapes are the two "FAQ for AI-search" Google Docs this
// project started from, and the rules below are ported from the one-off
// script that built the seed file (faq-seed-builder.mjs) so that importing
// the same document twice — once through the script, once through this —
// produces the same questions and answers.
//
// What this does NOT do is decide a question's topic, its concerns or its
// brands. In the seed those came from a hand-written table: a person read all
// thirty-three and filed them. A parser that guessed would be inventing the
// one part of the record that is a judgement, so those arrive empty and the
// import preview asks.

export type ParsedItem = {
  /** Stable identity for re-imports. Taken from the document's own numbering. */
  source_ref: string;
  question_th: string;
  answer_th: string;
  question_en: string | null;
  answer_en: string | null;
  keywords: string[];
  /** Only ever set by the CSV and JSON shapes, where a person wrote them. */
  topic: string | null;
  concerns: string[];
  brands: string[];
  product_slugs: string[];
  cta_label: string | null;
  cta_href: string | null;
  public_slug: string | null;
  visibility: "public" | "ai_only";
  pinned: boolean;
  /** The section heading the document filed it under, for the preview only. */
  section: string | null;
};

export type ImportFormat = "option1" | "option2" | "csv" | "json";

export type ParseResult = {
  format: ImportFormat;
  items: ParsedItem[];
  /** Lines the parser could not place, so a person can see what it skipped. */
  skipped: string[];
};

/** Non-breaking spaces and runs of whitespace, as Google Docs exports them. */
export function clean(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

export function slugifyEn(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function emptyItem(source_ref: string): ParsedItem {
  return {
    source_ref,
    question_th: "",
    answer_th: "",
    question_en: null,
    answer_en: null,
    keywords: [],
    topic: null,
    concerns: [],
    brands: [],
    product_slugs: [],
    cta_label: null,
    cta_href: null,
    public_slug: null,
    visibility: "public",
    pinned: false,
    section: null,
  };
}

/** A question and its answer on one line, split at the first question mark. */
function splitQA(line: string): { q: string; a: string } {
  const i = line.indexOf("?");
  if (i < 0) return { q: clean(line), a: "" };
  return { q: clean(line.slice(0, i + 1)), a: clean(line.slice(i + 1)) };
}

// ---------------------------------------------------------------- Option 1

type Opt1Row = { keywords: string[]; en: { q: string; a: string }; th: { q: string; a: string } };
type Opt1Topic = { no: number; title: string; collections: string; rows: Opt1Row[] };

/**
 * Numbered topic blocks, each a table of three columns read top to bottom:
 * trigger keywords, the English question and answer, the Thai question and
 * answer. A .txt export of a table gives one cell per line, so three
 * consecutive lines are one row.
 */
export function parseOption1(text: string): { topics: Opt1Topic[]; skipped: string[] } {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\t/, ""))
    .map(clean)
    .filter(Boolean);

  const topics: Opt1Topic[] = [];
  const skipped: string[] = [];
  let topic: Opt1Topic | null = null;
  let buf: string[] = [];

  for (const line of lines) {
    const head = line.match(/^(\d+)\.\s+(.+)$/);
    // A heading is numbered and is not itself a question — "7. Ordering"
    // rather than "7. Do you ship on Sunday?".
    if (head && !line.includes("?")) {
      topic = { no: Number(head[1]), title: head[2], collections: "", rows: [] };
      topics.push(topic);
      buf = [];
      continue;
    }
    if (!topic) {
      skipped.push(line);
      continue;
    }
    if (/^Collections?:/i.test(line)) {
      topic.collections = clean(line.replace(/^Collections?:/i, ""));
      continue;
    }
    if (/^(Trigger keywords|EN Q&A|TH Q&A)$/i.test(line)) continue;

    buf.push(line);
    if (buf.length === 3) {
      const [kw, en, th] = buf;
      topic.rows.push({
        keywords: kw.split(",").map(clean).filter(Boolean),
        en: splitQA(en),
        th: splitQA(th),
      });
      buf = [];
    }
  }
  // A trailing partial row means the document's table does not divide by
  // three — worth showing rather than dropping.
  if (buf.length) skipped.push(...buf);
  return { topics, skipped };
}

function option1Items(text: string): ParseResult {
  const { topics, skipped } = parseOption1(text);
  const items: ParsedItem[] = [];
  for (const t of topics) {
    t.rows.forEach((row, i) => {
      const item = emptyItem(`opt1:${t.no}.${i + 1}`);
      item.question_th = row.th.q;
      item.answer_th = row.th.a;
      item.question_en = row.en.q || null;
      item.answer_en = row.en.a || null;
      item.keywords = row.keywords;
      item.public_slug = row.en.q ? slugifyEn(row.en.q) : null;
      item.section = t.title;
      items.push(item);
    });
  }
  return { format: "option1", items, skipped };
}

// ---------------------------------------------------------------- Option 2

type Opt2Entry = { no: number; section: string; q: string; a: string };

/**
 * Two runs of the same numbered list, English then Thai, separated by a line
 * saying THAI VERSION. Sections are headed "07 | ORAL CARE"; questions are
 * "07. …" and everything after a question belongs to its answer until the
 * next number.
 */
export function parseOption2(text: string): { en: Map<number, Opt2Entry>; th: Map<number, Opt2Entry> } {
  const [enPart, thPart] = text.split(/THAI VERSION/);

  const parse = (part: string) => {
    const out = new Map<number, Opt2Entry>();
    let section = "";
    let cur: Opt2Entry | null = null;
    for (const line of part.split("\n").map(clean).filter(Boolean)) {
      const sec = line.match(/^(\d{2})\s*\|\s*(.+)$/);
      if (sec) {
        section = sec[2];
        cur = null;
        continue;
      }
      const q = line.match(/^(\d{2})\.\s+(.+)$/);
      if (q) {
        cur = { no: Number(q[1]), section, q: q[2], a: "" };
        out.set(cur.no, cur);
        continue;
      }
      if (cur) cur.a = clean(`${cur.a} ${line}`);
    }
    return out;
  };

  return { en: parse(enPart ?? ""), th: parse(thPart ?? "") };
}

function option2Items(text: string): ParseResult {
  const { en, th } = parseOption2(text);
  const items: ParsedItem[] = [];
  const skipped: string[] = [];

  // Numbered from the English run: it is the one that carries the sections,
  // and the Thai run is matched to it by number.
  for (const [no, e] of [...en.entries()].sort((a, b) => a[0] - b[0])) {
    const t = th.get(no);
    const item = emptyItem(`opt2:${String(no).padStart(2, "0")}`);
    item.question_en = e.q;
    item.answer_en = e.a || null;
    item.question_th = t?.q ?? "";
    item.answer_th = t?.a ?? "";
    item.public_slug = slugifyEn(e.q);
    item.section = e.section || null;
    if (!t) skipped.push(`ข้อ ${no} ไม่มีฉบับภาษาไทย`);
    items.push(item);
  }
  for (const no of th.keys()) {
    if (!en.has(no)) skipped.push(`ข้อ ${no} มีแต่ฉบับภาษาไทย`);
  }
  return { format: "option2", items, skipped };
}

// -------------------------------------------------------------------- CSV

/**
 * A CSV reader rather than a split on commas: the answers are prose and
 * contain commas, quotes and newlines, all of which are legal inside a quoted
 * field and all of which a naive split would tear apart mid-sentence.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // Strip a UTF-8 BOM, which Excel writes and which would otherwise become
  // part of the first column's name.
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export const CSV_COLUMNS = [
  "source_ref",
  "topic",
  "concerns",
  "brands",
  "question_th",
  "answer_th",
  "question_en",
  "answer_en",
  "keywords",
  "product_slugs",
  "cta_label",
  "cta_href",
  "visibility",
  "pinned",
] as const;

/** Several values in one cell, separated by a pipe — commas are prose here. */
const many = (v: string | undefined) =>
  (v ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);

function csvItems(text: string): ParseResult {
  const rows = parseCsvRows(text);
  const skipped: string[] = [];
  if (rows.length === 0) return { format: "csv", items: [], skipped };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const at = (row: string[], name: string) => {
    const i = header.indexOf(name);
    return i < 0 ? undefined : row[i];
  };

  const items: ParsedItem[] = [];
  rows.slice(1).forEach((row, n) => {
    const qth = (at(row, "question_th") ?? "").trim();
    const ath = (at(row, "answer_th") ?? "").trim();
    if (!qth && !ath) {
      skipped.push(`แถว ${n + 2}: ไม่มีคำถามและคำตอบภาษาไทย`);
      return;
    }
    const ref = (at(row, "source_ref") ?? "").trim() || `csv:${n + 2}`;
    const item = emptyItem(ref);
    item.question_th = qth;
    item.answer_th = ath;
    item.question_en = (at(row, "question_en") ?? "").trim() || null;
    item.answer_en = (at(row, "answer_en") ?? "").trim() || null;
    item.keywords = many(at(row, "keywords"));
    item.topic = (at(row, "topic") ?? "").trim() || null;
    item.concerns = many(at(row, "concerns"));
    item.brands = many(at(row, "brands"));
    item.product_slugs = many(at(row, "product_slugs"));
    item.cta_label = (at(row, "cta_label") ?? "").trim() || null;
    item.cta_href = (at(row, "cta_href") ?? "").trim() || null;
    item.visibility = (at(row, "visibility") ?? "").trim() === "ai_only" ? "ai_only" : "public";
    item.pinned = /^(1|true|yes|ใช่)$/i.test((at(row, "pinned") ?? "").trim());
    item.public_slug = item.question_en ? slugifyEn(item.question_en) : null;
    items.push(item);
  });
  return { format: "csv", items, skipped };
}

// ------------------------------------------------------------------- JSON

function jsonItems(text: string): ParseResult {
  const parsed: unknown = JSON.parse(text);
  const raw = Array.isArray(parsed)
    ? parsed
    : ((parsed as { items?: unknown[] })?.items ?? []);
  const items: ParsedItem[] = [];
  const skipped: string[] = [];

  raw.forEach((r, n) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
    const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string") : []);
    if (!str("question_th") && !str("answer_th")) {
      skipped.push(`ข้อ ${n + 1}: ไม่มีคำถามและคำตอบภาษาไทย`);
      return;
    }
    const item = emptyItem(str("source_ref") || `json:${n + 1}`);
    item.question_th = str("question_th");
    item.answer_th = str("answer_th");
    item.question_en = str("question_en") || null;
    item.answer_en = str("answer_en") || null;
    item.keywords = arr("keywords");
    item.topic = str("topic") || null;
    item.concerns = arr("concerns");
    // The seed file calls it `brands`; the database column is brand_slugs.
    item.brands = arr("brands").length ? arr("brands") : arr("brand_slugs");
    item.product_slugs = arr("product_slugs").length ? arr("product_slugs") : arr("product_tags");
    item.cta_label = str("cta_label") || null;
    item.cta_href = str("cta_href") || null;
    item.visibility = str("visibility") === "ai_only" ? "ai_only" : "public";
    item.pinned = o.pinned === true;
    item.public_slug = str("public_slug") || (item.question_en ? slugifyEn(item.question_en) : null);
    items.push(item);
  });
  return { format: "json", items, skipped };
}

// --------------------------------------------------------------- detection

/**
 * Which of the four it is.
 *
 * Checked in order of how certain the signal is: JSON either parses or does
 * not, Option 2 names itself with THAI VERSION, Option 1 has the table header
 * its tables always carry, and a comma-separated first line with a known
 * column name is a CSV. Anything else is treated as a pasted Option 1 or
 * Option 2 document, whichever its numbering looks like.
 */
export function detectFormat(text: string): ImportFormat {
  const head = text.slice(0, 4000);
  const trimmed = text.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not JSON after all — fall through to the text shapes.
    }
  }
  if (/THAI VERSION/.test(head)) return "option2";
  if (/Trigger keywords/i.test(head)) return "option1";

  const firstLine = (text.split("\n")[0] ?? "").toLowerCase();
  if (firstLine.includes(",") && (firstLine.includes("question_th") || firstLine.includes("source_ref"))) {
    return "csv";
  }
  // Numbered "07 | SECTION" headings are Option 2's; plain "7. Topic" is
  // Option 1's.
  if (/^\d{2}\s*\|/m.test(head)) return "option2";
  return "option1";
}

export function parseImport(text: string, format?: ImportFormat): ParseResult {
  const f = format ?? detectFormat(text);
  switch (f) {
    case "json":
      return jsonItems(text);
    case "csv":
      return csvItems(text);
    case "option2":
      return option2Items(text);
    default:
      return option1Items(text);
  }
}
