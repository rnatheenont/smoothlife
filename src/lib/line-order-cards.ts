import { lineOpenLink, type LineMessage } from "@/lib/line-push";

// The four moments an order tells the customer something, as LINE cards.
//
// These are the messages people actually want from a shop's LINE account —
// paid, shipped, delivered, refunded — and the one they ask the chat for most
// ("แต้มได้เท่าไหร่") rides along on the first of them rather than costing a
// second notification. Every number on a card comes from the Shopify webhook
// or our own ledger; nothing here estimates.

const GREEN = "#0E9F6E";
const INK = "#1F2937";
const MUTED = "#6B7280";
const LINE_GREY = "#E5E7EB";

export type CardRow = { label: string; value: string; strong?: boolean; color?: string };
type Row = CardRow;

export type OrderCard = {
  emoji: string;
  title: string;
  subtitle?: string;
  orderName: string;
  rows: Row[];
  /** Short lines under the rows — item names, usually. */
  items?: string[];
  button: { label: string; uri: string };
  /** A second, quieter button — "ติดตามพัสดุ" beside "ดูคำสั่งซื้อ". */
  secondaryButton?: { label: string; uri: string };
  /**
   * Where tapping the card itself goes — the order it is about.
   *
   * People tap the notification, not the button in it: a card that only
   * responds to a small button at the bottom reads as a dead end, and the
   * whole point of the card is that the order is one tap away.
   */
  tapUri?: string;
};

function textRow(row: Row) {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: row.label, size: "sm", color: MUTED, flex: 4 },
      {
        type: "text",
        text: row.value,
        size: "sm",
        color: row.color ?? INK,
        weight: row.strong ? "bold" : "regular",
        flex: 6,
        align: "end",
        wrap: true,
      },
    ],
  };
}

function bubble(card: OrderCard) {
  const body: Record<string, unknown>[] = [
    {
      type: "box",
      layout: "vertical",
      spacing: "none",
      contents: [
        { type: "text", text: `${card.emoji} ${card.title}`, weight: "bold", size: "lg", color: INK, wrap: true },
        ...(card.subtitle ? [{ type: "text", text: card.subtitle, size: "xs", color: MUTED, wrap: true }] : []),
      ],
    },
    { type: "separator", margin: "lg", color: LINE_GREY },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: [textRow({ label: "คำสั่งซื้อ", value: card.orderName }), ...card.rows.map(textRow)],
    },
  ];

  if (card.items?.length) {
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "xs",
      contents: card.items.map((item) => ({ type: "text", text: item, size: "xs", color: MUTED, wrap: true })),
    });
  }

  const buttons: Record<string, unknown>[] = [
    {
      type: "button",
      style: "primary",
      height: "sm",
      color: GREEN,
      action: { type: "uri", label: card.button.label.slice(0, 20), uri: card.button.uri },
    },
  ];
  if (card.secondaryButton) {
    buttons.push({
      type: "button",
      style: "link",
      height: "sm",
      action: { type: "uri", label: card.secondaryButton.label.slice(0, 20), uri: card.secondaryButton.uri },
    });
  }

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: body,
      ...(card.tapUri ? { action: { type: "uri", label: card.title.slice(0, 20), uri: card.tapUri } } : {}),
    },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: buttons },
  };
}

/** The card as a LINE message. altText is what shows in the chat list and the push notification. */
export function orderCardMessage(card: OrderCard): LineMessage {
  return {
    type: "flex",
    altText: `${card.emoji} ${card.title} ${card.orderName}`,
    contents: bubble(card),
  };
}

export function baht(amount: number) {
  return `฿${Math.round(amount).toLocaleString("th-TH")}`;
}

/** "ชื่อสินค้า x2", at most three of them plus a count of the rest. */
export function itemLines(lineItems: { title?: string; name?: string; quantity?: number }[]): string[] {
  const shown = lineItems.slice(0, 3).map((li) => {
    const name = (li.title || li.name || "").trim() || "สินค้า";
    return `• ${name}${li.quantity && li.quantity > 1 ? ` x${li.quantity}` : ""}`;
  });
  if (lineItems.length > 3) shown.push(`• และอีก ${lineItems.length - 3} รายการ`);
  return shown;
}

/**
 * The order's own page, not the list.
 *
 * The numeric Shopify id is what /account/orders/[id] expects — the same value
 * the orders list links each row to — and dropping someone on a list to find
 * the order they were just told about is a step they should not have to take.
 */
export const orderLink = (orderId: string | number) => lineOpenLink(`/account/orders/${orderId}`);
export const ordersLink = () => lineOpenLink("/account/orders");
export const pointsLink = () => lineOpenLink("/account");
