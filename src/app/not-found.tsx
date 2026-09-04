import Image from "next/image";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <span className="relative mx-auto block h-28 w-28">
        <Image src="/mascot/smoothie-say.png" alt="" fill sizes="112px" className="object-contain" />
      </span>
      <h1 className="text-4xl font-bold brand-text-gradient mt-4 mb-3">404</h1>
      <p className="text-slate-500 mb-6">ไม่พบหน้าที่คุณต้องการ</p>
      <Button size="lg" href="/">
        กลับหน้าแรก
      </Button>
    </div>
  );
}
