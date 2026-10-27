// Writing a CSV that Excel opens correctly.
//
// Two rules decide whether a file lands well, and both are easy to forget
// because nothing fails loudly when you do: a leading BOM, or every Thai
// character on a Windows machine turns to mojibake, and an escape for cells
// that begin like a formula, or a name starting with "=" is executed by the
// spreadsheet that opens it.
//
// The rules lived in two export routes already and were about to live in a
// third. One copy, because a rule copied three times is a rule that drifts.

/** One cell, quoted and escaped as the format requires. */
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  // Excel reads a leading =, +, - or @ as a formula. A customer's name is
  // not a formula, and these files are exactly the kind that get forwarded
  // around and opened by whoever receives them.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A whole file: a header row, the body, and the BOM Excel needs. */
export function csvDocument(header: readonly unknown[], rows: readonly (readonly unknown[])[]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // CRLF, which is what the format actually specifies and what keeps older
  // Excel from running the whole file onto one line.
  return `﻿${lines.join("\r\n")}`;
}

/** A filename-safe slug of a Thai or English title. */
export function csvSlug(name: string, max = 40): string {
  // \p{M} as well as \p{L}, and that is the whole reason this is a function
  // rather than a line copied into each route. Thai vowels and tone marks
  // are combining marks, not letters, so the obvious letters-and-numbers
  // pattern deletes them: "ปีใหม่" came out "ป-ใหม" and "กิจกรรม" came out
  // "ก-จกรรม". Every Thai campaign name downloaded so far has a shredded
  // filename for exactly this reason.
  return name
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}
