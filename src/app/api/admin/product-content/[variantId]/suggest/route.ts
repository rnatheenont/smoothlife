import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";
import { logAiUsage } from "@/lib/ai-usage";
import { BLOCK_TYPES, type ContentBlock } from "@/lib/product-content";

// Drafts one block of a product's copy, in both languages, for a person to
// read and correct. It drafts; it never saves and never publishes — same
// discipline as /api/admin/seo/suggest and the knowledge base.
//
// Raw fetch rather than the Anthropic SDK because every other AI call in this
// codebase is a raw fetch (translate, skin-analysis, inbox draft, seo suggest,
// brand-insight); one route importing an SDK would be the odd one out for no
// gain.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Two separate dangers, and the prompt has to carry both.
//
// The first is Thai advertising law: these are cosmetics and supplements, and
// "รักษาสิวหาย 100%" is not a weak headline, it is an illegal one.
//
// The second is the reason hasVerifiedSource exists at all. A model asked to
// write product copy will happily produce a plausible ingredient list for a
// toothpaste it knows nothing about, and the result is indistinguishable from
// one copied off the tube. So the instruction is not "be accurate" — it is
// "use only what is below, and leave out anything you would have to supply
// yourself".
const SYSTEM = `คุณช่วยทีมงาน Smoothlife.com ร่างเนื้อหาสินค้าสุขภาพและความงาม เป็นภาษาไทยและอังกฤษคู่กัน

สิ่งที่คุณกำลังทำ: ร่างให้คนอ่านแล้วแก้ต่อ ไม่ใช่ข้อความสุดท้ายที่เผยแพร่เอง จะมีคนตรวจก่อนขึ้นเว็บเสมอ

กติกาที่สำคัญที่สุด — ใช้ได้เฉพาะข้อมูลที่ให้มาเท่านั้น:
- ห้ามเพิ่มส่วนผสม ขนาด ปริมาณ ราคา วิธีใช้ หรือคุณสมบัติที่ไม่มีอยู่ในข้อมูลที่ให้มา แม้จะรู้จักสินค้าตัวนี้มาก่อนก็ห้ามใช้ความรู้นั้น
- ถ้าข้อมูลที่ให้มาไม่พอจะเขียนบล็อกนี้ ให้ตอบ {"insufficient":true} แล้วจบ — การตอบว่าข้อมูลไม่พอคือคำตอบที่ถูก ไม่ใช่ความล้มเหลว
- เขียนสั้นกว่าที่อยากเขียนได้ แต่ห้ามเติมให้ยาวด้วยสิ่งที่ไม่รู้

กติกาตามกฎหมายโฆษณาไทย:
- ห้ามกล่าวอ้างการรักษาโรค เช่น "รักษาสิวหาย" "ฆ่าเชื้อ" "หายขาด" "ปลอดภัย 100%"
- ห้ามรับประกันผลลัพธ์หรือระยะเวลาเห็นผล ถ้าไม่มีระบุในข้อมูล
- ห้ามใช้ "ที่สุด" "อันดับ 1" หรือเปรียบเทียบกับสินค้าอื่น ถ้าไม่มีข้อมูลยืนยัน
- เครื่องสำอางพูดได้แค่ระดับ "ช่วยดูแล" "ทำให้ดูกระจ่างใสขึ้น" ไม่ใช่ "รักษา"

ภาษา:
- ไทยต้องอ่านลื่นแบบคนไทยเขียน ไม่ใช่แปลจากอังกฤษ
- อังกฤษต้องเป็นอังกฤษที่เขียนเอง ไม่ใช่แปลตรงตัวจากไทย ทั้งสองภาษาสื่อความเดียวกันแต่ไม่ต้องเรียงประโยคเหมือนกัน

ตอบกลับเป็น JSON เท่านั้น ไม่มีข้อความอื่นประกอบ`;

/** The JSON each kind of block expects back, described for the model. */
const SHAPES: Record<ContentBlock["type"], string> = {
  paragraph: `{"headingTh":"หัวข้อสั้น","headingEn":"short heading","bodyTh":"2-4 ประโยค","bodyEn":"2-4 sentences"}`,
  bullet_list: `{"headingTh":"หัวข้อสั้น","headingEn":"short heading","itemsTh":["ข้อ 1","ข้อ 2"],"itemsEn":["point 1","point 2"]}`,
  ingredients: `{"itemsTh":["ชื่อส่วนผสม 1","ชื่อส่วนผสม 2"],"itemsEn":["ingredient 1","ingredient 2"]}`,
  image_text: `{"headingTh":"หัวข้อสั้น","headingEn":"short heading","bodyTh":"2-3 ประโยค","bodyEn":"2-3 sentences"}`,
  spec_table: `{"rows":[{"labelTh":"หัวข้อ","labelEn":"label","valueTh":"ค่า","valueEn":"value"}]}`,
};

