// Where a staff order goes: posted to the employee's own address, or kept
// for them to collect.
//
// Here rather than beside the checkout because four places have to agree
// about it — the shop's chooser, the checkout that validates it, the
// Shopify order the warehouse packs from, and the console and CSV that say
// where each parcel went. Four copies of "ตลิ่งชัน" is four chances for a
// box to be sent to the wrong one of them.
//
// Deliberately free of any database import, like @/lib/staff-sale: /staff is
// a client component, and a type reached from a module that touches
// supabase-server is one `import type` away from the service-role path in a
// browser bundle.

export type StaffFulfilmentMethod = "ship" | "pickup_warehouse" | "pickup_office";

/** The choice as it is stored, and as the console reads it back. */
export type StaffFulfilment = {
  method: StaffFulfilmentMethod;
  /** The nickname the shelf is labelled with. Collection only. */
  pickup_name: string | null;
  /** Which floor to bring it to. The office only. */
  pickup_floor: string | null;
};

export const DEFAULT_FULFILMENT: StaffFulfilment = {
  method: "ship",
  pickup_name: null,
  pickup_floor: null,
};

/** An address in the shape both 2C2P and createPaidShopifyOrder want. */
export type FulfilmentAddress = {
  firstName?: string;
  lastName?: string;
  address1: string;
  city: string;
  province?: string;
  zip: string;
  countryCode: string;
  phone?: string;
};

export type FulfilmentOption = {
  method: StaffFulfilmentMethod;
  /** On the radio. */
  label: string;
  /** Under it: where the parcel ends up, in one line. */
  where: string;
  /** The small print — opening hours, which building. */
  detail: string;
  /** True: ask for a nickname, because the shelf is labelled by hand. */
  needsName: boolean;
  /** True: ask which floor as well. */
  needsFloor: boolean;
  /** Null for "ship": the address is the employee's own. */
  address: FulfilmentAddress | null;
};

// The two collection points, with the addresses the warehouse and the
// courier actually read.
//
// The warehouse is the company's own Shopify location — the same address
// stock is counted at, so a collected order is a parcel that never leaves
// the building it was picked in.
//
// SMOOTH LIFE TOWER is the head office. TOP: please confirm the house
// number and the postcode here before the next round opens — the rest of
// the repo only ever names the road.
export const PICKUP_POINTS: Record<"pickup_warehouse" | "pickup_office", FulfilmentAddress> = {
  pickup_warehouse: {
    address1: "เลขที่ 15/1-15 หมู่ 9 ถนนบรมราชชนนี แขวงตลิ่งชัน",
    city: "เขตตลิ่งชัน",
    province: "Bangkok",
    zip: "10170",
    countryCode: "TH",
  },
  pickup_office: {
    address1: "SMOOTH LIFE TOWER ถนนสาทรเหนือ แขวงสีลม",
    city: "เขตบางรัก",
    province: "Bangkok",
    zip: "10500",
    countryCode: "TH",
  },
};

export const FULFILMENT_OPTIONS: FulfilmentOption[] = [
  {
    method: "ship",
    label: "ส่งไปที่บ้าน",
    where: "ตามที่อยู่ในโปรไฟล์",
    detail: "ส่งตามรอบปกติ ใช้เวลา 2–4 วันทำการ",
    needsName: false,
    needsFloor: false,
    address: null,
  },
  {
    method: "pickup_warehouse",
    label: "รับเองที่คลังตลิ่งชัน",
    where: "คลังออนไลน์ ชั้น 3 · ถนนบรมราชชนนี",
    detail: "รับได้หลังชำระเงิน 1 วันทำการ · จ.–ศ. 09:00–17:00",
    needsName: true,
    needsFloor: false,
    address: PICKUP_POINTS.pickup_warehouse,
  },
  {
    method: "pickup_office",
    label: "รับเองที่สาทร",
    where: "SMOOTH LIFE TOWER · ถนนสาทรเหนือ",
    detail: "รับได้หลังชำระเงิน 1 วันทำการ · จ.–ศ. 09:00–18:00",
    needsName: true,
    needsFloor: true,
    address: PICKUP_POINTS.pickup_office,
  },
];

