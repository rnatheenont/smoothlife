import { postcodeIndex } from "@/data/postcodes.generated";

// Turning a Shopify address into one our address book can hold.
//
// The two do not line up. Shopify keeps a free-text address1/address2, a city
// and a province in whatever language the customer typed — "Bangkok", not
// "กรุงเทพมหานคร" — while our form wants แขวง/เขต/จังหวัด as separate fields
// that must match the Thai postcode index, because that is what the couriers
// and the checkout validate against.
//
// So the postcode does the work: five digits identify the province and a small
// set of districts, the Shopify city picks the district out of that set, and
// the subdistrict is found by looking for one of that district's แขวง inside
// the address text. Anything not resolved is left empty for the customer to
// fill rather than guessed — a wrong แขวง is a parcel to the wrong side of
// Bangkok, and this is only ever offered as a suggestion to confirm.

export type ShopifyAddressLike = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  countryCodeV2?: string | null;
  country?: string | null;
};

export type AddressDraft = {
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  /** Fields we could not resolve — the UI says so instead of pretending. */
  missing: string[];
};

/** Rows are "10600|กรุงเทพมหานคร|เขตธนบุรี|วัดกัลยาณ์,ตลาดพลู,..." */
function rowsForPostcode(zip: string) {
  const prefix = `${zip}|`;
  return postcodeIndex
    .filter((row) => row.startsWith(prefix))
    .map((row) => {
      const [, province, district, subs] = row.split("|");
      return { province, district, subdistricts: (subs || "").split(",").filter(Boolean) };
    });
}

/** Compares Thai place names ignoring the เขต/อำเภอ/แขวง/ตำบล prefix. */
function bare(name: string) {
  return name.replace(/^(เขต|อำเภอ|อ\.|แขวง|ตำบล|ต\.)\s*/, "").trim();
}

export function thaiAddressFromShopify(addr: ShopifyAddressLike | null | undefined): AddressDraft | null {
  if (!addr) return null;
  const country = (addr.countryCodeV2 || (addr.country === "Thailand" ? "TH" : "") || "TH").toUpperCase();
  const zip = (addr.zip || "").trim();
  const line1 = (addr.address1 || "").trim();
  const line2 = (addr.address2 || "").trim();
  if (!line1 && !line2) return null;

  const name = (addr.name || [addr.firstName, addr.lastName].filter(Boolean).join(" ")).trim();
  const draft: AddressDraft = {
    recipient_name: name,
    phone: (addr.phone || "").replace(/^\+66/, "0").replace(/[^\d]/g, ""),
    address_line: [line1, line2].filter(Boolean).join(" "),
    subdistrict: "",
    district: "",
    province: "",
    postal_code: /^\d{5}$/.test(zip) ? zip : "",
    country,
    missing: [],
  };

  if (country === "TH" && draft.postal_code) {
    const rows = rowsForPostcode(draft.postal_code);
    const cityBare = bare((addr.city || "").trim());
    // One postcode can cover several districts; the Shopify city names which.
    // With no city to go on, a single-district postcode still answers it.
    const row =
      rows.find((r) => cityBare && bare(r.district) === cityBare) ??
      rows.find((r) => cityBare && (r.district.includes(cityBare) || cityBare.includes(bare(r.district)))) ??
      (rows.length === 1 ? rows[0] : null);

    if (row) {
      draft.province = row.province;
      draft.district = row.district;
      // The แขวง is usually written inside address2 ("... แขวงตลาดพลู"), so it
      // is looked for by name among the ones this district actually has —
      // matching against real options rather than parsing free text.
      const haystack = `${line1} ${line2}`;
      const found = row.subdistricts.find((s) => haystack.includes(s));
      if (found) {
        draft.subdistrict = found;
        // Taken out of the street line so it is not written twice.
        draft.address_line = draft.address_line
          .replace(new RegExp(`(แขวง|ตำบล|ต\\.)?\\s*${found}`, "g"), "")
          .replace(/\s{2,}/g, " ")
          .trim();
      }
    }
  }

  if (!draft.recipient_name) draft.missing.push("ชื่อผู้รับ");
  if (!draft.phone) draft.missing.push("เบอร์โทร");
  if (!draft.subdistrict) draft.missing.push("แขวง/ตำบล");
  if (!draft.district) draft.missing.push("เขต/อำเภอ");
  if (!draft.province) draft.missing.push("จังหวัด");
  if (!draft.postal_code) draft.missing.push("รหัสไปรษณีย์");

  return draft;
}
