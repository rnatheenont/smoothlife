import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/ai-usage";

// A first look at the photo, before a person has to take one.
//
// It is a reading, not a decision. The entries a receipt is worth come from the
// order row and nothing here can change them; approving stays a reviewer's job,
// because ฿55,000 is not a thing to hand out on a model's say-so. What this
// saves is the round trip: a photo that is too dark to read, or of somebody
// else's order, is caught while the customer still has the right one open
// instead of three days later in a rejection notice.
//
// The order is already known — number, total, date, what was in it — so the
// model is asked to compare, not to extract. "Does this picture show the order
// I am telling you about" is a question with a checkable answer; "read the
// total off this receipt" is one where a confident misreading looks the same
// as a correct one.

const MODEL = process.env.ANTHROPIC_RECEIPT_MODEL || "claude-sonnet-5";
const MAX_TOKENS = 700;

export type ReceiptCheck = {
  /** ok: matches. unclear: cannot tell. mismatch: shows something else. */
  verdict: "ok" | "unclear" | "mismatch";
  /** One line for the customer, in Thai, saying what to do about it. */
  message: string;
  /** What the model could and could not make out, for the reviewer. */
  findings: string[];
  /**
   * What the model could read off the picture, to save the customer typing it.
   *
   * A suggestion, never an input to the arithmetic: entries are computed from
   * the order row, and this is only here so the form arrives filled in and the
   * customer can correct it. Anything unreadable comes back null rather than
   * guessed — a wrong number they did not notice is worse than an empty box.
   */
  read: { orderNumber: string | null; total: number | null; paidAt: string | null };
  checkedAt: string;
  model: string;
};

export type OrderFacts = {
  orderNumber: string | null;
  invoiceNo: string | null;
  total: number;
  paidAt: string | null;
  items: string[];
};

const SYSTEM = `คุณคือผู้ช่วยตรวจใบเสร็จของร้าน Smoothlife.com สำหรับแคมเปญส่งใบเสร็จลุ้นรางวัล

ลูกค้าจะอัปโหลด "ภาพหน้าจออีเมลยืนยันคำสั่งซื้อ" ที่ร้านส่งให้ (มีโลโก้ Smoothlife.com, คำว่า ORDER #, รายการสินค้า, ยอดรวม) บางคนอาจอัปโหลดใบเสร็จกระดาษ สลิปโอนเงิน ภาพหน้าจอตะกร้า หรือภาพที่ไม่เกี่ยวข้องมาแทน

งานของคุณคือ "เทียบ" ภาพกับข้อมูลคำสั่งซื้อที่ระบบรู้อยู่แล้ว ไม่ใช่ "อ่านยอดเงินมาใช้" — ระบบคำนวณสิทธิ์จากฐานข้อมูลเองอยู่แล้ว

ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น:
{
  "verdict": "ok" | "unclear" | "mismatch",
  "message": "ข้อความภาษาไทยหนึ่งประโยคบอกลูกค้าว่าต้องทำอะไร",
  "findings": ["สิ่งที่เห็นหรือไม่เห็นในภาพ เป็นภาษาไทย"],
  "read": {
    "orderNumber": "เลขคำสั่งซื้อที่อ่านได้จากภาพ เช่น #4292 หรือ null ถ้าอ่านไม่ได้",
    "total": ยอดรวมเป็นตัวเลขที่อ่านได้จากภาพ หรือ null,
    "paidAt": "วันที่ในภาพ รูปแบบ YYYY-MM-DD หรือ null"
  }
}

เรื่อง "read": อ่านเท่าที่เห็นจริงในภาพเท่านั้น ห้ามเดา ห้ามคัดลอกจากข้อมูลที่ระบบแจ้งให้
ถ้าตรงไหนอ่านไม่ออกหรือไม่มีในภาพ ให้ใส่ null — ตัวเลขผิดที่ลูกค้าไม่ทันสังเกตแย่กว่าช่องว่าง

เกณฑ์:
- "ok" = เป็นอีเมลยืนยันคำสั่งซื้อของ Smoothlife.com และเลขคำสั่งซื้อตรงกับที่ระบบแจ้ง
- "unclear" = อ่านไม่ออก ภาพเบลอ มืด ถ่ายไม่ครบ หรือไม่เห็นเลขคำสั่งซื้อ
- "mismatch" = อ่านออกชัดเจนแต่เป็นคนละคำสั่งซื้อ คนละร้าน หรือไม่ใช่ใบเสร็จเลย

ถ้าไม่แน่ใจให้ตอบ "unclear" เสมอ อย่าเดาว่า "mismatch" เพราะการปฏิเสธผิดทำให้ลูกค้าเสียสิทธิ์`;

