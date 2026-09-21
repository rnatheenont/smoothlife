import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { logAiUsage } from "@/lib/ai-usage";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  type SeoPageType,
  type SeoSuggestion,
} from "@/lib/seo-overrides";

// Three title/description pairs for a page, for a person to pick from and
// edit. It suggests; it never saves. Same discipline as the knowledge base:
// what reaches the public passes a human first.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// These products are cosmetics and supplements, advertised under Thai law.
// "รักษาสิวหาย 100%" is not a bad headline, it is an illegal one — so the
// rule is in the system prompt rather than left to the reviewer to catch.
const SYSTEM = `คุณเป็นผู้เชี่ยวชาญ SEO ภาษาไทย ให้กับเว็บอีคอมเมิร์ซสุขภาพและความงาม Smoothlife.com

หน้าที่: เสนอ meta title และ meta description ให้ทีมงานเลือกและแก้ต่อ — ไม่ใช่ข้อความสุดท้ายที่เผยแพร่เอง

กติกาที่ห้ามละเมิดเด็ดขาด:
- ห้ามกล่าวอ้างสรรพคุณทางการแพทย์หรือการรักษาโรค เช่น "รักษาสิวหาย" "ยับยั้งเชื้อ" "หายขาด" "ปลอดภัย 100%"
- ห้ามรับประกันผลลัพธ์หรือระบุระยะเวลาที่เห็นผล ถ้าไม่มีในข้อมูลที่ให้มา
- ห้ามเปรียบเทียบว่าดีกว่าสินค้าอื่นหรือใช้คำว่า "ที่สุด" "อันดับ 1" ถ้าไม่มีข้อมูลยืนยัน
- ห้ามแต่งส่วนผสม ขนาด ราคา หรือคุณสมบัติที่ไม่มีในข้อมูลที่ให้มา
- เครื่องสำอางพูดได้แค่ระดับ "ช่วยดูแล" "ทำให้ดูกระจ่างใสขึ้น" ไม่ใช่ "รักษา"

แนวทางการเขียน:
- ภาษาไทย ใช้คำที่คนไทยพิมพ์ค้นหาจริง เช่น "เสียวฟัน" ไม่ใช่ "ภาวะภูมิไวเกินของเนื้อฟัน"
- title ไม่เกิน ${TITLE_MAX} ตัวอักษร รวมชื่อแบรนด์ถ้ามีที่พอ
- description ไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร บอกว่าเหมาะกับใครและได้อะไร ให้คนอยากคลิก ไม่ใช่บรรยายเฉย ๆ
- แต่ละแบบต้องต่างกันจริง ไม่ใช่สลับคำ

ตอบกลับเป็น JSON เท่านั้น ไม่มีข้อความอื่นประกอบ:
{"suggestions":[{"title":"...","description":"..."},{"title":"...","description":"..."},{"title":"...","description":"..."}]}`;

function parseSuggestions(text: string): SeoSuggestion[] {
  // The model is asked for bare JSON; a stray fence or preamble should not
  // cost the whole call.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    return list
      .filter((s: unknown): s is SeoSuggestion => {
        const o = s as Record<string, unknown>;
        return typeof o?.title === "string" && typeof o?.description === "string";
      })
      .slice(0, 3)
      .map((s: SeoSuggestion) => ({ title: s.title.trim(), description: s.description.trim() }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 503 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const pageType = body?.page_type as SeoPageType | undefined;
  const pageKey = typeof body?.page_key === "string" ? body.page_key.trim() : "";
  const context = typeof body?.context === "string" ? body.context.slice(0, 4000) : "";
  if (!pageType || !pageKey || !context) {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{ role: "user", content: context }],
      }),
    });
  } catch (err) {
    console.error("[admin/seo/suggest] request failed", err);
    return NextResponse.json({ ok: false, error: "เรียก AI ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }

  if (!res.ok) {
    console.error("[admin/seo/suggest] anthropic error", res.status, (await res.text()).slice(0, 300));
    return NextResponse.json({ ok: false, error: "AI ตอบกลับไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }

  const data = await res.json();
  const text = (data?.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");
  const suggestions = parseSuggestions(text);

  await logAiUsage({
    feature: "seo-suggest",
    model: MODEL,
    outcome: suggestions.length > 0 ? "ok" : "empty",
    usage: data?.usage,
    durationMs: Date.now() - started,
  }).catch(() => {});

  if (suggestions.length === 0) {
    return NextResponse.json({ ok: false, error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้ กรุณาลองใหม่" }, { status: 502 });
  }

  // Kept against the row so reopening this page does not pay for the same
  // three suggestions again. Stored, not applied — nothing is published until
  // a person picks one and saves.
  await supabaseRest("seo_overrides?on_conflict=page_type,page_key", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ page_type: pageType, page_key: pageKey, ai_suggestions: suggestions }),
  }).catch((err) => console.error("[admin/seo/suggest] could not cache suggestions", err));

  return NextResponse.json({ ok: true, suggestions });
}
