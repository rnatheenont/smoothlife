// `.ts` on these two imports, not a bare "./parse": this module has a unit
// test and `node --test` resolves specifiers literally, so the extensionless
// form that the bundler accepts fails there. Same reason as email.ts.
import type { ParsedItem } from "./parse.ts";
import { checkItem, blocking, type CheckContext, type CheckIssue } from "./check.ts";

// What each parsed row would do if it were committed.
//
// The preview is the point of the import: a person looks at thirty rows and
// decides, and they can only decide if each row says plainly whether it is
// new, an edit to something that exists, a near-copy of something else, or
// broken. Guessing on their behalf and reporting a total at the end is how
// an import quietly creates a second copy of a question the shop already
// answers.

export type RowStatus = "new" | "update" | "duplicate" | "conflict" | "invalid";

export type ExistingArticle = {
  id: string;
  source_ref: string | null;
  title: string;
  public_slug: string | null;
  status: string;
  updated_at: string;
};

export type PreviewRow = {
  item: ParsedItem;
  status: RowStatus;
  /** The article this row would change, when there is one. */
  matchId?: string;
  matchTitle?: string;
  /** Fields whose value differs from the article it matched. */
  changed: string[];
  issues: CheckIssue[];
  /** Whether it is selected for import when the preview first opens. */
  selected: boolean;
  note?: string;
};

/** Thai has no word boundaries, so similarity is measured over characters. */
function bigrams(s: string): Set<string> {
  const t = s.toLowerCase().replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Dice coefficient over character bigrams: 1 is the same string. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

const NEAR_DUPLICATE = 0.8;

const COMPARED = [
  "question_th",
  "answer_th",
  "question_en",
  "answer_en",
  "keywords",
  "topic",
  "concerns",
  "brands",
  "product_slugs",
  "cta_label",
  "cta_href",
] as const;

/** The article as the import would compare it — same shape both sides. */
export type ComparableArticle = Partial<Record<(typeof COMPARED)[number], unknown>>;

function differs(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) !== JSON.stringify(b ?? []);
  }
  return (a ?? "") !== (b ?? "");
}

export function buildPreview(
  items: ParsedItem[],
  existing: ExistingArticle[],
  opts: {
    /** Current field values, by article id, for the diff on an update. */
    current?: Map<string, ComparableArticle>;
    /** When this source was last imported — anything edited since conflicts. */
    lastImportAt?: string | null;
    check?: CheckContext;
  } = {}
): PreviewRow[] {
  const byRef = new Map(existing.filter((e) => e.source_ref).map((e) => [e.source_ref as string, e]));
  const slugOwner = new Map(existing.filter((e) => e.public_slug).map((e) => [e.public_slug as string, e.id]));

  return items.map((item) => {
    const match = byRef.get(item.source_ref);

    const issues = checkItem(item, {
      ...opts.check,
      // A row may legitimately keep its own slug; only another article's slug
      // is a clash.
      slugTaken: (slug) => {
        const owner = slugOwner.get(slug);
        return Boolean(owner && owner !== match?.id);
      },
    });

    if (blocking(issues).length > 0) {
      return { item, status: "invalid", changed: [], issues, selected: false };
    }

    if (match) {
      const before = opts.current?.get(match.id) ?? {};
      const changed = COMPARED.filter((f) => {
        const next = (item as unknown as Record<string, unknown>)[f];
        return differs(before[f], next);
      });

      // Edited in the admin after the last import: taking the document's
      // word for it would throw that edit away without saying so.
      const editedSince =
        opts.lastImportAt && match.updated_at && new Date(match.updated_at) > new Date(opts.lastImportAt);

      if (editedSince && changed.length > 0) {
        return {
          item,
          status: "conflict",
          matchId: match.id,
          matchTitle: match.title,
          changed,
          issues,
          selected: false,
          note: "มีคนแก้ข้อนี้ในระบบหลังนำเข้าครั้งก่อน — เลือกเองว่าจะทับหรือข้าม",
        };
      }

      return {
        item,
        status: "update",
        matchId: match.id,
        matchTitle: match.title,
        changed,
        issues,
        // Nothing changed is nothing to write; leaving it selected would make
        // every re-import look like thirty edits.
        selected: changed.length > 0,
        note: changed.length === 0 ? "เหมือนเดิมทุกฟิลด์" : undefined,
      };
    }

    // No source_ref match, so look for the same question under another name —
    // the case where somebody pastes a document twice from two places.
    let best: { row: ExistingArticle; score: number } | null = null;
    for (const e of existing) {
      const score = similarity(item.question_th, e.title);
      if (!best || score > best.score) best = { row: e, score };
    }
    if (best && best.score >= NEAR_DUPLICATE) {
      return {
        item,
        status: "duplicate",
        matchId: best.row.id,
        matchTitle: best.row.title,
        changed: [],
        issues,
        selected: false,
        note: `คล้ายข้อที่มีอยู่ ${Math.round(best.score * 100)}% — ตรวจก่อนว่าจะรวมกันหรือเป็นคนละข้อ`,
      };
    }

    return { item, status: "new", changed: [], issues, selected: true };
  });
}

export function previewCounts(rows: PreviewRow[]) {
  const by = (s: RowStatus) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    new: by("new"),
    update: by("update"),
    duplicate: by("duplicate"),
    conflict: by("conflict"),
    invalid: by("invalid"),
    warned: rows.filter((r) => r.issues.some((i) => i.level === "warn")).length,
  };
}
