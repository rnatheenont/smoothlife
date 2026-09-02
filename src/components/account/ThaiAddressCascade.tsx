"use client";

import { useEffect } from "react";
import { usePostcodeMatches, useThaiProvinces, useThaiDistricts, useThaiSubdistricts } from "@/lib/postcode-lookup";
import { isThaiPostcode, VALIDATION_HINTS } from "@/lib/form-validation";

export type ThaiAddressValue = {
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-teal disabled:bg-surface-soft disabled:text-slate-400";
const labelClass = "text-xs font-semibold text-slate-500 mb-1.5 block";

// Province → district → subdistrict, in that order, for anyone who knows
// where they live but not their own postcode off-hand. Typing the postcode
// directly still works too (below) — it just backfills province/district so
// this same cascade picks up from there, rather than being a separate path.
export default function ThaiAddressCascade({
  value,
  onChange,
}: {
  value: ThaiAddressValue;
  onChange: (patch: Partial<ThaiAddressValue>) => void;
}) {
  const isTH = value.country === "TH";
  // Half-typed postcodes are normal while typing, so only complain once the
  // field is as long as a Thai postcode can be and still doesn't look like one.
  const postcodeInvalid = isTH && value.postal_code.length === 5 && !isThaiPostcode(value.postal_code);
  const provinces = useThaiProvinces(value.country);
  const districts = useThaiDistricts(value.country, value.province);
  const subdistricts = useThaiSubdistricts(value.country, value.province, value.district);

  // A single postcode often covers several districts (sometimes even two
  // provinces, e.g. island districts sharing a mainland code) — auto-fill
  // whatever level is actually unambiguous and leave the rest for the
  // cascade dropdowns below, rather than refusing to help at all.
  const zipMatches = usePostcodeMatches(value.postal_code, value.country);
  useEffect(() => {
    if (!isTH || value.province || zipMatches.length === 0) return;
    const uniqueProvinces = new Set(zipMatches.map((m) => m.province));
    if (uniqueProvinces.size !== 1) return;
    const province = zipMatches[0].province;
    const districtsInProvince = new Set(zipMatches.filter((m) => m.province === province).map((m) => m.district));
    onChange({ province, district: districtsInProvince.size === 1 ? zipMatches[0].district : "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipMatches, isTH, value.province]);

  return (
    <>
      <div>
        <label className={labelClass}>รหัสไปรษณีย์</label>
        <input
          required
          value={value.postal_code}
          onChange={(e) => {
            const next = isTH ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value;
            // Clearing the postcode back to empty also clears whatever it
            // had filled in below — otherwise deleting it to retype leaves
            // a stale province/district/subdistrict that no longer matches.
            onChange(
              next === "" ? { postal_code: "", province: "", district: "", subdistrict: "" } : { postal_code: next }
            );
          }}
          placeholder="10110"
          inputMode={isTH ? "numeric" : undefined}
          autoComplete="postal-code"
          aria-invalid={postcodeInvalid || undefined}
          className={`${inputClass} ${postcodeInvalid ? "border-rose-300 focus:border-rose-400" : ""}`}
        />
        {postcodeInvalid ? (
          <p className="mt-1.5 text-[11px] text-rose-500">{VALIDATION_HINTS.postcode}</p>
        ) : isTH ? (
          <p className="mt-1.5 text-[11px] text-slate-400">
            ไม่ทราบรหัสไปรษณีย์ก็เลือกจังหวัดด้านล่างได้เลย ระบบจะเติมรหัสให้อัตโนมัติ
          </p>
        ) : null}
      </div>
      <div>
        <label className={labelClass}>จังหวัด</label>
        {isTH && provinces.length > 0 ? (
          <select
            required
            value={value.province}
            onChange={(e) => onChange({ province: e.target.value, district: "", subdistrict: "", postal_code: "" })}
            className={inputClass}
          >
            <option value="" disabled>
              เลือกจังหวัด
            </option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            value={value.province}
            onChange={(e) => onChange({ province: e.target.value })}
            className={inputClass}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>เขต/อำเภอ</label>
          {isTH && districts.length > 0 ? (
            <select
              required
              disabled={!value.province}
              value={value.district}
              onChange={(e) => onChange({ district: e.target.value, subdistrict: "", postal_code: "" })}
              className={inputClass}
            >
              <option value="" disabled>
                เลือกเขต/อำเภอ
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <input
              required
              value={value.district}
              onChange={(e) => onChange({ district: e.target.value })}
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label className={labelClass}>แขวง/ตำบล</label>
          {isTH && subdistricts.length > 0 ? (
            <select
              required
              disabled={!value.district}
              value={value.subdistrict}
              onChange={(e) => {
                const picked = subdistricts.find((s) => s.name === e.target.value);
                onChange({ subdistrict: e.target.value, postal_code: picked?.postal_code || value.postal_code });
              }}
              className={inputClass}
            >
              <option value="" disabled>
                เลือกแขวง/ตำบล
              </option>
              {subdistricts.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              required
              value={value.subdistrict}
              onChange={(e) => onChange({ subdistrict: e.target.value })}
              className={inputClass}
            />
          )}
        </div>
      </div>
    </>
  );
}
