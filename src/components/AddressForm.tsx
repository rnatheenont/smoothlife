"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertCircle, MapPin } from "lucide-react";
import { useLang } from "@/lib/lang-context";

export type ShippingAddress = {
  name: string;
  phone: string;
  line1: string;
  subdistrict: string;
  district: string;
  province: string;
  postcode: string;
  country: string;
  note: string;
};

export const emptyAddress: ShippingAddress = {
  name: "",
  phone: "",
  line1: "",
  subdistrict: "",
  district: "",
  province: "",
  postcode: "",
  country: "TH",
  note: "",
};

/* ---------- countries ---------- */

// Thailand first (it's the store's home market and the only country with
// automatic postcode -> province/district/subdistrict lookup). The rest
// cover the other markets Smoothlife ships to most often.
export const COUNTRIES: { code: string; th: string; en: string }[] = [
  { code: "TH", th: "ไทย", en: "Thailand" },
  { code: "LA", th: "ลาว", en: "Laos" },
  { code: "MM", th: "เมียนมา", en: "Myanmar" },
  { code: "KH", th: "กัมพูชา", en: "Cambodia" },
  { code: "VN", th: "เวียดนาม", en: "Vietnam" },
  { code: "MY", th: "มาเลเซีย", en: "Malaysia" },
  { code: "SG", th: "สิงคโปร์", en: "Singapore" },
  { code: "CN", th: "จีน", en: "China" },
  { code: "US", th: "สหรัฐอเมริกา", en: "United States" },
  { code: "GB", th: "สหราชอาณาจักร", en: "United Kingdom" },
  { code: "AU", th: "ออสเตรเลีย", en: "Australia" },
  { code: "JP", th: "ญี่ปุ่น", en: "Japan" },
  { code: "KR", th: "เกาหลีใต้", en: "South Korea" },
  { code: "OTHER", th: "ประเทศอื่นๆ", en: "Other" },
];

export function countryName(code: string, lang: "th" | "en" = "th") {
  const c = COUNTRIES.find((c) => c.code === code);
  if (!c) return code;
  return lang === "en" ? c.en : c.th;
}

/* ---------- formatting + validation ---------- */

// 0812345678 -> 081-234-5678
export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export function validate(a: ShippingAddress) {
  const e: Partial<Record<keyof ShippingAddress, string>> = {};
  const digits = a.phone.replace(/\D/g, "");
  const isTH = a.country === "TH";

  if (a.name.trim().length < 2) e.name = "กรุณากรอกชื่อ-นามสกุลผู้รับ";
  if (digits.length !== 10) e.phone = "เบอร์มือถือต้องมี 10 หลัก";
  else if (!/^0[689]/.test(digits)) e.phone = "เบอร์มือถือต้องขึ้นต้นด้วย 06, 08 หรือ 09";
  if (a.line1.trim().length < 5) e.line1 = "กรุณากรอกบ้านเลขที่ ถนน/ซอย";
  if (!a.country) e.country = "กรุณาเลือกประเทศ";

  if (isTH) {
    if (!/^\d{5}$/.test(a.postcode)) e.postcode = "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก";
    if (!a.province.trim()) e.province = "กรุณาเลือกจังหวัด";
    if (!a.district.trim()) e.district = "กรุณาเลือกเขต/อำเภอ";
    if (!a.subdistrict.trim()) e.subdistrict = "กรุณาเลือกแขวง/ตำบล";
  } else {
    if (a.postcode.trim().length < 3) e.postcode = "กรุณากรอกรหัสไปรษณีย์ให้ถูกต้อง";
    if (!a.province.trim()) e.province = "กรุณากรอกจังหวัด/รัฐ";
    if (!a.district.trim()) e.district = "กรุณากรอกเมือง/อำเภอ";
  }

  return e;
}

export function formatAddress(a: ShippingAddress) {
  const isTH = a.country === "TH";
  return [
    a.name,
    a.line1,
    a.subdistrict && (isTH ? `แขวง/ตำบล${a.subdistrict}` : a.subdistrict),
    a.district && (isTH ? `เขต/อำเภอ${a.district}` : a.district),
    a.province,
    a.postcode,
    !isTH && countryName(a.country),
    a.note && `(${a.note})`,
  ]
    .filter(Boolean)
    .join(" ");
}

/* ---------- field shell ---------- */

