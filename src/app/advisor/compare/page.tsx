import { products } from "@/data/products";
import { formatTHB } from "@/lib/format";
import StarRating from "@/components/StarRating";

export const metadata = { title: "Smart Compare | Smoothlife.com" };

export default function ComparePage() {
  const items = products.filter((p) => p.badges?.includes("Bestseller")).slice(0, 4);

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Smart Compare</h1>
      <p className="text-sm text-slate-500 mb-8">เปรียบเทียบสินค้าขายดีแบบเคียงข้างกันเพื่อการตัดสินใจที่ง่ายขึ้น</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-3 text-slate-400 font-medium">สินค้า</th>
              {items.map((p) => (
                <th key={p.slug} className="p-3 text-center font-semibold text-brand-ink min-w-[150px]">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="p-3 text-slate-400 font-medium">แบรนด์</td>
              {items.map((p) => (
                <td key={p.slug} className="p-3 text-center">{p.brand}</td>
              ))}
            </tr>
            <tr className="border-t border-slate-100 bg-surface-soft">
              <td className="p-3 text-slate-400 font-medium">ราคา</td>
              {items.map((p) => (
                <td key={p.slug} className="p-3 text-center font-bold text-brand-ink">{formatTHB(p.price)}</td>
              ))}
            </tr>
            <tr className="border-t border-slate-100">
              <td className="p-3 text-slate-400 font-medium">คะแนนรีวิว</td>
              {items.map((p) => (
                <td key={p.slug} className="p-3">
                  <div className="flex justify-center"><StarRating rating={p.rating} size={12} /></div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-100 bg-surface-soft">
              <td className="p-3 text-slate-400 font-medium">เหมาะสำหรับ</td>
              {items.map((p) => (
                <td key={p.slug} className="p-3 text-center text-xs">{p.whoFor}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
