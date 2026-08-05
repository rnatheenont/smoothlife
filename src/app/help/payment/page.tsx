import { QrCode, CreditCard, Banknote, Truck } from "lucide-react";
import ContentPage from "@/components/ContentPage";

export const metadata = { title: "การชำระเงิน | Smoothlife.com" };

export default function PaymentPage() {
  return (
    <ContentPage
      eyebrow="Payment"
      title="ช่องทางการชำระเงิน"
      intro="เลือกวิธีการชำระเงินที่สะดวกและปลอดภัยที่สุดสำหรับคุณ"
      sections={[
        { icon: QrCode, title: "PromptPay QR", body: "สแกนจ่ายผ่านแอปธนาคารได้ทันที ยืนยันคำสั่งซื้อรวดเร็ว" },
        { icon: CreditCard, title: "บัตรเครดิต/เดบิต", body: "รองรับ Visa, Mastercard และ JCB พร้อมระบบเข้ารหัสความปลอดภัย" },
        { icon: Banknote, title: "โอนเงินผ่านธนาคาร", body: "โอนเงินและแนบสลิปเพื่อยืนยันคำสั่งซื้อผ่านระบบอัตโนมัติ" },
        { icon: Truck, title: "เก็บเงินปลายทาง (COD)", body: "ชำระเงินสดเมื่อได้รับสินค้า สำหรับพื้นที่ที่รองรับบริการ" },
      ]}
    />
  );
}
