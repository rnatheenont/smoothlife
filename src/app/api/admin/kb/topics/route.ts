import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// The tabs and chips on /faq.
//
// Changing one of these changes what every visitor sees without any answer
// changing, which is why writing here needs kb.publish while reading is part
// of drafting — see the note in admin-route-permissions.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

const COLUMNS = "slug,kind,label_th,label_en,icon,link_href,sort,enabled";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TopicInput = {
  slug: string;
  kind: "section" | "concern";
  label_th: string;
  label_en: string | null;
  icon: string | null;
  link_href: string | null;
  sort: number;
  enabled: boolean;
};

/**
 * Validated here rather than trusted from the form.
 *
 * `link_href` is the one that matters: it becomes a link on a public page, so
 * it has to be a path on this site. A full URL would let the admin panel
 * point the FAQ's own chips at somewhere else entirely.
 */
export function parseTopicInput(body: unknown): { topic: TopicInput } | { error: string } {
  const o = (body ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");

  const slug = str("slug").toLowerCase();
  if (!SLUG.test(slug)) return { error: "slug ต้องเป็นตัวอักษรอังกฤษเล็ก ตัวเลข และขีดกลางเท่านั้น" };

  const kind = str("kind");
  if (kind !== "section" && kind !== "concern") return { error: "kind ต้องเป็น section หรือ concern" };

  const label_th = str("label_th");
  if (!label_th) return { error: "ต้องมีชื่อภาษาไทย" };

  const href = str("link_href");
  if (href && !/^\/(?!\/)/.test(href)) return { error: "ลิงก์ต้องเป็นเส้นทางภายในเว็บ เช่น /collections/…" };

  const sort = Number(o.sort);

  return {
    topic: {
      slug,
      kind,
      label_th,
      label_en: str("label_en") || null,
      icon: str("icon") || null,
      link_href: href || null,
      sort: Number.isFinite(sort) ? Math.trunc(sort) : 0,
      enabled: o.enabled !== false,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const topics = await supabaseRest<TopicInput[]>(`faq_topics?select=${COLUMNS}&order=kind.asc,sort.asc,slug.asc`);

  // How many published answers each one would show, so an empty topic is
  // visible as empty in the admin instead of only on the public page.
  const counts = await supabaseRest<{ topic: string | null; concerns: string[] | null }[]>(
    "kb_articles?status=eq.published&visibility=eq.public&select=topic,concerns&limit=1000"
  ).catch((): { topic: string | null; concerns: string[] | null }[] => []);

  const used = new Map<string, number>();
  for (const a of counts) {
    if (a.topic) used.set(a.topic, (used.get(a.topic) ?? 0) + 1);
    for (const c of a.concerns ?? []) used.set(c, (used.get(c) ?? 0) + 1);
  }

  return NextResponse.json({
    ok: true,
    topics: topics.map((t) => ({ ...t, published: used.get(t.slug) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const parsed = parseTopicInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const [exists] = await supabaseRest<{ slug: string }[]>(
    `faq_topics?slug=eq.${pgValue(parsed.topic.slug)}&select=slug&limit=1`
  );
  if (exists) return NextResponse.json({ ok: false, error: "มีหัวข้อ slug นี้อยู่แล้ว" }, { status: 409 });

  const [topic] = await supabaseRest<TopicInput[]>("faq_topics", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([parsed.topic]),
  });

  revalidateTag("kb-public", { expire: 0 });
  return NextResponse.json({ ok: true, topic });
}

/** Reordering: the whole list at once, because a drag moves several rows. */
export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { order?: unknown } | null;
  const order = Array.isArray(body?.order) ? (body.order as unknown[]) : [];
  if (order.length === 0) return NextResponse.json({ ok: false, error: "ไม่มีลำดับที่ส่งมา" }, { status: 400 });

  const slugs = order.filter((s): s is string => typeof s === "string" && SLUG.test(s));
  if (slugs.length !== order.length) return NextResponse.json({ ok: false, error: "มี slug ที่ไม่ถูกต้อง" }, { status: 400 });

  for (const [i, slug] of slugs.entries()) {
    await supabaseRest(`faq_topics?slug=eq.${pgValue(slug)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ sort: (i + 1) * 10 }),
    });
  }

  revalidateTag("kb-public", { expire: 0 });
  return NextResponse.json({ ok: true, reordered: slugs.length });
}
