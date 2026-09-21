import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { logAiUsage } from "@/lib/ai-usage";

// A written summary of what the brand's own signals say, for a period.
//
// The rule that matters: the model reads brand_signals and nothing else. It
// is being asked to inform business decisions, so a theme it recalls from
// training rather than from a review someone actually wrote is worse than an
// empty report. It is also told how many signals it has — four reviews is a
// legitimate answer of "not enough to say", and the prompt asks for that
// answer rather than a confident paragraph built on nothing.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const SYSTEM = `คุณเป็นนักวิเคราะห์ข้อมูลลูกค้าให้ร้านสุขภาพและความงาม Smoothlife.com

หน้าที่: อ่าน "สัญญาณ" ที่เก็บมาได้จริงในช่วงเวลาหนึ่ง แล้วสรุปให้ทีมงานเอาไปตัดสินใจ

กติกาที่ห้ามละเมิด:
- ใช้เฉพาะข้อมูลที่ให้มาเท่านั้น ห้ามเติมข้อมูลจากความรู้ทั่วไปหรือเดาแทน
- ถ้าข้อมูลน้อยเกินกว่าจะสรุปได้ ให้บอกตรง ๆ ว่ายังสรุปไม่ได้และต้องการข้อมูลแบบไหนเพิ่ม — ห้ามแต่งประเด็นขึ้นมาให้ดูมีเนื้อหา
- ห้ามสรุปเป็นตัวเลขเปอร์เซ็นต์หรือสัดส่วน ถ้าไม่ได้นับจากข้อมูลที่ให้มาจริง
- ข้อเสนอแนะต้องเป็นสิ่งที่ลงมือทำได้จริงและอ้างถึงสิ่งที่พบในข้อมูล เช่น "พบรีวิวเรื่องกล่องบุบ 3 ครั้ง — เช็กวิธีแพ็กกับคลัง" ไม่ใช่ "ควรปรับปรุงคุณภาพ"

ตอบกลับเป็น JSON เท่านั้น:
{"summary":"...","positive_themes":["..."],"negative_themes":["..."],"recommendations":["..."]}`;

type SignalRow = {
  source: string;
  signal_type: string;
  sentiment: string | null;
  keyword: string | null;
  content: string | null;
  volume: number | null;
  occurred_at: string | null;
};

export type BrandInsight = {
  summary: string;
  positive_themes: string[];
  negative_themes: string[];
  recommendations: string[];
  signals_considered: number;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 12) : [];
}

/** Builds the evidence the model is allowed to use — reviews verbatim, trend
 *  lines as one line each. Nothing else exists yet; when a social-listening
 *  tool is wired in its rows land in the same table and arrive here too. */
function describe(signals: SignalRow[]) {
  const reviews = signals.filter((s) => s.signal_type === "review");
  const trends = signals.filter((s) => s.signal_type === "trend_point");

  const trendByKeyword = new Map<string, number[]>();
  for (const t of trends) {
    if (!t.keyword) continue;
    trendByKeyword.set(t.keyword, [...(trendByKeyword.get(t.keyword) ?? []), Number(t.volume ?? 0)]);
  }

  const lines: string[] = [];
  lines.push(`รีวิวสินค้าบนเว็บ (${reviews.length} รายการ):`);
  if (reviews.length === 0) lines.push("- ไม่มีรีวิวในช่วงนี้");
  for (const r of reviews.slice(0, 200)) {
    lines.push(`- [${r.sentiment ?? "?"}] ${r.keyword ?? ""}: ${(r.content ?? "(ไม่มีข้อความ)").slice(0, 300)}`);
  }

  lines.push("", `ความสนใจการค้นหา Google Trends ประเทศไทย (ค่าเฉลี่ย 0-100 ต่อคำ):`);
  if (trendByKeyword.size === 0) lines.push("- ไม่มีข้อมูลในช่วงนี้");
  for (const [keyword, values] of trendByKeyword) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    lines.push(`- ${keyword}: เฉลี่ย ${avg.toFixed(1)} จาก ${values.length} จุดข้อมูล`);
  }
  return lines.join("\n");
}

export async function buildBrandInsight(days = 30): Promise<{ ok: true; insight: BrandInsight } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" };

  const since = new Date(Date.now() - days * 86_400_000);
  const signals = await supabaseRest<SignalRow[]>(
    `brand_signals?occurred_at=gt.${pgValue(since.toISOString())}` +
      `&select=source,signal_type,sentiment,keyword,content,volume,occurred_at&limit=2000`
  ).catch((): SignalRow[] => []);

  if (signals.length === 0) {
    return { ok: false, error: "ยังไม่มีสัญญาณในช่วงเวลานี้ — กดซิงก์ข้อมูลก่อน" };
  }

  const started = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `ช่วงเวลา: ${since.toISOString().slice(0, 10)} ถึง ${new Date().toISOString().slice(0, 10)}\n` +
            `จำนวนสัญญาณทั้งหมด: ${signals.length}\n\n${describe(signals)}`,
        },
      ],
    }),
  }).catch(() => null);

  if (!res || !res.ok) {
    if (res) console.error("[brand-insight] anthropic error", res.status, (await res.text()).slice(0, 300));
    return { ok: false, error: "เรียก AI ไม่สำเร็จ กรุณาลองใหม่" };
  }

  const data = await res.json();
  const text = (data?.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");

  await logAiUsage({
    feature: "brand-insight",
    model: MODEL,
    outcome: "ok",
    usage: data?.usage,
    durationMs: Date.now() - started,
  }).catch(() => {});

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้" };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { ok: false, error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้" };
  }

  const insight: BrandInsight = {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    positive_themes: asStringArray(parsed.positive_themes),
    negative_themes: asStringArray(parsed.negative_themes),
    recommendations: asStringArray(parsed.recommendations),
    signals_considered: signals.length,
  };

  await supabaseRest("brand_insights", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      period_start: since.toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      summary: insight.summary,
      positive_themes: insight.positive_themes,
      negative_themes: insight.negative_themes,
      recommendations: insight.recommendations,
      signals_considered: insight.signals_considered,
      model: MODEL,
    }),
  }).catch((err) => console.error("[brand-insight] could not store", err));

  return { ok: true, insight };
}
