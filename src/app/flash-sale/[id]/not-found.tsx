import Link from "next/link";

// A sale id that is not a sale — a stale link, a typo, a campaign deleted
// after the post went out. Its own boundary rather than the site-wide 404
// because the chrome for these pages is decided by the layout in this segment,
// and the root 404 renders above it: without this, a bad link landed on an
// undressed white page.
export default function FlashSaleNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-extrabold text-brand-ink">ไม่พบแคมเปญนี้</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        ลิงก์อาจหมดอายุ หรือแคมเปญถูกปิดไปแล้ว ลองเช็กลิงก์อีกครั้งจากโพสต์ที่ได้รับมา
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-800 px-6 text-[14px] font-semibold text-white hover:bg-brand-1000"
      >
        กลับหน้าแรก
      </Link>
    </div>
  );
}