function Field({
  label,
  error,
  touched,
  hint,
  children,
}: {
  label: string;
  error?: string;
  touched?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const show = touched && error;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-ink">{label}</span>
      {children}
      {show ? (
        <span className="mt-1 flex items-center gap-1 text-[11px] text-rose-500">
          <AlertCircle size={12} /> {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

const base =
  "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors bg-white";
function ring(bad?: boolean) {
  return bad
    ? `${base} border-rose-300 focus:border-rose-400`
    : `${base} border-slate-200 focus:border-brand-teal`;
}

/* ---------- form ---------- */

type Match = { province: string; district: string; subdistricts: string[] };

export default function AddressForm({
  value,
  onChange,
  errors,
  touched,
  onBlurField,
}: {
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
  errors: Partial<Record<keyof ShippingAddress, string>>;
  touched: Partial<Record<keyof ShippingAddress, boolean>>;
  onBlurField: (field: keyof ShippingAddress) => void;
}) {
  const { t, lang } = useLang();
  const [matches, setMatches] = useState<Match[]>([]);
  const [looking, setLooking] = useState(false);
  const [lookupOn, setLookupOn] = useState(true);
  const lastCode = useRef("");
  const isTH = value.country === "TH" || !value.country;

  const set = (patch: Partial<ShippingAddress>) => onChange({ ...value, ...patch });

  // postcode -> province / district / subdistrict (Thailand only — that's
  // the only market we have a postcode database for)
  useEffect(() => {
    const code = value.postcode;
    if (!isTH || !/^\d{5}$/.test(code) || code === lastCode.current) return;
    lastCode.current = code;
    let cancelled = false;
    setLooking(true);

    fetch(`/api/postcode?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLookupOn(data.available !== false);
        const found: Match[] = data.matches || [];
        setMatches(found);
        if (found.length === 1) {
          const only = found[0];
          set({
            province: only.province,
            district: only.district,
            subdistrict: only.subdistricts.length === 1 ? only.subdistricts[0] : "",
          });
        } else if (found.length > 1) {
          const provinces = new Set(found.map((f) => f.province));
          if (provinces.size === 1) set({ province: found[0].province, district: "", subdistrict: "" });
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLooking(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.postcode]);

  const districts = matches.map((m) => m.district);
  const activeMatch = matches.find((m) => m.district === value.district);
  const subs = activeMatch ? activeMatch.subdistricts : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label={t("ประเทศ", "Country")} error={errors.country} touched={touched.country}>
          <select
            className={ring(touched.country && !!errors.country)}
            value={value.country || "TH"}
            onChange={(e) => {
              const country = e.target.value;
              // Switching away from Thailand: TH-only autofill data no
              // longer applies, so clear it instead of leaving stale values.
              if (country !== "TH") {
                set({ country, province: "", district: "", subdistrict: "" });
                setMatches([]);
              } else {
                set({ country });
              }
            }}
            onBlur={() => onBlurField("country")}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {lang === "en" ? c.en : c.th}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label={t("ชื่อ-นามสกุลผู้รับ", "Recipient name")} error={errors.name} touched={touched.name}>
          <input
            className={ring(touched.name && !!errors.name)}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={() => onBlurField("name")}
            autoComplete="name"
            placeholder="สมชาย ใจดี"
          />
        </Field>
      </div>

      <Field
        label={t("เบอร์มือถือ", "Mobile number")}
        error={errors.phone}
        touched={touched.phone}
        hint={t("ใช้แจ้งสถานะพัสดุ", "Used for delivery updates")}
      >
        <input
          className={ring(touched.phone && !!errors.phone)}
          value={value.phone}
          onChange={(e) => set({ phone: formatPhone(e.target.value) })}
          onBlur={() => onBlurField("phone")}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="081-234-5678"
        />
      </Field>

      <Field
        label={t("รหัสไปรษณีย์", "Postcode")}
        error={errors.postcode}
        touched={touched.postcode}
        hint={
          isTH && lookupOn
            ? t("กรอกแล้วระบบเติมจังหวัด/เขตให้อัตโนมัติ", "We fill in province and district for you")
            : undefined
        }
      >
        <div className="relative">
          <input
            className={ring(touched.postcode && !!errors.postcode)}
            value={value.postcode}
            onChange={(e) =>
              set({
                postcode: isTH
                  ? e.target.value.replace(/\D/g, "").slice(0, 5)
                  : e.target.value.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 10),
              })
            }
            onBlur={() => onBlurField("postcode")}
            inputMode={isTH ? "numeric" : "text"}
            autoComplete="postal-code"
            placeholder={isTH ? "10110" : t("รหัสไปรษณีย์", "Postal code")}
          />
          {isTH && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
              {looking ? (
                <Loader2 size={15} className="animate-spin" />
              ) : matches.length > 0 ? (
                <Check size={15} className="text-brand-emerald" />
              ) : (
                <MapPin size={15} />
              )}
            </span>
          )}
        </div>
      </Field>

      <div className="sm:col-span-2">
        <Field
          label={t("บ้านเลขที่ ถนน ซอย อาคาร", "Address line")}
          error={errors.line1}
          touched={touched.line1}
        >
          <input
            className={ring(touched.line1 && !!errors.line1)}
            value={value.line1}
            onChange={(e) => set({ line1: e.target.value })}
            onBlur={() => onBlurField("line1")}
            autoComplete="address-line1"
            placeholder="123/45 ถนนสุขุมวิท ซอย 21 อาคารเอ ชั้น 8"
          />
        </Field>
      </div>

      <Field
        label={isTH ? t("จังหวัด", "Province") : t("จังหวัด / รัฐ", "State / Province")}
        error={errors.province}
        touched={touched.province}
      >
        <input
          className={ring(touched.province && !!errors.province)}
          value={value.province}
          onChange={(e) => set({ province: e.target.value })}
          onBlur={() => onBlurField("province")}
          autoComplete="address-level1"
          placeholder={isTH ? "กรุงเทพมหานคร" : t("เช่น กรุงเทพมหานคร", "e.g. California")}
          readOnly={isTH && matches.length > 0 && new Set(matches.map((m) => m.province)).size === 1}
        />
      </Field>

      <Field
        label={isTH ? t("เขต / อำเภอ", "District") : t("เมือง / อำเภอ", "City / District")}
        error={errors.district}
        touched={touched.district}
      >
        {isTH && districts.length > 1 ? (
          <select
            className={ring(touched.district && !!errors.district)}
            value={value.district}
            onChange={(e) => set({ district: e.target.value, subdistrict: "" })}
            onBlur={() => onBlurField("district")}
          >
            <option value="">{t("เลือกเขต/อำเภอ", "Select district")}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={ring(touched.district && !!errors.district)}
            value={value.district}
            onChange={(e) => set({ district: e.target.value })}
            onBlur={() => onBlurField("district")}
            autoComplete="address-level2"
            placeholder={isTH ? "วัฒนา" : t("เช่น เมืองที่อยู่", "e.g. Los Angeles")}
            readOnly={isTH && districts.length === 1}
          />
        )}
      </Field>

      <div className="sm:col-span-2">
        <Field
          label={
            isTH
              ? t("แขวง / ตำบล", "Subdistrict")
              : t("แขวง / ตำบล (ถ้ามี)", "Subdistrict / Area (optional)")
          }
          error={errors.subdistrict}
          touched={touched.subdistrict}
        >
          {isTH && subs.length > 1 ? (
            <select
              className={ring(touched.subdistrict && !!errors.subdistrict)}
              value={value.subdistrict}
              onChange={(e) => set({ subdistrict: e.target.value })}
              onBlur={() => onBlurField("subdistrict")}
            >
              <option value="">{t("เลือกแขวง/ตำบล", "Select subdistrict")}</option>
              {subs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={ring(touched.subdistrict && !!errors.subdistrict)}
              value={value.subdistrict}
              onChange={(e) => set({ subdistrict: e.target.value })}
              onBlur={() => onBlurField("subdistrict")}
              placeholder={isTH ? "คลองเตยเหนือ" : t("เช่น ย่านที่อยู่", "e.g. Downtown")}
              readOnly={isTH && subs.length === 1}
            />
          )}
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label={t("หมายเหตุถึงพนักงานส่ง (ไม่บังคับ)", "Note for the courier (optional)")}>
          <input
            className={ring(false)}
            value={value.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder={t("เช่น ฝากไว้ที่นิติบุคคล", "e.g. leave with reception")}
          />
        </Field>
      </div>
    </div>
  );
}
