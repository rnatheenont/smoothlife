// The LINE OA's Rich Menu — the permanent button grid at the bottom of the
// chat (plan §6). Every button opens the LIFF app, which since the LIFF fix
// lands the customer in the normal site already signed in, so these are just
// deep links into pages that already exist rather than anything LINE-specific.
//
// This lives behind its own switch because a Rich Menu belongs to a
// **Messaging API** channel — a LINE Official Account — and this project
// currently only has LINE *Login* channels. The code is ready; it needs an OA
// to point at. See the admin page for what's still missing.

const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";

const TOKEN = process.env.LINE_MESSAGING_ACCESS_TOKEN;
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

export function richMenuConfigured() {
  return Boolean(TOKEN && LIFF_ID);
}

/** A LIFF deep link that opens `path` on the site, already signed in. */
function liffLink(path: string) {
  return `https://liff.line.me/${LIFF_ID}?to=${encodeURIComponent(path)}`;
}

// LINE's full-size rich menu is exactly 2500x1686. A 3x2 grid of equal cells
// is 833.33 wide, so the middle column is given the extra pixels rather than
// leaving a 1px dead strip between buttons.
const W = 2500;
const H = 1686;
const COL = [
  { x: 0, width: 833 },
  { x: 833, width: 834 },
  { x: 1667, width: 833 },
];
const ROW = [
  { y: 0, height: 843 },
  { y: 843, height: 843 },
];

export const RICH_MENU_BUTTONS = [
  { label: "ร้านค้า", path: "/shop" },
  { label: "แต้ม/บัญชีของฉัน", path: "/account" },
  { label: "สมัครสมาชิก", path: "/subscription" },
  { label: "คุยกับน้อง Smoothie", path: "/ai-assistant" },
  { label: "ติดตามออเดอร์", path: "/account/orders" },
  { label: "ติดต่อแอดมิน", path: "/help/contact" },
] as const;

function richMenuBody() {
  return {
    size: { width: W, height: H },
    selected: true,
    name: "Smoothlife main menu",
    chatBarText: "เมนู",
    areas: RICH_MENU_BUTTONS.map((b, i) => ({
      bounds: { ...COL[i % 3], ...ROW[Math.floor(i / 3)] },
      action: { type: "uri" as const, label: b.label.slice(0, 20), uri: liffLink(b.path) },
    })),
  };
}

async function lineFetch(url: string, init: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers as Record<string, string>) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`LINE ${init.method ?? "GET"} ${url} → ${res.status} ${body.slice(0, 300)}`);
  return body;
}

export async function listRichMenus(): Promise<{ richMenuId: string; name: string }[]> {
  const body = await lineFetch(`${API}/richmenu/list`, { method: "GET" });
  return (JSON.parse(body).richmenus ?? []).map((m: { richMenuId: string; name: string }) => ({
    richMenuId: m.richMenuId,
    name: m.name,
  }));
}

export async function getDefaultRichMenuId(): Promise<string | null> {
  try {
    const body = await lineFetch(`${API}/user/all/richmenu`, { method: "GET" });
    return JSON.parse(body).richMenuId ?? null;
  } catch {
    // 404 here just means "no default set yet", which is a normal state and
    // not worth surfacing as an error.
    return null;
  }
}

/**
 * Creates the menu, attaches the image, and makes it the default for everyone.
 *
 * Order matters and is not interchangeable: LINE refuses to set a rich menu as
 * default until an image has been uploaded for it, so a failure midway leaves
 * an image-less menu that is invisible to customers rather than a broken one
 * shown to them.
 */
export async function installRichMenu(image: { bytes: ArrayBuffer; contentType: "image/png" | "image/jpeg" }) {
  const created = await lineFetch(`${API}/richmenu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(richMenuBody()),
  });
  const richMenuId = JSON.parse(created).richMenuId as string;

  await lineFetch(`${DATA_API}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { "Content-Type": image.contentType },
    body: image.bytes,
  });

  await lineFetch(`${API}/user/all/richmenu/${richMenuId}`, { method: "POST" });
  return { richMenuId };
}

/** Removes a menu. Used to clear out superseded ones so the list stays honest. */
export async function deleteRichMenu(richMenuId: string) {
  await lineFetch(`${API}/richmenu/${richMenuId}`, { method: "DELETE" });
}
