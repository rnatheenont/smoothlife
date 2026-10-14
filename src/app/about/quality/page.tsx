import { PAGES_WAVE1_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import { BadgeCheck, FlaskConical, PackageCheck, Truck } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "คุณภาพและมาตรฐาน | Smoothlife.com" };

function QualityPageWritten() {
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

/**
 * The page, from its document when wave 1 is on and from the markup above
 * when it is not.
 *
 * Both halves stay in the tree on purpose. The flag is the emergency switch:
 * turning it off puts this page back on the next request with no deploy and
 * nothing to roll back, and that is only true while the hand-written half is
 * still here. It goes when the wave has been live long enough to trust.
 */
export default function QualityPage() {
  if (PAGES_WAVE1_ENABLED) return <SystemPageBody pageKey="about-quality" />;
  return <QualityPageWritten />;
}
