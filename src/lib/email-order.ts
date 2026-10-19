// The five emails about an order: paid, shipped, delivered, refunded,
// cancelled. Each returns its subject alongside its body, because a subject
// written in one file and a body in another drift — and the subject is the
// only part most people read.
//
// These are deliberately the same facts, in the same words, as the LINE cards
// in line-order-notify.ts; the shared vocabulary lives in order-events.ts so
// the two cannot say different things. What differs is shape: a LINE card is
// glanced at inside a chat, an email is opened on its own and can carry the
// whole order.
import {
  shell,
  heading,
  summary,
  caption,
  actionButton,
  secondaryLink,
  footnote,
  webLink,
  escapeHtml,
  DEEP,
  type Fact,
} from "./email-layout.ts";
import { baht, cancelReasonTh, orderItems, points, trackingOf } from "./order-events.ts";

export type OrderEmail = { subject: string; html: string };

const orderUrl = (orderId: string | number) => webLink(`/account/orders/${orderId}`);
const bold = (text: string) => `<strong style="color:${DEEP};">${escapeHtml(text)}</strong>`;

/** The first few products, plus "และอีก N รายการ" when there are more. */
function summaryItems(lineItems: { title?: string; name?: string; quantity?: number }[]) {
  const { shown, more } = orderItems(lineItems);
  const rows: { name: string; quantity?: number }[] = shown.map((it) => ({ name: it.name, quantity: it.quantity }));
  // No count beside it — "และอีก 2 รายการ ×1" would be nonsense.
  if (more > 0) rows.push({ name: `และอีก ${more} รายการ` });
  return rows;
}

/** Every one of these emails ends the same way: here is the order. */
function orderFootnote(orderName: string) {
  return `อีเมลฉบับนี้เกี่ยวกับคำสั่งซื้อ ${escapeHtml(orderName)}<br>มีอะไรไม่ตรงหรือสงสัย ตอบกลับอีเมลฉบับนี้ได้เลยค่ะ`;
}

/** Payment went through: what they bought, what it cost, the points it earned. */
export function orderPaidEmail(opts: {
  orderId: string | number;
  orderName: string;
  total: number;
  items: { title?: string; name?: string; quantity?: number }[];
  points: number;
  balance: number | null;
}): OrderEmail {
  const facts: Fact[] = [{ label: "ยอดรวม", value: baht(opts.total), strong: true }];
  if (opts.points > 0) {
    facts.push({ label: "แต้มที่ได้รับ", value: `+${points(opts.points)}` });
    if (opts.balance !== null) facts.push({ label: "แต้มสะสมทั้งหมด", value: points(opts.balance) });
  }

  return {
    subject: `ยืนยันคำสั่งซื้อ ${opts.orderName} — Smoothlife.com`,
    html: shell({
      preheader: `ชำระเงินสำเร็จ ${baht(opts.total)} กำลังเตรียมจัดส่งให้ค่ะ`,
      title: "ชำระเงินสำเร็จ",
      body: [
        heading("ชำระเงินสำเร็จ", `ขอบคุณที่สั่งซื้อกับ Smooth Life ค่ะ คำสั่งซื้อ ${bold(opts.orderName)} กำลังเตรียมจัดส่งให้นะคะ`),
        summary(summaryItems(opts.items), facts),
        actionButton(orderUrl(opts.orderId), "ดูคำสั่งซื้อ"),
        opts.points > 0 ? secondaryLink(webLink("/account"), "ดูแต้มสะสม") : "",
        footnote(orderFootnote(opts.orderName)),
      ].join(""),
    }),
  };
}

/** Handed to the courier — with the tracking number if Shopify has one. */
export function orderShippedEmail(opts: {
  orderId: string | number;
  orderName: string;
  fulfillment: { tracking_company?: string; tracking_number?: string; tracking_urls?: string[] };
  items?: { title?: string; name?: string; quantity?: number }[];
}): OrderEmail {
  const tracking = trackingOf(opts.fulfillment);
  const facts: Fact[] = [];
  if (tracking.company) facts.push({ label: "ขนส่ง", value: tracking.company });
  if (tracking.number) facts.push({ label: "เลขพัสดุ", value: tracking.number, strong: true });

  return {
    subject: `พัสดุออกเดินทางแล้ว ${opts.orderName} — Smoothlife.com`,
    html: shell({
      preheader: tracking.number
        ? `เลขพัสดุ ${tracking.number}${tracking.company ? ` · ${tracking.company}` : ""}`
        : "ทางร้านส่งพัสดุให้ขนส่งเรียบร้อยแล้วค่ะ",
      title: "พัสดุออกเดินทางแล้ว",
      body: [
        heading(
          "พัสดุออกเดินทางแล้ว",
          tracking.number
            ? `คำสั่งซื้อ ${bold(opts.orderName)} ส่งให้ขนส่งแล้ว ติดตามพัสดุได้จากปุ่มด้านล่างค่ะ`
            : `คำสั่งซื้อ ${bold(opts.orderName)} ส่งให้ขนส่งเรียบร้อยแล้วค่ะ`
        ),
        summary(summaryItems(opts.items ?? []), facts),
        // Tracking wins the button when there is one — it is what the email
        // was opened for — and the order stays one tap away underneath.
        tracking.url
          ? actionButton(tracking.url, "ติดตามพัสดุ") + secondaryLink(orderUrl(opts.orderId), "ดูคำสั่งซื้อ")
          : actionButton(orderUrl(opts.orderId), "ดูคำสั่งซื้อ"),
        tracking.number
          ? caption("แตะค้างที่เลขพัสดุเพื่อคัดลอก")
          : "",
        footnote(orderFootnote(opts.orderName)),
      ].join(""),
    }),
  };
}

