import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

import { Card } from "@/components/ui";

// The manual for the page system, written from what the screens actually do.
//
// Deliberately not written from the plan. The plan describes drag-to-reorder,
// clicking a section in the preview to select it, and a visual diff between
// versions; none of those exist yet. A help page that describes features the
// software does not have sends people looking for a control that is not
// there and makes them doubt the ones that are — so what is missing is in
// its own section at the bottom, by name.

export const metadata = { title: "วิธีใช้ระบบจัดหน้าเว็บ" };

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-[12px] font-bold text-brand-800">
        {n}
      </span>
      <span className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed text-slate-600">{children}</span>
    </li>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-bold text-brand-ink">{title}</h2>
      {lead && <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{lead}</p>}
      <ol className="mt-3 flex flex-col gap-2.5">{children}</ol>
    </Card>
  );
}

const B = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-brand-ink">{children}</span>
);

export default function PagesHelp() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/admin/pages" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-800">
        <ArrowLeft size={15} /> กลับไปรายการหน้าเว็บ
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <BookOpen size={20} /> วิธีใช้ระบบจัดหน้าเว็บ
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          ประกอบหน้าเว็บจาก section ที่เลือกได้ แก้เป็นร่างก่อนเสมอ แล้วค่อยเผยแพร่ ·
          ทุกครั้งที่เผยแพร่ระบบเก็บเป็นเวอร์ชันไว้ ย้อนกลับได้ด้วยปุ่มเดียว
        </p>
      </div>

      <Card>
        <h2 className="text-base font-bold text-brand-ink">สิ่งที่ต้องเข้าใจก่อนสามข้อ</h2>
        <ul className="mt-3 flex flex-col gap-2.5 text-[13px] leading-relaxed text-slate-600">
          <li>
            <B>ร่างกับหน้าจริงเป็นคนละอัน</B> — ที่แก้ในหน้า editor คือร่าง ลูกค้ายังเห็นของเดิมจนกว่าจะกด
            เผยแพร่ กรอบตัวอย่างตรงกลางคือร่าง ไม่ใช่หน้าจริง
          </li>
          <li>
            <B>ร่างบันทึกเองอัตโนมัติ</B> — หยุดพิมพ์ประมาณหนึ่งวินาทีแล้วบันทึกให้ ป้ายบนแถบบนบอกสถานะ
            ถ้ามีคนอื่นแก้หน้าเดียวกันอยู่ ระบบจะหยุดบันทึกแล้วบอก แทนที่จะทับงานเขา
          </li>
          <li>
            <B>คลิก section ในกรอบตัวอย่างเพื่อเลือกได้เลย</B> — กรอบจะตีกรอบเขียวให้ว่ากำลังแก้อันไหน และเลือก
            จากรายการทางซ้ายก็ตีกรอบในกรอบตัวอย่างเหมือนกัน · ลิงก์ในกรอบตัวอย่างกดแล้วไม่พาไปไหน เพราะมันคือ
            ภาพของหน้า ไม่ใช่หน้าจริง
          </li>
          <li>
            <B>section ที่ตั้งค่าไม่ครบจะไม่แสดงบนหน้าจริง</B> — แต่ยังเห็นในกรอบตัวอย่างพร้อมกล่องแดงบอกเหตุผล
            ตัวอย่างจึงบอกความจริงมากกว่าหน้าจริงโดยตั้งใจ
          </li>
        </ul>
      </Card>

      <Section title="A. เพิ่มแบนเนอร์โปรโมชันลงหน้าแรก" lead="งานที่ทำบ่อยที่สุด">
        <Step n={1}>
          เปิด <B>หน้าเว็บ → หน้าแรก</B>
        </Step>
        <Step n={2}>
          กด <B>+ เพิ่ม</B> บนหัวรายการ section ทางซ้าย แล้วเลือก <B>แบนเนอร์รูปเดียว</B> ·
          รายการนี้แสดงเฉพาะ section ที่ใช้กับหน้าประเภทนี้ได้ และตัวที่ใส่ครบจำนวนแล้วจะเป็นสีจาง
        </Step>
        <Step n={3}>
          section ใหม่ไปอยู่ท้ายสุด · ลากที่จุดจับด้านซ้ายของแถวเพื่อย้าย หรือใช้ปุ่มลูกศรขึ้น/ลงก็ได้ ·
          ถ้าใช้คีย์บอร์ด กด Tab ไปที่จุดจับ แล้ว Space เพื่อยก ลูกศรเพื่อย้าย Space อีกครั้งเพื่อวาง
        </Step>
        <Step n={4}>
          ในแผงขวา แท็บ <B>section ที่เลือก</B> เลือกรูป (คลังรูปย่อให้ 3 ขนาดอัตโนมัติ) ·
          ใส่คำบรรยายรูปด้วย ไม่งั้นตอนเผยแพร่จะมีคำเตือน
        </Step>
        <Step n={5}>
          อยากให้ขึ้นเฉพาะบางช่วง ตั้งเวลาเริ่ม/หยุดของ section ได้ในแผงเดียวกัน
        </Step>
        <Step n={6}>
          ดูในกรอบตัวอย่าง สลับ <B>มือถือ / แท็บเล็ต / คอมพิวเตอร์</B> แล้วกด <B>เผยแพร่</B>
        </Step>
      </Section>

      <Section title="B. ทำแคมเปญ 11.11" lead="ปีหน้าทำซ้ำจากของปีนี้ได้ ไม่ต้องเริ่มใหม่">
        <Step n={1}>
          <B>หน้าเว็บ → สร้างหน้าใหม่</B> เลือกประเภท <B>แคมเปญ</B> ที่อยู่ <B>11-11</B> ·
          ใช้ที่อยู่เดิมทุกปี ลิงก์โฆษณาเก่าและอันดับใน Google จะไม่หาย
        </Step>
        <Step n={2}>
          แผงขวา แท็บ <B>ตั้งค่าเพจ</B> → <B>template และสำเนา</B> → เลือก <B>Double Day</B> แล้วกด
          ใช้แบบนี้ · ได้โครงหน้าครบชุดมาเลย
        </Step>
        <Step n={3}>
          ในแท็บเดียวกัน ตั้ง <B>ช่วงเวลาแคมเปญ</B> ทั้งสี่ช่อง (ก่อนเริ่ม / วันงาน / ขยายเวลา / จบ) ·
          เวลาที่กรอกเป็นเวลาไทย
        </Step>
        <Step n={4}>
          ตั้ง <B>สีของแคมเปญ</B> · ถ้าตัวอักษรบนสีหลักอ่านยากเกินเกณฑ์ ระบบจะไม่ให้บันทึกและบอกเลขที่วัดได้
        </Step>
        <Step n={5}>
          แก้ section ทีละตัว แล้วใช้ <B>ดูในช่วง</B> เหนือกรอบตัวอย่าง ไล่ดูทั้งสี่ช่วงว่าถูกไหม
          โดยไม่ต้องรอถึงเวลาจริง
        </Step>
        <Step n={6}>
          อยากให้ขึ้นหน้าแรกด้วย ติ๊ก <B>ให้แคมเปญนี้ขึ้นหน้าแรก</B> (ต้องมี section &quot;ช่องแคมเปญ&quot;
          วางอยู่ในหน้าแรกแล้ว วางครั้งเดียวใช้ได้ทุกแคมเปญ) · ใส่ชื่อแบรนด์ที่ร่วมแคมเปญไว้ด้วย
          หน้าแบรนด์นั้นจะขึ้นแถบ &quot;กำลังมีแคมเปญ&quot; เอง
        </Step>
        <Step n={7}>
          เผยแพร่ได้เลยไม่ต้องรอ — ระบบซ่อน/แสดง section ตามช่วงให้เอง และพอถึงเวลา หน้าจะเปลี่ยนช่วงเอง
          ภายในหนึ่งนาที
        </Step>
      </Section>

      <Section title="C. แต่งหน้าแบรนด์" lead="ทุกแบรนด์มีหน้าอัตโนมัติอยู่แล้ว ไม่ต้องสร้าง">
        <Step n={1}>
          <B>หน้าแบรนด์ → เลือกแบรนด์</B> แล้วกรอกโปรไฟล์: รูปหัว เรื่องราว จุดเด่น สินค้าแนะนำ ·
          บันทึกแล้วขึ้นทันทีทั้งหน้าอัตโนมัติและหน้าที่จัดเอง
        </Step>
        <Step n={2}>
          อยากจัดหน้าเอง กด <B>จัดหน้าแบรนด์นี้เอง</B> · ระบบสร้างหน้าให้จากหน้าอัตโนมัติที่มีอยู่
          แล้วแก้ต่อได้เหมือนหน้าอื่น
        </Step>
        <Step n={3}>
          เปลี่ยนใจได้ตลอด กด <B>กลับไปใช้หน้าอัตโนมัติ</B> · หน้าที่จัดไว้ยังเก็บอยู่ ไม่ได้ถูกลบ
        </Step>
      </Section>

      <Section title="D. เผยแพร่ผิด ต้องย้อนกลับ" lead="ไม่ต้องรอ dev และไม่ต้อง deploy">
        <Step n={1}>
          ในหน้า editor แผงขวา แท็บ <B>ตั้งค่าเพจ</B> → <B>เวอร์ชันที่เผยแพร่แล้ว</B>
        </Step>
        <Step n={2}>
          กด <B>ใช้อันนี้</B> ที่เวอร์ชันที่ต้องการ · ลูกค้าเห็นของเดิมภายในไม่กี่วินาที
        </Step>
        <Step n={3}>
          ร่างที่กำลังแก้อยู่ไม่ถูกแตะต้อง — ย้อนหน้าจริงกลับไม่ได้ทำให้งานที่ค้างอยู่หาย
        </Step>
      </Section>

      <Section title="E. ขออนุมัติก่อนเผยแพร่" lead="สำหรับคนที่ไม่มีสิทธิ์เผยแพร่เอง">
        <Step n={1}>
          แก้เสร็จแล้ว ไปที่แท็บ <B>ตั้งค่าเพจ</B> → <B>ขออนุมัติก่อนเผยแพร่</B> เขียนบอกว่าแก้อะไรไป
          แล้วกด <B>ขออนุมัติ</B>
        </Step>
        <Step n={2}>
          คนที่มีสิทธิ์เผยแพร่จะเห็นปุ่ม <B>อนุมัติและเผยแพร่</B> กับ <B>ส่งกลับให้แก้</B> บนหน้าเดียวกัน ·
          อนุมัติแล้วหน้าขึ้นเลยในขั้นตอนเดียว
        </Step>
        <Step n={3}>
          ถ้าตั้งค่าแจ้งเตือน LINE ไว้ ระบบจะส่งข้อความบอกทีมให้ · ถ้ายังไม่ได้ตั้ง หน้าจอจะบอกตรง ๆ ว่า
          ยังไม่ได้แจ้ง ต้องไปบอกเอง
        </Step>
      </Section>

      <Card>
        <h2 className="text-base font-bold text-brand-ink">ยังไม่มีในระบบ</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          เขียนไว้ให้ชัด จะได้ไม่ต้องไปตามหาปุ่มที่ไม่มีอยู่จริง
        </p>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-slate-600">
          <li>เทียบความต่างระหว่างเวอร์ชันแบบไฮไลต์สี — ตอนนี้ย้อนได้ แต่ยังไม่มีหน้าเทียบ</li>
          <li>เลิกทำ (undo) หลังลบ section — ลบแล้วต้องเพิ่มใหม่ ถ้าเผยแพร่ไปแล้วให้ย้อนเวอร์ชันแทน</li>
        </ul>
      </Card>
    </div>
  );
}
