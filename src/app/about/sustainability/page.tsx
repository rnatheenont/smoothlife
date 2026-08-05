import { Recycle, Leaf, Users2, HeartPulse } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "ความรับผิดชอบต่อสังคม | Smoothlife.com" };

export default function SustainabilityPage() {
  return (
    <ContentPage
      eyebrow="Responsibility and Sustainability"
      title="ความรับผิดชอบต่อสังคมและสิ่งแวดล้อม"
      intro="เราเชื่อว่าธุรกิจที่ดีต้องเติบโตไปพร้อมกับสังคมและสิ่งแวดล้อมอย่างยั่งยืน"
      sections={[
        { icon: Recycle, title: "บรรจุภัณฑ์ยั่งยืน", body: "ลดใช้พลาสติกและเปลี่ยนมาใช้วัสดุที่ย่อยสลายได้ในบรรจุภัณฑ์จัดส่ง" },
        { icon: Leaf, title: "จัดหาอย่างรับผิดชอบ", body: "คัดเลือกคู่ค้าที่คำนึงถึงผลกระทบต่อสิ่งแวดล้อมในกระบวนการผลิต" },
        { icon: Users2, title: "สนับสนุนชุมชน", body: "ร่วมกิจกรรมมอบผลิตภัณฑ์สุขภาพให้กับชุมชนและหน่วยงานที่ขาดแคลน" },
        { icon: HeartPulse, title: "ส่งเสริมสุขภาพเชิงป้องกัน", body: "จัดกิจกรรมให้ความรู้ด้านสุขภาพและความงามแก่สาธารณะอย่างต่อเนื่อง" },
      ]}
    />
  );
}
