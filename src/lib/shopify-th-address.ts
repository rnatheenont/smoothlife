// Making a Thai address from our address book survive Shopify's validation.
//
// orderCreate does not tell you when it doesn't: it returns no userErrors, hands
// back a created order, and that order simply has no shipping address on it —
// which is how #4292 reached the warehouse queue with nowhere to ship to. Running
// the same address through orderUpdate, which does report, named both reasons:
//
//   "Province is not a valid province in Thailand"  (shippingAddress → province)
//   "Enter a last name"                             (shippingAddress → lastName)
//
// So: provinceCode wants the ISO 3166-2 code ("TH-10"), not "กรุงเทพมหานคร", and
// the postal code cannot stand in for it — ปทุมธานี posts as 12xxx but is TH-13,
// and several others are off by one the same way. And a Thai address must carry a
// last name, which a recipient who typed a single word does not have to give.
//
// Anything that still cannot be resolved is left off the field rather than
// guessed; losing a phone number beats losing the address it was attached to.

/** Every Thai province, by its name in the address book, to its ISO 3166-2 code. */
const BY_THAI: Record<string, string> = {
  กรุงเทพมหานคร: "TH-10",
  สมุทรปราการ: "TH-11",
  นนทบุรี: "TH-12",
  ปทุมธานี: "TH-13",
  พระนครศรีอยุธยา: "TH-14",
  อ่างทอง: "TH-15",
  ลพบุรี: "TH-16",
  สิงห์บุรี: "TH-17",
  ชัยนาท: "TH-18",
  สระบุรี: "TH-19",
  ชลบุรี: "TH-20",
  ระยอง: "TH-21",
  จันทบุรี: "TH-22",
  ตราด: "TH-23",
  ฉะเชิงเทรา: "TH-24",
  ปราจีนบุรี: "TH-25",
  นครนายก: "TH-26",
  สระแก้ว: "TH-27",
  นครราชสีมา: "TH-30",
  บุรีรัมย์: "TH-31",
  สุรินทร์: "TH-32",
  ศรีสะเกษ: "TH-33",
  อุบลราชธานี: "TH-34",
  ยโสธร: "TH-35",
  ชัยภูมิ: "TH-36",
  อำนาจเจริญ: "TH-37",
  บึงกาฬ: "TH-38",
  หนองบัวลำภู: "TH-39",
  ขอนแก่น: "TH-40",
  อุดรธานี: "TH-41",
  เลย: "TH-42",
  หนองคาย: "TH-43",
  มหาสารคาม: "TH-44",
  ร้อยเอ็ด: "TH-45",
  กาฬสินธุ์: "TH-46",
  สกลนคร: "TH-47",
  นครพนม: "TH-48",
  มุกดาหาร: "TH-49",
  เชียงใหม่: "TH-50",
  ลำพูน: "TH-51",
  ลำปาง: "TH-52",
  อุตรดิตถ์: "TH-53",
  แพร่: "TH-54",
  น่าน: "TH-55",
  พะเยา: "TH-56",
  เชียงราย: "TH-57",
  แม่ฮ่องสอน: "TH-58",
  นครสวรรค์: "TH-60",
  อุทัยธานี: "TH-61",
  กำแพงเพชร: "TH-62",
  ตาก: "TH-63",
  สุโขทัย: "TH-64",
  พิษณุโลก: "TH-65",
  พิจิตร: "TH-66",
  เพชรบูรณ์: "TH-67",
  ราชบุรี: "TH-70",
  กาญจนบุรี: "TH-71",
  สุพรรณบุรี: "TH-72",
  นครปฐม: "TH-73",
  สมุทรสาคร: "TH-74",
  สมุทรสงคราม: "TH-75",
  เพชรบุรี: "TH-76",
  ประจวบคีรีขันธ์: "TH-77",
  นครศรีธรรมราช: "TH-80",
  กระบี่: "TH-81",
  พังงา: "TH-82",
  ภูเก็ต: "TH-83",
  สุราษฎร์ธานี: "TH-84",
  ระนอง: "TH-85",
  ชุมพร: "TH-86",
  สงขลา: "TH-90",
  สตูล: "TH-91",
  ตรัง: "TH-92",
  พัทลุง: "TH-93",
  ปัตตานี: "TH-94",
  ยะลา: "TH-95",
  นราธิวาส: "TH-96",
};

