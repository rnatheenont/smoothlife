import { Stethoscope, GraduationCap, HeartHandshake, Handshake } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "ผู้เชี่ยวชาญและพาร์ทเนอร์ | Smoothlife.com" };

export default function ExpertsPage() {
  return (
    <ContentPage
      eyebrow="Experts and Partners"
      title="ผู้เชี่ยวชาญและพาร์ทเนอร์ของเรา"
      intro="เราทำงานร่วมกับเภสัชกร แพทย์ผิวหนัง และแบรนด์พันธมิตรระดับโลก เพื่อมอบคำแนะนำและผลิตภัณฑ์ที่ดีที่สุดให้กับคุณ"
      sections={[
        { icon: Stethoscope, title: "ทีมเภสัชกรที่ปรึกษา", body: "พร้อมให้คำแนะนำเรื่องผลิตภัณฑ์และการใช้งานที่ถูกต้องปลอดภัย" },
        { icon: GraduationCap, title: "ที่ปรึกษาด้านผิวหนัง", body: "ร่วมพัฒนาเนื้อหาความรู้และตรวจสอบความถูกต้องของข้อมูลผลิตภัณฑ์" },
        { icon: HeartHandshake, title: "พันธมิตรแบรนด์ระดับโลก", body: "Smooth E, CeraVe, Bioderma, Eucerin และอีกมากมายที่ไว้วางใจให้เราเป็นตัวแทนจำหน่าย" },
        { icon: Handshake, title: "โครงการ Affiliate", body: "เปิดโอกาสให้พันธมิตรและครีเอเตอร์ร่วมแนะนำสินค้าและสร้างรายได้ไปด้วยกัน" },
      ]}
    />
  );
}
