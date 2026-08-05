import { MapPin, Phone, Clock } from "lucide-react";
import { stores } from "@/data/stores";

export const metadata = { title: "สาขาและติดต่อเรา | Smoothlife.com" };

export default function StoresPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">สาขาและติดต่อเรา</h1>
      <p className="text-sm text-slate-500 mb-8">พบกับเราได้ที่สาขาทั่วประเทศ หรือติดต่อทีมงานผ่านช่องทางออนไลน์</p>

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        {stores.map((s) => (
          <div key={s.name} className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            <h3 className="font-bold text-brand-ink mb-2">{s.name}</h3>
            <div className="flex items-start gap-2 text-sm text-slate-600 mb-1.5">
              <MapPin size={15} className="mt-0.5 shrink-0 text-brand-emerald" /> {s.address}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-1.5">
              <Clock size={15} className="shrink-0 text-brand-emerald" /> {s.hours}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone size={15} className="shrink-0 text-brand-emerald" /> {s.phone}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl2 bg-surface-soft p-6">
        <h2 className="font-bold text-brand-ink mb-3">ติดต่อฝ่ายบริการลูกค้า</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-slate-600">
          <div>
            <p className="font-semibold text-brand-ink">โทรศัพท์</p>
            <p>02-000-0000 (ทุกวัน 9:00-20:00)</p>
          </div>
          <div>
            <p className="font-semibold text-brand-ink">อีเมล</p>
            <p>support@smoothlife.com</p>
          </div>
          <div>
            <p className="font-semibold text-brand-ink">LINE Official</p>
            <p>@smoothlifeofficial</p>
          </div>
        </div>
      </div>
    </div>
  );
}