const GUIDANCE: Record<ContentBlock["type"], string> = {
  paragraph: "ย่อหน้าอธิบายว่าสินค้านี้คืออะไรและช่วยดูแลเรื่องอะไร",
  bullet_list: "รายการจุดเด่นหรือประโยชน์ ข้อละบรรทัด สั้น ๆ",
  ingredients:
    "เฉพาะชื่อส่วนผสมที่ระบุไว้ในข้อมูลเท่านั้น ห้ามเติมส่วนผสมเอง ถ้าข้อมูลไม่ได้ระบุส่วนผสมให้ตอบ insufficient",
  image_text: "ข้อความสั้นที่จะวางคู่กับรูป",
  spec_table:
    "ตารางข้อมูลจำเพาะ เช่น ขนาดบรรจุ รูปแบบ วิธีเก็บ — เฉพาะที่มีในข้อมูล",
};

function isBlockType(v: unknown): v is ContentBlock["type"] {
  return typeof v === "string" && BLOCK_TYPES.some((b) => b.key === v);
}

/** What the model is allowed to work from: this product's own catalogue entry,
 *  which came from Shopify. Nothing else is sent and nothing else may be used. */
function contextFor(variantId: string) {
  const product = products.find((p) =>
    p.variants.some((v) => v.variantId === variantId),
  );
  if (!product) return null;
  const lines = [
    `ชื่อสินค้า: ${product.name}`,
    `แบรนด์: ${product.brand}`,
    `หมวดหมู่: ${product.category}`,
    product.shortDesc ? `คำอธิบายสั้น: ${product.shortDesc}` : "",
    product.description ? `รายละเอียด: ${product.description}` : "",
    product.benefits?.length
      ? `ประโยชน์ที่ระบุไว้:\n- ${product.benefits.join("\n- ")}`
      : "",
    product.ingredients ? `ส่วนผสมที่ระบุไว้: ${product.ingredients}` : "",
    product.howToUse ? `วิธีใช้ที่ระบุไว้: ${product.howToUse}` : "",
    product.whoFor ? `เหมาะกับ: ${product.whoFor}` : "",
  ].filter(Boolean);
  return { product, text: lines.join("\n").slice(0, 6000) };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ variantId: string }> },
) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" },
      { status: 503 },
    );

  const { variantId: raw } = await ctx.params;
  const variantId = decodeURIComponent(raw);
  const body = await req.json().catch(() => null);
  const type = body?.type;
  if (!isBlockType(type))
    return NextResponse.json(
      { ok: false, error: "ไม่รู้จักชนิดบล็อกนี้" },
      { status: 400 },
    );

  const context = contextFor(variantId);
  if (!context)
    return NextResponse.json(
      { ok: false, error: "ไม่พบสินค้าของ variant นี้" },
      { status: 404 },
    );

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              `ข้อมูลสินค้าที่มีอยู่จริง (ใช้ได้เฉพาะเท่านี้):\n${context.text}`,
              `\nบล็อกที่ต้องร่าง: ${GUIDANCE[type]}`,
              `\nรูปแบบ JSON ที่ต้องตอบ:\n${SHAPES[type]}`,
              `\nถ้าข้อมูลข้างบนไม่พอ ตอบ {"insufficient":true}`,
            ].join("\n"),
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[product-content/suggest] request failed", err);
    return NextResponse.json(
      { ok: false, error: "เรียก AI ไม่สำเร็จ กรุณาลองใหม่" },
      { status: 502 },
    );
  }

  if (!res.ok) {
    console.error(
      "[product-content/suggest] anthropic error",
      res.status,
      (await res.text()).slice(0, 300),
    );
    return NextResponse.json(
      { ok: false, error: "AI ตอบกลับไม่สำเร็จ กรุณาลองใหม่" },
      { status: 502 },
    );
  }

  const data = await res.json();
  const text = (data?.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");

  // Asked for bare JSON; a stray fence or preamble should not cost the call.
  const match = text.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = match ? JSON.parse(match[0]) : null;
  } catch {
    parsed = null;
  }

  const insufficient = parsed?.insufficient === true;
  await logAiUsage({
    feature: "product-content-suggest",
    model: MODEL,
    outcome: insufficient ? "insufficient" : parsed ? "ok" : "empty",
    usage: data?.usage,
    durationMs: Date.now() - started,
  }).catch(() => {});

  if (insufficient) {
    return NextResponse.json({
      ok: false,
      insufficient: true,
      error:
        "ข้อมูลสินค้าที่มีอยู่ยังไม่พอจะร่างบล็อกนี้ — ต้องใส่ข้อมูลจริงจากฉลากหรือเอกสารสเปคก่อน",
    });
  }
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้ กรุณาลองใหม่" },
      { status: 502 },
    );
  }

  // Returned, never written. The caller merges it into the block it asked for
  // and forces hasVerifiedSource back to false — a draft is by definition
  // something nobody has pointed at a document for yet.
  return NextResponse.json({ ok: true, draft: parsed });
}
