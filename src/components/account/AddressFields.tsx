"use client";

import { COUNTRIES } from "@/components/AddressForm";
import { usePostcodeMatches } from "@/lib/postcode-lookup";

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
  const options = usePostcodeMatches(value.postal_code, value.country);
  const isTH = value.country === "TH";

  function set<K extends keyof AddressFormValue>(key: K, v: AddressFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function pickSubdistrict(key: string) {
    const opt = options.find((o) => `${o.subdistrict}|${o.district}|${o.province}` === key);
    if (!opt) return;
    onChange({ ...value, subdistrict: opt.subdistrict, district: opt.district, province: opt.province });
  }

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
          value={value.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="0891234567"
          className={inputClass}
        />
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
      <div>
        <label className={labelClass}>รหัสไปรษณีย์</label>
        <input
          required
          value={value.postal_code}
          onChange={(e) => set("postal_code", isTH ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value)}
          placeholder="10110"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>แขวง/ตำบล</label>
          {isTH && options.length > 0 ? (
            <select
              required
              value={`${value.subdistrict}|${value.district}|${value.province}`}
              onChange={(e) => pickSubdistrict(e.target.value)}
              className={inputClass}
            >
              <option value="||" disabled>
                เลือกแขวง/ตำบล
              </option>
              {options.map((o) => {
                const key = `${o.subdistrict}|${o.district}|${o.province}`;
                const needsContext = options.some((x) => x.subdistrict === o.subdistrict && x !== o);
                return (
                  <option key={key} value={key}>
                    {o.subdistrict}
                    {needsContext ? ` (${o.district}, ${o.province})` : ""}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              required
              value={value.subdistrict}
              onChange={(e) => set("subdistrict", e.target.value)}
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label className={labelClass}>เขต/อำเภอ</label>
          <input required value={value.district} onChange={(e) => set("district", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>จังหวัด</label>
          <input required value={value.province} onChange={(e) => set("province", e.target.value)} className={inputClass} />
        </div>
      </div>
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
