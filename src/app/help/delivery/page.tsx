import { Truck, RotateCcw, PackageSearch, Clock } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "การจัดส่งและคืนสินค้า | Smoothlife.com" };

export default function DeliveryPage() {
  return (
    <ContentPage
      eyebrow="Delivery and Returns"
      title="การจัดส่งและคืนสินค้า"
      intro="เราจัดส่งสินค้าอย่างรวดเร็วและปลอดภัยทั่วประเทศไทย พร้อมนโยบายคืนสินค้าที่เป็นธรรม"
      sections={[
        { icon: Truck, title: "ส่งฟรีทั่วไทย ทุกออเดอร์", body: "จัดส่งฟรีทุกคำสั่งซื้อ ไม่มียอดขั้นต่ำ ทั่วประเทศ" },
        { icon: Clock, title: "จัดส่งภายใน 1-3 วันทำการ", body: "พื้นที่กรุงเทพฯ และปริมณฑลอาจได้รับสินค้าเร็วกว่ากำหนด" },
        { icon: PackageSearch, title: "ติดตามพัสดุได้แบบเรียลไทม์", body: "ดูสถานะคำสั่งซื้อได้ที่หน้าบัญชีของฉัน > คำสั่งซื้อและติดตามพัสดุ" },
        { icon: RotateCcw, title: "คืนสินค้าได้ภายใน 14 วัน", body: "หากสินค้าชำรุดหรือไม่ตรงตามที่สั่ง สามารถแจ้งคืนได้ภายใน 14 วันหลังได้รับสินค้า" },
      ]}
    />
  );
}
