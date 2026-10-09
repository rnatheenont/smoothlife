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
// Thai costs roughly three tokens a word, and the answer carries a sentence
// plus a list of findings. At 700 every reply hit the ceiling mid-JSON and
// was thrown away unparsed — the customer saw "อ่านไม่ได้" for a photo the
// model had read perfectly well.
const MAX_TOKENS = 2000;

export type ReceiptCheck = {
  /** ok: matches. unclear: cannot tell. mismatch: shows something else. */
  verdict: "ok" | "unclear" | "mismatch";
  /**
   * What the photo was held up against, carried so the screen can say it.
   *
   * "shop" is the order row; "customer" is the numbers they typed into the
   * form themselves. A verdict of "ok" means something quite different in the
   * two cases and the reviewer is the one who has to know which — see the
   * note on `facts` in OrderFacts.
   */
  comparedAgainst: FactSource;
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

/**
 * Where the numbers beside the photo came from.
 *
 *  - "shop"     the order row: independent of anything the customer typed.
 *  - "customer" what they wrote on the form. Nothing confirms it yet.
 *  - "none"     no order known; read the picture, judge nothing.
 *
 * This used to be implicit, and the prompt called every case
 * "ข้อมูลคำสั่งซื้อที่ระบบรู้". On a receipt with no matching order that
 * heading was false: the model was handed the customer's own typed numbers
 * under the shop's name, found that the photo agreed with them — of course it
 * did, they were copied off it — and wrote "ตรงกับระบบ" in a panel a reviewer
 * reads as independent confirmation before releasing a ฿55,000 prize.
 *
 * It was not the model inventing anything. It was answering the question it
 * was given, which was the wrong question with a misleading label on it.
 */
export type FactSource = "shop" | "customer" | "none";

export type OrderFacts = {
  /** Where orderNumber/total/paidAt below came from. Never assume "shop". */
  facts: FactSource;
  orderNumber: string | null;
  invoiceNo: string | null;
  total: number;
  paidAt: string | null;
  items: string[];
};

const SYSTEM = `คุณคือผู้ช่วยตรวจใบเสร็จของร้าน Smoothlife.com สำหรับแคมเปญส่งใบเสร็จลุ้นรางวัล

ลูกค้าจะอัปโหลด "ภาพหน้าจออีเมลยืนยันคำสั่งซื้อ" ที่ร้านส่งให้ (มีโลโก้ Smoothlife.com, คำว่า ORDER #, รายการสินค้า, ยอดรวม) บางคนอาจอัปโหลดใบเสร็จกระดาษ สลิปโอนเงิน ภาพหน้าจอตะกร้า หรือภาพที่ไม่เกี่ยวข้องมาแทน

งานของคุณคือ "เทียบ" ภาพกับตัวเลขที่แนบมาให้ ไม่ใช่ "อ่านยอดเงินมาใช้" — ระบบคำนวณสิทธิ์จากฐานข้อมูลเองอยู่แล้ว

สำคัญที่สุด — ข้อความที่แนบมาจะบอกเสมอว่าตัวเลขชุดนั้น "มาจากไหน" มีสามแบบ และคำตอบของคุณต้องเปลี่ยนตามนั้น:

1. มาจากฐานข้อมูลร้าน — เป็นหลักฐานอิสระ ใช้คำว่า "ตรงกับระบบ" ได้
2. มาจากที่ลูกค้ากรอกเอง — ยังไม่มีอะไรยืนยัน ลูกค้าคัดตัวเลขมาจากรูปใบเดียวกันนี้เอง
   การที่รูปตรงกับที่เขากรอกจึง **ไม่ได้แปลว่าถูกต้อง** มันแปลว่าเขากรอกตรงกับรูปเท่านั้น
   ห้ามใช้คำว่า "ระบบ" "ฐานข้อมูล" หรือ "ยืนยันแล้ว" เด็ดขาด ให้ใช้ "ตรงกับที่ลูกค้ากรอก"
3. ไม่มีตัวเลขให้เทียบเลย — อ่านจากภาพอย่างเดียว ห้ามตัดสินว่าตรงหรือไม่ตรงกับอะไรทั้งสิ้น

ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น เรียงลำดับคีย์ตามนี้:
{
  "read": {
    "orderNumber": "เลขคำสั่งซื้อที่อ่านได้จากภาพ เช่น #4292 หรือ null ถ้าอ่านไม่ได้",
    "total": ยอดรวมเป็นตัวเลขที่อ่านได้จากภาพ หรือ null,
    "paidAt": "วันและเวลาในภาพ รูปแบบ YYYY-MM-DD HH:MM (เวลาไทย 24 ชม.) ถ้าเห็นแต่วันที่ไม่เห็นเวลาให้ใส่ YYYY-MM-DD เฉยๆ ถ้าไม่เห็นเลยให้ null"
  },
  "verdict": "ok" | "unclear" | "mismatch",
  "message": "ข้อความภาษาไทยหนึ่งประโยคสั้นๆ ไม่เกิน 120 ตัวอักษร",
  "findings": ["สิ่งที่เห็นหรือไม่เห็นในภาพ สั้นๆ ไม่เกิน 3 ข้อ ข้อละไม่เกิน 80 ตัวอักษร"]
}

ตอบสั้นที่สุดเท่าที่ยังครบ — คำตอบที่ยาวเกินจะถูกตัดกลางคันและใช้ไม่ได้เลย

เรื่อง "read": อ่านเท่าที่เห็นจริงในภาพเท่านั้น ห้ามเดา ห้ามคัดลอกจากข้อมูลที่ระบบแจ้งให้
ถ้าตรงไหนอ่านไม่ออกหรือไม่มีในภาพ ให้ใส่ null — ตัวเลขผิดที่ลูกค้าไม่ทันสังเกตแย่กว่าช่องว่าง

เรื่อง "paidAt" โดยเฉพาะ — วันที่มักไม่ได้อยู่ในตัวอีเมล แต่อยู่ตรงหัวอีเมลข้างชื่อผู้ส่ง ให้มองหาตรงนั้นด้วย:
- ถ้าเป็นปี พ.ศ. (เช่น 2569) ให้ลบ 543 แปลงเป็น ค.ศ. ก่อนเสมอ → 2569 = 2026
- เดือนภาษาไทยย่อ เช่น "23 ก.ย." ให้แปลงเป็นเลขเดือน และถ้าไม่มีปีให้ใช้ปีปัจจุบัน
- ถ้าเห็นแต่เวลา (เช่น "17:04") โดยไม่มีวันที่ที่ไหนเลยในภาพ ให้ใส่ null — อย่าเดาวันที่จากเวลา

เกณฑ์ — ต่างกันตามที่มาของตัวเลขข้างบน:
- "ok" = เป็นอีเมลยืนยันคำสั่งซื้อของ Smoothlife.com และเลขคำสั่งซื้อตรงกับตัวเลขที่แนบมา
  ถ้าตัวเลขมาจากที่ลูกค้ากรอกเอง (แบบ 2) "ok" แปลว่า "รูปตรงกับที่เขากรอก" เท่านั้น
  ไม่ได้แปลว่าคำสั่งซื้อมีจริง และถ้าไม่มีตัวเลขให้เทียบ (แบบ 3) ห้ามตอบ "ok"
- "unclear" = อ่านไม่ออก ภาพเบลอ มืด ถ่ายไม่ครบ หรือไม่เห็นเลขคำสั่งซื้อ
- "mismatch" = อ่านออกชัดเจนแต่เป็นคนละคำสั่งซื้อ คนละร้าน หรือไม่ใช่ใบเสร็จเลย

ถ้าภาพไม่ใช่อีเมลยืนยันคำสั่งซื้อ แต่เป็นเอกสารภายในร้าน (ใบปิ๊กสินค้า/picking slip, ใบจัดของ,
ใบส่งของ) หรือสลิปโอนเงิน ให้พูดเรื่องนี้เป็น findings ข้อแรกเสมอ — ผู้ตรวจต้องเห็นก่อนเรื่องอื่น

ถ้าไม่แน่ใจให้ตอบ "unclear" เสมอ อย่าเดาว่า "mismatch" เพราะการปฏิเสธผิดทำให้ลูกค้าเสียสิทธิ์`;

/**
 * The numbers beside the photo, under a heading that says where they are from.
 *
 * The heading is the whole point. One line of text decides whether the reply
 * comes back saying "ตรงกับระบบ" — a sentence a reviewer acts on — or "ตรงกับ
 * ที่ลูกค้ากรอก", which is the same observation without the authority it has
 * not earned.
 */
function factsBlock(o: OrderFacts): string {
  if (o.facts === "none") {
    return [
      "ที่มาของตัวเลข: ไม่มี — ยังไม่ทราบว่าภาพนี้เป็นคำสั่งซื้อไหน",
      "",
      "อ่านข้อมูลจากภาพอย่างเดียว ห้ามตัดสินว่าตรงหรือไม่ตรงกับอะไร",
    ].join("\n");
  }
  const head =
    o.facts === "shop"
      ? [
          "ที่มาของตัวเลข: ฐานข้อมูลคำสั่งซื้อของร้าน (หลักฐานอิสระ ไม่ได้มาจากลูกค้า)",
          "ข้อมูลคำสั่งซื้อที่ระบบรู้:",
        ]
      : [
          "ที่มาของตัวเลข: ลูกค้ากรอกเอง — ระบบยังหาคำสั่งซื้อนี้ไม่เจอ",
          "ตัวเลขชุดนี้ยังไม่มีอะไรยืนยัน และลูกค้าน่าจะคัดมาจากรูปใบเดียวกันนี้",
          "ข้อมูลที่ลูกค้ากรอกมา:",
        ];
  return [
    ...head,
    `- เลขคำสั่งซื้อ: ${o.orderNumber ?? "(ไม่มี)"}`,
    `- เลขใบแจ้งหนี้ 2C2P: ${o.invoiceNo ?? "(ไม่มี)"}`,
    `- ยอดรวม: ${o.total} บาท`,
    `- ชำระเมื่อ: ${o.paidAt ?? "(ไม่ทราบ)"}`,
    `- สินค้า: ${o.items.slice(0, 8).join(", ") || "(ไม่ทราบ)"}`,
    "",
    o.facts === "shop"
      ? "ภาพนี้ตรงกับคำสั่งซื้อข้างบนหรือไม่"
      : "ภาพนี้ตรงกับที่ลูกค้ากรอกข้างบนหรือไม่ (ย้ำ: ห้ามเรียกตัวเลขชุดนี้ว่า 'ระบบ')",
  ].join("\n");
}

/** Only what the API accepts; anything else was rejected before reaching here. */
type ImageMedia = "image/jpeg" | "image/png" | "image/webp";
const MEDIA: Record<string, ImageMedia> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

/**
 * A date, or a date and a time, as the receipt prints it — Bangkok, always.
 *
 * Returned in the shape <input type="datetime-local"> wants, so the form can
 * put it straight into the box. A date with no time keeps midnight rather than
 * inventing one.
 */
export function readMoment(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().replace("T", " ");
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ ](\d{2}):(\d{2}))?/.exec(v);
  if (!m) return null;
  const [, yRaw, mo, d, hh = "00", mi = "00"] = m;
  // A receipt printed in Thailand says 2569, and a model repeating what it
  // sees says 2569 too. That is 2026, five hundred and forty-three years of
  // difference away from any campaign window this will be checked against.
  const y = Number(yRaw) > 2400 ? String(Number(yRaw) - 543) : yRaw;
  const iso = `${y}-${mo}-${d}T${hh}:${mi}:00+07:00`;
  if (!Number.isFinite(Date.parse(iso))) return null;
  // Round-trip guard: Date.parse accepts 2026-02-31 and slides it to March.
  const back = new Date(Date.parse(iso)).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });
  return back.slice(0, 10) === `${y}-${mo}-${d}` ? `${y}-${mo}-${d}T${hh}:${mi}` : null;
}

