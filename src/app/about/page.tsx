import Link from "next/link";
import { Heart, ShieldCheck, Users, Leaf } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "Why Smooth Life | Smoothlife.com" };

export default function AboutPage() {
  return (
    <>
      <ContentPage
        eyebrow="Brand Story"
        title="ทำไมต้อง Smooth Life"
        intro="Smooth Life คือศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงามอันดับต้นๆ ของไทย ก่อตั้งขึ้นด้วยความตั้งใจให้ทุกคนเข้าถึงผลิตภัณฑ์คุณภาพดี ของแท้ 100% ในราคาที่เข้าถึงได้ พร้อมคำปรึกษาจากผู้เชี่ยวชาญในทุกขั้นตอน"
        image="https://www.smoothlife.com/cdn/shop/files/434082539_932456655336906_65767955414828336_n.jpg?width=1200"
        sections={[
          { icon: Heart, title: "ใส่ใจทุกรายละเอียด", body: "คัดสรรผลิตภัณฑ์ที่ผ่านการรับรองมาตรฐานอย่างเข้มงวด เพื่อสุขภาพและความงามที่ยั่งยืน" },
          { icon: ShieldCheck, title: "ของแท้ 100% รับประกัน", body: "สินค้าทุกชิ้นนำเข้าและจัดจำหน่ายโดยตรง มีอย. รับรอง ตรวจสอบย้อนกลับได้" },
          { icon: Users, title: "ทีมผู้เชี่ยวชาญ", body: "ทีมเภสัชกรและผู้เชี่ยวชาญด้านผิวพร้อมให้คำปรึกษาฟรีทุกช่องทาง" },
          { icon: Leaf, title: "รับผิดชอบต่อสังคม", body: "ร่วมลดผลกระทบต่อสิ่งแวดล้อมผ่านบรรจุภัณฑ์ที่ยั่งยืนและกิจกรรมเพื่อสังคม" },
        ]}
      />
      <div className="container-page pb-14 flex flex-wrap gap-3">
        <Link href="/about/quality" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-brand-teal">คุณภาพและมาตรฐาน</Link>
        <Link href="/about/experts" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-brand-teal">ผู้เชี่ยวชาญและพาร์ทเนอร์</Link>
        <Link href="/about/sustainability" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-brand-teal">ความรับผิดชอบต่อสังคม</Link>
        <Link href="/stores" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-brand-teal">สาขาและติดต่อเรา</Link>
      </div>
    </>
  );
}
