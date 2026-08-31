import Link from "next/link";
import { tierDisplayName, tierCard } from "@/lib/tier";
import { TIER_CRITERIA } from "@/lib/loyalty-shared";

export const metadata = { title: "สิทธิสมาชิก | Smoothlife.com" };

// Real perks only — every row here is something the system actually grants
// today, not the full aspirational tier-benefits table from the loyalty
// plan doc (early access windows, member pricing, gift wrapping, partner
// discounts, event invites, priority shipping, etc. were never built this
// pass). Most rows are identical across tiers because most perks that were
// built don't differ by tier yet — the birthday bonus is the one that does.
const rows: { label: string; values: [string, string, string] }[] = [
  { label: "อัตราแต้มสะสม", values: ["1 แต้ม / ฿1", "1 แต้ม / ฿1", "1 แต้ม / ฿1"] },
  { label: "แต้มจากรีวิวสินค้า", values: ["+5 ถึง +30 แต้ม", "+5 ถึง +30 แต้ม", "+5 ถึง +30 แต้ม"] },
  { label: "คูปองแนะนำเพื่อน", values: ["฿100 / เพื่อน 1 คน", "฿100 / เพื่อน 1 คน", "฿100 / เพื่อน 1 คน"] },
  { label: "โบนัสวันเกิด", values: ["+100 แต้ม", "+200 แต้ม + ลด 10%", "+300 แต้ม + ลด 20%"] },
  { label: "อายุแต้มสะสม", values: ["12 เดือน/ก้อน", "12 เดือน/ก้อน", "12 เดือน/ก้อน"] },
];

function entryLabel(min: number) {
  return min === 0 ? "สมัครวันนี้" : `฿${min.toLocaleString()}+ / 12 ด.`;
}

export default function LoyaltyPage() {
  const tiers = TIER_CRITERIA; // [Bronze, Silver, Gold] — display names via tierDisplayName

  return (
    <div className="container-page py-4 md:py-8 flex flex-col md:min-h-[calc(100vh-260px)] md:justify-center">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-lg md:text-2xl font-bold text-brand-ink">สิทธิสมาชิกแต่ละระดับ</h1>
        <Link href="/account" className="shrink-0 text-xs font-semibold text-brand-emerald whitespace-nowrap">
          ไปที่บัญชี →
        </Link>
      </div>
      <p className="text-xs text-slate-400 mb-3">คำนวณจากยอดใช้จ่ายสะสม 12 เดือน (หรือจำนวนออเดอร์) อัปเดตอัตโนมัติทุกวัน</p>

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[520px] border-collapse text-xs md:text-sm">
          <thead>
            <tr>
              <th className="w-[32%]" />
              {tiers.map((t) => (
                <th key={t.name} className="text-center pb-2.5 px-1.5">
                  <div
                    className="rounded-xl px-2 py-2 text-white"
                    style={{ background: tierCard[t.name].gradient }}
                  >
                    <p className="text-sm md:text-base font-extrabold leading-tight">{tierDisplayName[t.name].th}</p>
                    <p className="text-[10px] text-white/80 mt-0.5">{entryLabel(t.minSpend)}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i < rows.length - 1 ? "border-b border-slate-100" : ""}>
                <td className="py-2 md:py-2.5 pr-2 text-slate-600">{row.label}</td>
                {row.values.map((v, j) => (
                  <td key={j} className="py-2 md:py-2.5 px-1.5 text-center text-brand-ink font-medium">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 mt-2.5">
        สิทธิ์บางอย่างต้องมีประวัติสั่งซื้อสินค้าจริงก่อนจึงจะได้รับ (เช่น โบนัสวันเกิด)
      </p>
    </div>
  );
}
