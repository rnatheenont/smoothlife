import { PAGES_WAVE1_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import { Recycle, Leaf, Users2, HeartPulse } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "ความรับผิดชอบต่อสังคม | Smoothlife.com" };

function SustainabilityPageWritten() {
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

/**
 * The page, from its document when wave 1 is on and from the markup above
 * when it is not.
 *
 * Both halves stay in the tree on purpose. The flag is the emergency switch:
 * turning it off puts this page back on the next request with no deploy and
 * nothing to roll back, and that is only true while the hand-written half is
 * still here. It goes when the wave has been live long enough to trust.
 */
export default function SustainabilityPage() {
  if (PAGES_WAVE1_ENABLED) return <SystemPageBody pageKey="about-sustainability" />;
  return <SustainabilityPageWritten />;
}
