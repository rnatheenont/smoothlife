// Fetching a document the admin pasted a link to.
//
// This is a server making a request to an address a user chose, which is the
// shape of every SSRF: left open it would fetch the cloud metadata endpoint,
// or anything on the private network the function sits in, and hand the body
// back to whoever asked. So the allow-list is of hosts, it is checked after
// the URL is parsed rather than by looking at the string, and nothing else
// gets through.

export type SourceFetch = { text: string; fileName: string; sourceUrl: string };

const ALLOWED_HOSTS = ["docs.google.com"];

/** 5 MB of text is far past any FAQ document and well short of a problem. */
const MAX_BYTES = 5 * 1024 * 1024;

export class SourceError extends Error {}

/**
 * A Google Docs or Sheets share link, rewritten to its plain-text export.
 *
 * Both kinds carry the document id in the same place, so the id is what this
 * reads — not the rest of the URL, which is where a redirect or a userinfo
 * trick would hide.
 */
export function exportUrlFor(raw: string): { url: string; kind: "doc" | "sheet" } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new SourceError("ลิงก์ไม่ถูกต้อง");
  }

  if (parsed.protocol !== "https:") throw new SourceError("รับเฉพาะลิงก์ https");
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    throw new SourceError(`รับเฉพาะลิงก์จาก ${ALLOWED_HOSTS.join(", ")} เท่านั้น`);
  }

  const doc = parsed.pathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (doc) return { url: `https://docs.google.com/document/d/${doc[1]}/export?format=txt`, kind: "doc" };

  const sheet = parsed.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheet) {
    const gid = parsed.hash.match(/gid=(\d+)/)?.[1] ?? parsed.searchParams.get("gid");
    const suffix = gid ? `&gid=${gid}` : "";
    return { url: `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv${suffix}`, kind: "sheet" };
  }

  throw new SourceError("ลิงก์นี้ไม่ใช่ Google Docs หรือ Google Sheets");
}

export async function fetchSource(raw: string): Promise<SourceFetch> {
  const { url, kind } = exportUrlFor(raw);

  // No redirects followed. Google answers the export URL directly; a redirect
  // would be the allow-list being walked around, so it is an error rather
  // than something to chase.
  const res = await fetch(url, { redirect: "manual", headers: { accept: "text/plain,text/csv,*/*" } });

  if (res.status >= 300 && res.status < 400) {
    throw new SourceError(
      "เอกสารนี้ยังไม่ได้แชร์ — เปิดเป็น “ทุกคนที่มีลิงก์ดูได้” แล้วลองใหม่ (Google ส่งกลับไปหน้าเข้าสู่ระบบ)"
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new SourceError("เอกสารนี้ยังไม่ได้แชร์ — เปิดเป็น “ทุกคนที่มีลิงก์ดูได้” แล้วลองใหม่");
  }
  if (!res.ok) throw new SourceError(`ดึงเอกสารไม่สำเร็จ (${res.status})`);

  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new SourceError("เอกสารใหญ่เกินไป");

  const text = await res.text();
  if (text.length > MAX_BYTES) throw new SourceError("เอกสารใหญ่เกินไป");

  // The sign-in page comes back as HTML with a 200 often enough to be worth
  // naming, instead of letting the parser find nothing and blame the document.
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
    throw new SourceError("ได้หน้าเว็บกลับมาแทนตัวเอกสาร — เอกสารน่าจะยังไม่ได้แชร์แบบดูได้ด้วยลิงก์");
  }

  return { text, fileName: kind === "sheet" ? "Google Sheets" : "Google Docs", sourceUrl: url };
}