/** Only what the API accepts; anything else was rejected before reaching here. */
type ImageMedia = "image/jpeg" | "image/png" | "image/webp";
const MEDIA: Record<string, ImageMedia> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

function parse(text: string): Omit<ReceiptCheck, "checkedAt" | "model"> | null {
  // The model is asked for bare JSON; a stray ```json fence is the one
  // deviation worth surviving rather than throwing the whole reading away.
  const body = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const raw = JSON.parse(body) as {
      verdict?: string;
      message?: string;
      findings?: unknown;
      read?: { orderNumber?: unknown; total?: unknown; paidAt?: unknown };
    };
    const verdict = raw.verdict === "ok" || raw.verdict === "mismatch" ? raw.verdict : "unclear";
    const total = Number(raw.read?.total);
    const paidAt = typeof raw.read?.paidAt === "string" ? raw.read.paidAt.trim() : "";
    return {
      verdict,
      message: typeof raw.message === "string" ? raw.message.slice(0, 300) : "",
      findings: Array.isArray(raw.findings)
        ? raw.findings.filter((f): f is string => typeof f === "string").slice(0, 6)
        : [],
      read: {
        orderNumber:
          typeof raw.read?.orderNumber === "string" && raw.read.orderNumber.trim()
            ? raw.read.orderNumber.trim().slice(0, 40)
            : null,
        total: Number.isFinite(total) && total > 0 ? total : null,
        // Only a real calendar date survives — "2026-13-45" becomes nothing.
        paidAt: /^\d{4}-\d{2}-\d{2}$/.test(paidAt) && Number.isFinite(Date.parse(paidAt)) ? paidAt : null,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Reads the photo against the order it is claimed to be for.
 *
 * Never throws and never blocks: if the key is missing, the model is slow, or
 * the answer will not parse, this returns null and the receipt goes to a human
 * exactly as it did before any of this existed.
 */
export async function checkReceiptPhoto(opts: {
  bytes: ArrayBuffer;
  contentType: string;
  order: OrderFacts;
}): Promise<ReceiptCheck | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  const media = MEDIA[opts.contentType];
  if (!key || !media) return null;

  const started = Date.now();
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: media, data: Buffer.from(opts.bytes).toString("base64") },
            },
            {
              type: "text",
              text: [
                "ข้อมูลคำสั่งซื้อที่ระบบรู้:",
                `- เลขคำสั่งซื้อ: ${opts.order.orderNumber ?? "(ไม่มี)"}`,
                `- เลขใบแจ้งหนี้ 2C2P: ${opts.order.invoiceNo ?? "(ไม่มี)"}`,
                `- ยอดรวม: ${opts.order.total} บาท`,
                `- ชำระเมื่อ: ${opts.order.paidAt ?? "(ไม่ทราบ)"}`,
                `- สินค้า: ${opts.order.items.slice(0, 8).join(", ") || "(ไม่ทราบ)"}`,
                "",
                "ภาพนี้ตรงกับคำสั่งซื้อข้างบนหรือไม่",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = parse(text);
    void logAiUsage({
      feature: "receipt_check",
      model: MODEL,
      outcome: parsed?.verdict ?? "unparsed",
      usage: res.usage,
      photos: 1,
      durationMs: Date.now() - started,
    }).catch(() => {});

    if (!parsed) return null;
    return { ...parsed, checkedAt: new Date().toISOString(), model: MODEL };
  } catch (err) {
    console.error("[receipt-vision] check failed", err);
    void logAiUsage({
      feature: "receipt_check",
      model: MODEL,
      outcome: "error",
      usage: null,
      photos: 1,
      durationMs: Date.now() - started,
    }).catch(() => {});
    return null;
  }
}
