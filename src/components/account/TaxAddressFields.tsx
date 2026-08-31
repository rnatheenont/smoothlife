"use client";

import { COUNTRIES } from "@/components/AddressForm";
import ThaiAddressCascade from "@/components/account/ThaiAddressCascade";

export type TaxAddressFormValue = {
  label: string;
  is_company: boolean;
  recipient_name: string;
  tax_id: string;
  phone: string;
  email: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

export const emptyTaxAddressForm: TaxAddressFormValue = {
  label: "บ้าน",
  is_company: false,
  recipient_name: "",
  tax_id: "",
  phone: "",
  email: "",
  address_line: "",
  subdistrict: "",
  district: "",
  province: "",
  postal_code: "",
  country: "TH",
  is_default: false,
};

const inputClass =
  "w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-hidden focus:border-brand-teal";
const labelClass = "text-xs font-semibold text-slate-500 mb-1.5 block";

export default function TaxAddressFields({
  value,
  onChange,
  showDefaultToggle = true,
}: {
  value: TaxAddressFormValue;
  onChange: (v: TaxAddressFormValue) => void;
  showDefaultToggle?: boolean;
}) {
  function set<K extends keyof TaxAddressFormValue>(key: K, v: TaxAddressFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass}>ชื่อที่อยู่ (เช่น บ้าน, ที่ทำงาน)</label>
        <input value={value.label} onChange={(e) => set("label", e.target.value)} placeholder="บ้าน" className={inputClass} />
      </div>

      <label className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
        <div>
          <span className="text-sm text-slate-700 font-medium">ที่อยู่บริษัท</span>
          <p className="text-xs text-slate-400">เลือกหากเป็นที่อยู่บริษัท/ธุรกิจ</p>
        </div>
        <input
          type="checkbox"
          checked={value.is_company}
          onChange={(e) => set("is_company", e.target.checked)}
          className="h-5 w-9 accent-brand-emerald"
        />
      </label>

      <div>
        <label className={labelClass}>{value.is_company ? "ชื่อบริษัท" : "ชื่อ-นามสกุล"}</label>
        <input
          required
          value={value.recipient_name}
          onChange={(e) => set("recipient_name", e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>เลขประจำตัวผู้เสียภาษี</label>
        <input
          required
          value={value.tax_id}
          onChange={(e) => set("tax_id", e.target.value.replace(/\D/g, "").slice(0, 13))}
          placeholder="13 หลัก"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>โทรศัพท์</label>
        <input required value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0891234567" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>อีเมล</label>
        <input
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="email@example.com"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>ประเทศ</label>
        <select value={value.country} onChange={(e) => set("country", e.target.value)} className={inputClass}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.th}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>ที่อยู่บรรทัดที่ 1</label>
        <input
          required
          value={value.address_line}
          onChange={(e) => set("address_line", e.target.value)}
          className={inputClass}
        />
      </div>
      <ThaiAddressCascade value={value} onChange={(patch) => onChange({ ...value, ...patch })} />
      {showDefaultToggle && (
        <label className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-600">ตั้งเป็นค่าเริ่มต้น ใบกำกับภาษี ที่อยู่</span>
          <input
            type="checkbox"
            checked={value.is_default}
            onChange={(e) => set("is_default", e.target.checked)}
            className="h-5 w-9 accent-brand-emerald"
          />
        </label>
      )}
    </div>
  );
}
