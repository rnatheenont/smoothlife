"use client";

import { COUNTRIES } from "@/components/AddressForm";
import ThaiAddressCascade from "@/components/account/ThaiAddressCascade";
import { sanitiseThaiPhoneInput, isValidPhoneForCountry, THAI_PHONE_HINT } from "@/lib/phone";

export type AddressFormValue = {
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

export const emptyAddressForm: AddressFormValue = {
  label: "บ้าน",
  recipient_name: "",
  phone: "",
  address_line: "",
  subdistrict: "",
  district: "",
  province: "",
  postal_code: "",
  country: "TH",
  is_default: false,
};

const inputClass =
  "w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal";
const labelClass = "text-xs font-semibold text-slate-500 mb-1.5 block";

export default function AddressFields({
  value,
  onChange,
  showDefaultToggle = true,
}: {
  value: AddressFormValue;
  onChange: (v: AddressFormValue) => void;
  showDefaultToggle?: boolean;
}) {
  function set<K extends keyof AddressFormValue>(key: K, v: AddressFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  const isTH = !value.country || value.country === "TH";
  // Only nag once there is something to be wrong about — an empty field is the
  // `required` attribute's job, not an error message's.
  const phoneInvalid = value.phone.trim().length > 0 && !isValidPhoneForCountry(value.phone, value.country);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass}>ชื่อที่อยู่ (เช่น บ้าน, ที่ทำงาน)</label>
        <input value={value.label} onChange={(e) => set("label", e.target.value)} placeholder="บ้าน" className={inputClass} />
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
        <label className={labelClass}>ชื่อ-นามสกุล</label>
        <input
          required
          value={value.recipient_name}
          onChange={(e) => set("recipient_name", e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>โทรศัพท์</label>
        <input
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value.phone}
          // Filter on the way in rather than only complaining afterwards, so a
          // pasted "081-234-5678" or "+66 81 234 5678" just works.
          onChange={(e) => set("phone", isTH ? sanitiseThaiPhoneInput(e.target.value) : e.target.value)}
          placeholder={isTH ? "0891234567" : "เบอร์ติดต่อ"}
          aria-invalid={phoneInvalid || undefined}
          className={`${inputClass} ${phoneInvalid ? "border-rose-300 focus:border-rose-400" : ""}`}
        />
        {phoneInvalid ? (
          <p className="mt-1 text-[11px] text-rose-500">{THAI_PHONE_HINT}</p>
        ) : isTH ? (
          <p className="mt-1 text-[11px] text-slate-400">กรอกเฉพาะตัวเลข ไม่ต้องใส่ขีดหรือเว้นวรรค</p>
        ) : null}
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
          <span className="text-sm text-slate-600">ตั้งเป็นค่าเริ่มต้น จัดส่ง ที่อยู่</span>
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