/** The English spellings Shopify itself shows, for addresses that came back from it. */
const BY_ENGLISH: Record<string, string> = {
  bangkok: "TH-10",
  "samut prakan": "TH-11",
  nonthaburi: "TH-12",
  "pathum thani": "TH-13",
  "phra nakhon si ayutthaya": "TH-14",
  "ang thong": "TH-15",
  "lop buri": "TH-16",
  lopburi: "TH-16",
  "sing buri": "TH-17",
  "chai nat": "TH-18",
  "sara buri": "TH-19",
  saraburi: "TH-19",
  "chon buri": "TH-20",
  chonburi: "TH-20",
  rayong: "TH-21",
  chanthaburi: "TH-22",
  trat: "TH-23",
  chachoengsao: "TH-24",
  "prachin buri": "TH-25",
  prachinburi: "TH-25",
  "nakhon nayok": "TH-26",
  "sa kaeo": "TH-27",
  "nakhon ratchasima": "TH-30",
  "buri ram": "TH-31",
  buriram: "TH-31",
  surin: "TH-32",
  "si sa ket": "TH-33",
  sisaket: "TH-33",
  "ubon ratchathani": "TH-34",
  yasothon: "TH-35",
  chaiyaphum: "TH-36",
  "amnat charoen": "TH-37",
  "bueng kan": "TH-38",
  "nong bua lam phu": "TH-39",
  "khon kaen": "TH-40",
  "udon thani": "TH-41",
  loei: "TH-42",
  "nong khai": "TH-43",
  "maha sarakham": "TH-44",
  "roi et": "TH-45",
  kalasin: "TH-46",
  "sakon nakhon": "TH-47",
  "nakhon phanom": "TH-48",
  mukdahan: "TH-49",
  "chiang mai": "TH-50",
  lamphun: "TH-51",
  lampang: "TH-52",
  uttaradit: "TH-53",
  phrae: "TH-54",
  nan: "TH-55",
  phayao: "TH-56",
  "chiang rai": "TH-57",
  "mae hong son": "TH-58",
  "nakhon sawan": "TH-60",
  "uthai thani": "TH-61",
  "kamphaeng phet": "TH-62",
  tak: "TH-63",
  sukhothai: "TH-64",
  phitsanulok: "TH-65",
  "phi chit": "TH-66",
  phichit: "TH-66",
  phetchabun: "TH-67",
  ratchaburi: "TH-70",
  kanchanaburi: "TH-71",
  "suphan buri": "TH-72",
  suphanburi: "TH-72",
  "nakhon pathom": "TH-73",
  "samut sakhon": "TH-74",
  "samut songkhram": "TH-75",
  phetchaburi: "TH-76",
  "prachuap khiri khan": "TH-77",
  "nakhon si thammarat": "TH-80",
  krabi: "TH-81",
  "phang nga": "TH-82",
  phuket: "TH-83",
  "surat thani": "TH-84",
  ranong: "TH-85",
  chumphon: "TH-86",
  songkhla: "TH-90",
  satun: "TH-91",
  trang: "TH-92",
  phatthalung: "TH-93",
  pattani: "TH-94",
  yala: "TH-95",
  narathiwat: "TH-96",
};

/**
 * The ISO 3166-2 code for a Thai province, or undefined when the name is not
 * one — in which case the caller leaves provinceCode off entirely. Accepts what
 * customers actually type: "จ.เชียงใหม่", "จังหวัดเชียงใหม่", "Chiang Mai",
 * and Bangkok's several names.
 */
export function thProvinceCode(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const raw = name.trim();
  if (/^TH-[0-9A-Z]{1,2}$/i.test(raw)) return raw.toUpperCase();

  const thai = raw.replace(/^(จังหวัด|จ\.)\s*/, "").trim();
  if (BY_THAI[thai]) return BY_THAI[thai];
  // Bangkok is written every one of these ways in a shipping form.
  if (/^(กทม\.?|กรุงเทพฯ?|กรุงเทพ|พระนคร)$/.test(thai)) return "TH-10";

  const english = raw.toLowerCase().replace(/\s+province$/, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  return BY_ENGLISH[english];
}

/**
 * A Thai mobile number as Shopify wants it (E.164). Returns undefined for
 * anything that isn't one, so a malformed phone costs the phone field rather
 * than the whole address.
 */
export function thPhoneE164(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+66\d{8,9}$/.test(digits)) return digits;
  if (/^66\d{8,9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{8,9}$/.test(digits)) return `+66${digits.slice(1)}`;
  return undefined;
}

/**
 * A recipient name as Shopify will accept it. A Thai address is rejected outright
 * without a last name — and rejected silently by orderCreate — so a single-word
 * name travels as the last name instead of being split into nothing. Shipping
 * labels print the same either way.
 */
export function shopifyRecipientName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): { firstName?: string; lastName?: string } {
  const first = firstName?.trim() || undefined;
  const last = lastName?.trim() || undefined;
  if (last) return { firstName: first, lastName: last };
  if (first) return { lastName: first };
  return {};
}

/** The same, for the one `recipient_name` field our address book actually stores. */
export function splitRecipientName(fullName: string): { firstName?: string; lastName?: string } {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return shopifyRecipientName(first, rest.join(" "));
}
