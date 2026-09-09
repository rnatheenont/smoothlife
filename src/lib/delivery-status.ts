import type { getCustomerOrders } from "@/lib/shopify-admin";

// What the chat assistant is allowed to say about a delivery, worked out here
// rather than by the model.
//
// "ของถึงไหนแล้ว" is the most common question the shop gets, and it is one the
// model can answer badly in two directions: inventing a status nobody recorded,
// or calmly telling someone their nine-day-old parcel is "on its way" when the
// only honest answer is that a person needs to chase the courier. Dates and
// thresholds are arithmetic — done in code, handed to the model as findings it
// may only repeat.

type Orders = NonNullable<Awaited<ReturnType<typeof getCustomerOrders>>>;
type Order = Orders[number];

/** Calendar days, floor. Deliberately not business days: a customer counting
 *  the days since they paid is counting these ones, weekend included. */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export type DeliveryFinding = {
  order: string;
  /** One line the assistant may repeat as-is. */
  line: string;
  /** True when this is past what the shop considers normal — a person's job. */
  needsStaff: boolean;
};

/**
 * Delivery state per order, plus whether it is outside normal.
 *
 * Thresholds are the shop's stated service level: packed in 1-2 working days,
 * Kerry delivers domestically in 1-4. Past those, saying "still on its way"
 * stops being information and starts being a brush-off.
 */
export function deliveryFindings(orders: Orders): DeliveryFinding[] {
  const out: DeliveryFinding[] = [];

  for (const o of orders) {
    const ordered = daysSince(o.createdAt);
    const paid = (o.financialStatus || "").toUpperCase();
    const unpaid = paid === "PENDING" || paid === "UNPAID" || paid === "AUTHORIZED";
    const refunded = paid.includes("REFUND");

    if (refunded) {
      out.push({ order: o.name, line: `${o.name}: มีการคืนเงินแล้ว/บางส่วน (${paid})`, needsStaff: true });
      continue;
    }

    // A parcel is the strongest fact available, so it is read first: an order
    // can still say UNFULFILLED in Shopify while the box is already moving.
    if (o.shipments.length > 0) {
      for (const s of o.shipments) {
        const shipped = daysSince(s.shippedAt);
        const courier = s.company || "ขนส่ง";
        const where = `${courier} ${s.number}`;
        if (s.deliveredAt) {
          out.push({
            order: o.name,
            line: `${o.name}: ส่งถึงแล้ว เมื่อ ${thaiDate(s.deliveredAt)} (${where})`,
            needsStaff: false,
          });
          continue;
        }
        const eta = s.estimatedDeliveryAt ? ` — คาดว่าถึง ${thaiDate(s.estimatedDeliveryAt)}` : "";
        if (shipped === null) {
          out.push({ order: o.name, line: `${o.name}: ส่งออกแล้ว (${where})${eta}`, needsStaff: false });
        } else if (shipped <= 4) {
          out.push({
            order: o.name,
            line: `${o.name}: กำลังจัดส่ง — ส่งออกเมื่อ ${thaiDate(s.shippedAt as string)} (${shipped} วันที่แล้ว, ${where})${eta} — ยังอยู่ในกรอบปกติ 1-4 วัน`,
            needsStaff: false,
          });
        } else if (shipped <= 7) {
          out.push({
            order: o.name,
            line: `${o.name}: ส่งออกมา ${shipped} วันแล้วยังไม่มีบันทึกว่าถึง (${where}) — ช้ากว่าปกติเล็กน้อย`,
            needsStaff: false,
          });
        } else {
          out.push({
            order: o.name,
            line: `${o.name}: ส่งออกมา ${shipped} วันแล้วยังไม่ถึง (${where}) — เกินกรอบปกติมาก ต้องให้ทีมงานตามพัสดุ`,
            needsStaff: true,
          });
        }
      }
      continue;
    }

    if (unpaid) {
      out.push({
        order: o.name,
        line: `${o.name}: ยังไม่ได้รับชำระเงิน (${paid}) — ยังไม่เริ่มจัดส่ง`,
        needsStaff: false,
      });
      continue;
    }

    if (ordered === null) {
      out.push({ order: o.name, line: `${o.name}: ยังไม่มีเลขพัสดุ`, needsStaff: false });
    } else if (ordered <= 2) {
      out.push({
        order: o.name,
        line: `${o.name}: สั่งเมื่อ ${thaiDate(o.createdAt)} (${ordered} วันที่แล้ว) — อยู่ระหว่างเตรียมของ ปกติแพ็กและส่งภายใน 1-2 วันทำการ`,
        needsStaff: false,
      });
    } else if (ordered <= 4) {
      out.push({
        order: o.name,
        line: `${o.name}: สั่งมา ${ordered} วันแล้วยังไม่มีเลขพัสดุ — ช้ากว่าปกติเล็กน้อย (วันหยุดอาจทำให้ช้าได้)`,
        needsStaff: false,
      });
    } else {
      out.push({
        order: o.name,
        line: `${o.name}: สั่งมา ${ordered} วันแล้วยังไม่มีเลขพัสดุ — เกินกรอบปกติ ต้องให้ทีมงานตรวจสอบ`,
        needsStaff: true,
      });
    }
  }

  return out;
}

/** The delivery block for the system prompt, or null when there is nothing. */
export function deliveryStatusForPrompt(orders: Orders | null): string | null {
  if (!orders || orders.length === 0) return null;
  const findings = deliveryFindings(orders);
  if (findings.length === 0) return null;
  const urgent = findings.filter((f) => f.needsStaff);
  const links = orders
    .flatMap((o) => o.shipments.filter((s) => s.url).map((s) => `${o.name}: ${s.url}`))
    .slice(0, 5);

  return [
    "สถานะจัดส่ง (คำนวณจากข้อมูลจริงใน Shopify — ห้ามเดาเอง ใช้บรรทัดพวกนี้เท่านั้น):",
    ...findings.map((f) => `- ${f.line}`),
    links.length ? `ลิงก์ติดตามพัสดุ:\n${links.map((l) => `- ${l}`).join("\n")}` : "",
    urgent.length
      ? `ต้องส่งต่อทีมงาน: ${urgent.map((u) => u.order).join(", ")} — อธิบายให้ลูกค้าสั้นๆ ว่าเกินกรอบปกติแล้วและส่งต่อทีมงานทันที (ใช้ HANDOFF) ห้ามบอกให้รอเฉยๆ`
      : "ทุกออเดอร์อยู่ในกรอบเวลาปกติ — ตอบและอธิบายเองได้ ไม่ต้องส่งต่อทีมงาน",
  ]
    .filter(Boolean)
    .join("\n");
}
