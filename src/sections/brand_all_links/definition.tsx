import Link from "next/link";
import { z } from "zod";
import type { SectionDefinition } from "@/lib/pages/types";

// The way out to the other brands.
//
// It used to open with every product the brand sells as a list of plain
// links, which was how the products past each shelf's two rows stayed one
// click away — for a shopper scanning for a name, and for a crawler. The
// "สินค้าทั้งหมด" tab in "สินค้าแยกตามประเภท" carries all of them now, as
// cards, so the list had become the same links a second time.

const schema = z.object({});

function Component() {
  return (
    <div className="container-page">
      <p className="mt-8 text-center text-sm">
        <Link href="/brands" className="font-bold text-brand-800 underline-offset-2 hover:underline">
          ดูแบรนด์อื่นทั้งหมด
        </Link>
      </p>
    </div>
  );
}

export const brandAllLinks: SectionDefinition<typeof schema> = {
  type: "brand_all_links",
  version: 1,
  label: "ลิงก์ไปแบรนด์อื่น",
  description: "บรรทัดปิดท้ายหน้าแบรนด์ — ลิงก์ไปหน้ารวมแบรนด์",
  category: "brand",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["brand"],
  maxPerPage: 1,
  Component,
};
