import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-4xl font-bold brand-text-gradient mb-3">404</h1>
      <p className="text-slate-500 mb-6">ไม่พบหน้าที่คุณต้องการ</p>
      <Link href="/" className="rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm">
        กลับหน้าแรก
      </Link>
    </div>
  );
}
