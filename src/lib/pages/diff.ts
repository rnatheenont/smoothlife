import type { PageDoc, SectionInstance } from "./doc";

// What changed between two versions of a page.
//
// Section-level, keyed by id, because that is the unit a person thinks in:
// "the banner moved and the coupon text changed" is the answer, not a list of
// character offsets. The ids are stable across edits by design (see doc.ts),
// which is the whole reason this can be written at all.
//
// Pure and importing only a type, so it runs under `node --test`. The one
// thing it deliberately does not do is name the fields in human language —
// that needs the section registry, which is a server module, so the caller
// turns keys into labels. Keeping that out of here is what keeps it testable.

export type SectionChange = {
  id: string;
  type: string;
  /** Top-level settings keys whose value differs. */
  keys: string[];
  /** Visibility/scheduling changes, which live beside the settings. */
  common: string[];
};

export type DocDiff = {
  added: { id: string; type: string }[];
  removed: { id: string; type: string }[];
  /** Still present, but in a different place relative to the other survivors. */
  moved: { id: string; type: string; from: number; to: number }[];
  changed: SectionChange[];
  /** True when the two documents are the same page in every respect. */
  same: boolean;
};

/** Stable stringify: key order must not decide whether two settings differ. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

function settingsKeys(before: unknown, after: unknown): string[] {
  const a = (before ?? {}) as Record<string, unknown>;
  const b = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => stable(a[k]) !== stable(b[k])).sort();
}

const COMMON_KEYS = ["hidden", "visibleFrom", "visibleUntil", "phases"] as const;

function commonKeys(before: SectionInstance, after: SectionInstance): string[] {
  const a = (before.common ?? {}) as Record<string, unknown>;
  const b = (after.common ?? {}) as Record<string, unknown>;
  return COMMON_KEYS.filter((k) => stable(a[k]) !== stable(b[k]));
}

export function diffDocs(before: PageDoc, after: PageDoc): DocDiff {
  const beforeById = new Map(before.sections.map((s) => [s.id, s]));
  const afterById = new Map(after.sections.map((s) => [s.id, s]));

  const added = after.sections
    .filter((s) => !beforeById.has(s.id))
    .map((s) => ({ id: s.id, type: s.type }));
  const removed = before.sections
    .filter((s) => !afterById.has(s.id))
    .map((s) => ({ id: s.id, type: s.type }));

  // Order is compared among the sections present in both. Without this, one
  // section added at the top would report every other section as moved —
  // true in a trivial sense and useless to read.
  const survivorsBefore = before.sections.filter((s) => afterById.has(s.id)).map((s) => s.id);
  const survivorsAfter = after.sections.filter((s) => beforeById.has(s.id)).map((s) => s.id);
  const moved = survivorsBefore
    .map((id, i) => ({ id, from: i, to: survivorsAfter.indexOf(id) }))
    .filter((m) => m.from !== m.to)
    .map((m) => ({ ...m, type: afterById.get(m.id)?.type ?? "" }));

  const changed: SectionChange[] = [];
  for (const section of after.sections) {
    const was = beforeById.get(section.id);
    if (!was) continue;
    const keys = settingsKeys(was.settings, section.settings);
    const common = commonKeys(was, section);
    if (keys.length || common.length) {
      changed.push({ id: section.id, type: section.type, keys, common });
    }
  }

  return {
    added,
    removed,
    moved,
    changed,
    same: added.length === 0 && removed.length === 0 && moved.length === 0 && changed.length === 0,
  };
}