/** The courier says it arrived. */
export function orderDeliveredEmail(opts: { orderId: string | number; orderName: string }): OrderEmail {
  return {
    subject: `จัดส่งสำเร็จแล้ว ${opts.orderName} — Smoothlife.com`,
    html: shell({
      preheader: "พัสดุถึงปลายทางแล้ว ได้รับของเรียบร้อยไหมคะ",
      title: "จัดส่งสำเร็จแล้ว",
      body: [
        heading(
          "จัดส่งสำเร็จแล้ว",
          `ขนส่งแจ้งว่าพัสดุของคำสั่งซื้อ ${bold(opts.orderName)} ถึงปลายทางแล้วค่ะ ได้รับของเรียบร้อยไหมคะ`
        ),
        actionButton(orderUrl(opts.orderId), "ดูคำสั่งซื้อ"),
        footnote(
          `ถ้าของไม่ตรง ชำรุด หรือยังไม่ได้รับ ตอบกลับอีเมลฉบับนี้ได้เลยค่ะ ทีมงานจะดูแลให้<br>อีเมลฉบับนี้เกี่ยวกับคำสั่งซื้อ ${escapeHtml(opts.orderName)}`
        ),
      ].join(""),
    }),
  };
}

/** Money went back — and, honestly, the points that came with it. */
export function orderRefundedEmail(opts: {
  orderId: string | number;
  orderName: string;
  amount: number;
  pointsReversed: number;
}): OrderEmail {
  const facts: Fact[] = [{ label: "ยอดคืนเงิน", value: baht(opts.amount), strong: true }];
  if (opts.pointsReversed > 0) {
    facts.push({ label: "แต้มที่ถูกหักคืน", value: `-${points(opts.pointsReversed)}` });
  }

  return {
    subject: `คืนเงินสำเร็จ ${opts.orderName} — Smoothlife.com`,
    html: shell({
      preheader: `คืนเงิน ${baht(opts.amount)} เรียบร้อยแล้ว`,
      title: "คืนเงินสำเร็จ",
      body: [
        heading("คืนเงินสำเร็จ", `ทางร้านคืนเงินของคำสั่งซื้อ ${bold(opts.orderName)} เรียบร้อยแล้วค่ะ`),
        summary([], facts),
        // The date is the bank's, not ours, so this says the range rather
        // than a day we would be inventing.
        caption("เงินจะเข้าบัญชีตามรอบของธนาคารหรือผู้ให้บริการบัตร ปกติ 3–14 วันทำการ"),
        actionButton(orderUrl(opts.orderId), "ดูคำสั่งซื้อ"),
        footnote(orderFootnote(opts.orderName)),
      ].join(""),
    }),
  };
}

/**
 * The order is not happening.
 *
 * Says nothing about money unless Shopify has actually refunded. A
 * cancellation does not know whether a refund was issued, when it will land
 * or how much — guessing here is a promise this code is in no position to
 * keep, and the refund email answers it when the refund exists.
 */
export function orderCancelledEmail(opts: {
  orderId: string | number;
  orderName: string;
  reason?: string | null;
  pointsReversed?: number;
  refunded?: boolean;
}): OrderEmail {
  const facts: Fact[] = [];
  const reason = cancelReasonTh(opts.reason);
  if (reason) facts.push({ label: "เหตุผล", value: reason });
  if (opts.pointsReversed && opts.pointsReversed > 0) {
    facts.push({ label: "แต้มที่ถูกหักคืน", value: `-${points(opts.pointsReversed)}` });
  }

  return {
    subject: `คำสั่งซื้อ ${opts.orderName} ถูกยกเลิก — Smoothlife.com`,
    html: shell({
      preheader: opts.refunded
        ? "คำสั่งซื้อถูกยกเลิก และทางร้านคืนเงินให้แล้ว"
        : "คำสั่งซื้อถูกยกเลิก ทีมงานจะติดต่อกลับเรื่องการคืนเงิน",
      title: "คำสั่งซื้อถูกยกเลิก",
      body: [
        heading(
          "คำสั่งซื้อถูกยกเลิก",
          opts.refunded
            ? `คำสั่งซื้อ ${bold(opts.orderName)} ถูกยกเลิก และทางร้านคืนเงินให้แล้ว รายละเอียดจะตามมาอีกฉบับค่ะ`
            : `คำสั่งซื้อ ${bold(opts.orderName)} ถูกยกเลิกแล้วค่ะ หากมีการชำระเงินเข้ามาแล้ว ทีมงานจะติดต่อกลับเรื่องการคืนเงิน`
        ),
        summary([], facts),
        actionButton(orderUrl(opts.orderId), "ดูคำสั่งซื้อ"),
        footnote(
          `หากไม่ได้เป็นผู้ขอยกเลิก หรือมีข้อสงสัย ตอบกลับอีเมลฉบับนี้ได้เลยค่ะ<br>อีเมลฉบับนี้เกี่ยวกับคำสั่งซื้อ ${escapeHtml(opts.orderName)}`
        ),
      ].join(""),
    }),
  };
}
