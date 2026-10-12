// Turning what an admin types into an instant, and back.
//
// Everything is stored as UTC and typed as Bangkok time. That is not a
// preference — it is the only way a campaign that "starts at midnight" starts
// at midnight for the people it is for. The seven-hour gap is also where this
// kind of thing goes wrong, quietly and by exactly seven hours, so the
// conversion lives here on its own and is tested.
//
// Deliberately not the browser's own timezone. `<input type="datetime-local">`
// means "local time", and an admin answering email from Tokyo would otherwise
// schedule a Thai campaign two hours early without either of us noticing.

const BANGKOK_OFFSET = "+07:00";

/** "2026-11-11T09:00" as typed → the instant it names in Bangkok. */
export function bangkokInputToIso(value: string): string | null {
  if (!value) return null;
  // datetime-local gives "YYYY-MM-DDTHH:mm", sometimes with seconds.
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const parsed = Date.parse(`${match[1]}T${match[2]}${match[3] ?? ":00"}${BANGKOK_OFFSET}`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/** An instant → "YYYY-MM-DDTHH:mm" in Bangkok, for putting back in the box. */
export function isoToBangkokInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  // Shift by the offset and read the UTC fields: the alternative is
  // toLocaleString with a timezone, which returns a formatted string in
  // whatever shape the runtime likes rather than the shape the input needs.
  const shifted = new Date(at + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

/** An instant, written out for a person to read. */
export function bangkokLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "—";
  return new Date(at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}