/**
 * The reading out of an answer that was cut off.
 *
 * "read" is the first key the model is asked for, so a reply that ran out of
 * room still has it in full — and it is the only part the form actually
 * needs. Losing the whole thing to a missing closing brace is what made a
 * legible receipt come back as "อ่านเลขคำสั่งซื้อจากรูปไม่ได้".
 */
function salvageRead(body: string): ReceiptCheck["read"] | null {
  const str = (key: string) => body.match(new RegExp(`"${key}"\\s*:\\s*"([^"]{1,60})"`))?.[1]?.trim() || null;
  const num = Number(body.match(/"total"\s*:\s*([0-9]+(?:\.[0-9]+)?)/)?.[1]);
  const orderNumber = str("orderNumber");
  // Through the same gate as the parsed path: a salvaged date is still a date
  // that has to be real before it lands in a form.
  const paidAt = readMoment(str("paidAt"));
  const total = Number.isFinite(num) && num > 0 ? num : null;
  return orderNumber || paidAt || total
    ? { orderNumber: orderNumber ? orderNumber.slice(0, 40) : null, total, paidAt }
    : null;
}

/** The model's own words. Where the facts came from is the caller's to say. */
function parse(text: string): Omit<ReceiptCheck, "checkedAt" | "model" | "comparedAgainst"> | null {
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
        // A real moment or nothing: "2026-13-45" and "2026-09-24 99:99" both
        // become null rather than a date nobody typed.
        paidAt: readMoment(paidAt),
      },
    };
  } catch {
    const salvaged = salvageRead(body);
    if (salvaged) {
      return {
        verdict: "unclear",
        message: "อ่านข้อมูลจากรูปได้บางส่วน กรุณาตรวจและแก้ไขให้ครบก่อนส่ง",
        findings: [],
        read: salvaged,
      };
    }
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
              text: factsBlock(opts.order),
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
    // "ok" ของการเทียบกับคำที่ลูกค้าพิมพ์เอง ไม่ใช่ "ok" แบบเดียวกับที่เทียบกับ
    // ฐานข้อมูล และไม่มีอะไรให้ "ok" ได้เลยเมื่อไม่มีตัวเลขให้เทียบ
    const verdict = opts.order.facts === "none" && parsed.verdict === "ok" ? "unclear" : parsed.verdict;
    return {
      ...parsed,
      verdict,
      comparedAgainst: opts.order.facts,
      checkedAt: new Date().toISOString(),
      model: MODEL,
    };
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