export function fulfilmentOption(method: StaffFulfilmentMethod): FulfilmentOption {
  return FULFILMENT_OPTIONS.find((o) => o.method === method) ?? FULFILMENT_OPTIONS[0];
}

export function isPickup(method: StaffFulfilmentMethod): method is "pickup_warehouse" | "pickup_office" {
  return method !== "ship";
}

/** Longest a nickname or a floor may be — a label on a box, not a note. */
const NAME_MAX = 40;
const FLOOR_MAX = 20;

/**
 * The chooser's value as it arrives from the browser, checked rather than
 * trusted.
 *
 * Returns the Thai the shop shows, not a code: the one caller is an API
 * route whose answer goes straight into the error line under the button.
 */
export function parseStaffFulfilment(
  body: unknown,
): { value: StaffFulfilment } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  // Nothing chosen is the old behaviour, which is also the default on the
  // page: post it. A round of orders placed before this shipped has to keep
  // meaning what it meant.
  const raw = b.fulfilment;
  if (raw == null || raw === "") return { value: DEFAULT_FULFILMENT };

  const method = FULFILMENT_OPTIONS.find((o) => o.method === raw)?.method;
  if (!method) return { error: "วิธีรับสินค้าไม่ถูกต้อง" };

  const option = fulfilmentOption(method);
  if (!option.needsName) return { value: DEFAULT_FULFILMENT };

  const name = typeof b.pickup_name === "string" ? b.pickup_name.trim() : "";
  if (!name) return { error: "กรุณาระบุชื่อเล่นสำหรับติดกล่อง" };
  if (name.length > NAME_MAX) return { error: `ชื่อเล่นยาวเกิน ${NAME_MAX} ตัวอักษร` };

  let floor: string | null = null;
  if (option.needsFloor) {
    const typed = typeof b.pickup_floor === "string" ? b.pickup_floor.trim() : "";
    if (!typed) return { error: "กรุณาระบุชั้นที่รับของ" };
    if (typed.length > FLOOR_MAX) return { error: `ชั้นยาวเกิน ${FLOOR_MAX} ตัวอักษร` };
    floor = typed;
  }

  return { value: { method, pickup_name: name, pickup_floor: floor } };
}

/**
 * One line saying where this order goes, for the console, the CSV and the
 * Shopify note.
 *
 * `shipTo` is the employee's own address summary, which only the posting
 * case has any use for.
 */
export function fulfilmentSummary(f: StaffFulfilment | null | undefined, shipTo?: string | null): string {
  const method = f?.method ?? "ship";
  if (!isPickup(method)) return shipTo ? `ส่งไปที่ ${shipTo}` : "ส่งตามที่อยู่ในโปรไฟล์";
  const option = fulfilmentOption(method);
  const parts = [option.label];
  if (f?.pickup_name) parts.push(`ชื่อ ${f.pickup_name}`);
  if (f?.pickup_floor) parts.push(`ชั้น ${f.pickup_floor}`);
  return parts.join(" · ");
}

/**
 * The address the parcel is labelled with.
 *
 * For a collection that is the collection point, with the nickname and the
 * floor written into the street lines — the warehouse packs from the
 * picking slip, and a slip that says only "ตลิ่งชัน" is a box nobody can
 * hand to the right person.
 */
export function fulfilmentAddress(
  f: StaffFulfilment | null | undefined,
  own: FulfilmentAddress,
): FulfilmentAddress {
  const method = f?.method ?? "ship";
  if (!isPickup(method)) return own;

  const point = PICKUP_POINTS[method];
  const tag = [
    "รับเอง",
    f?.pickup_name ? `(${f.pickup_name})` : null,
    f?.pickup_floor ? `ชั้น ${f.pickup_floor}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    // The person stays the person: a collection is still handed to somebody,
    // and the phone is how the warehouse says it is ready.
    firstName: own.firstName,
    lastName: own.lastName,
    phone: own.phone,
    ...point,
    address1: `${tag} · ${point.address1}`,
  };
}

/** The Shopify tag the warehouse filters its picking list by. */
export function fulfilmentTag(method: StaffFulfilmentMethod): string | null {
  return isPickup(method) ? `staff-pickup:${method === "pickup_warehouse" ? "talingchan" : "sathorn"}` : null;
}
