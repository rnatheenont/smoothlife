import { BadgeCheck, FlaskConical, PackageCheck, Truck } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "คุณภาพและมาตรฐาน | Smoothlife.com" };

export default function QualityPage() {
  return (
    <ContentPage
      eyebrow="Quality and Product Standards"
      title="คุณภาพและมาตรฐานของเรา"
      intro="ทุกผลิตภัณฑ์ที่จำหน่ายบน Smooth Life ผ่านกระบวนการตรวจสอบคุณภาพอย่างเข้มงวด ตั้งแต่แหล่งผลิตจนถึงมือคุณ"
      sections={[
        { icon: BadgeCheck, title: "ได้รับการรับรองจาก อย.", body: "ผลิตภัณฑ์ทุกชิ้นผ่านการขึ้นทะเบียนกับสำนักงานคณะกรรมการอาหารและยา" },
        { icon: FlaskConical, title: "ตรวจสอบจากห้องปฏิบัติการ", body: "สินค้าคัดสรรผ่านการทดสอบความปลอดภัยและประสิทธิภาพก่อนวางจำหน่าย" },
        { icon: PackageCheck, title: "นำเข้าและจัดจำหน่ายโดยตรง", body: "ไม่ผ่านพ่อค้าคนกลาง ลดความเสี่ยงสินค้าปลอมหรือหมดอายุ" },
        { icon: Truck, title: "ควบคุมอุณหภูมิการจัดเก็บ", body: "คลังสินค้าและการขนส่งได้มาตรฐานเพื่อรักษาคุณภาพผลิตภัณฑ์" },
      ]}
    />
  );
}
