import { Article } from "./types";

export const articles: Article[] = [
  {
    slug: "how-to-build-skincare-routine",
    title: "วิธีจัดลำดับขั้นตอนสกินแคร์ให้ถูกต้อง",
    category: "guide",
    excerpt: "เรียงลำดับผลิตภัณฑ์อย่างไรให้ผิวดูดซึมสารบำรุงได้เต็มประสิทธิภาพ",
    body: [
      "การจัดลำดับสกินแคร์ที่ถูกต้องช่วยให้ผิวดูดซึมสารบำรุงได้อย่างมีประสิทธิภาพสูงสุด โดยหลักการทั่วไปคือเรียงจากเนื้อบางไปเนื้อหนา",
      "ขั้นตอนพื้นฐาน: 1) ทำความสะอาดผิว 2) โทนเนอร์ 3) เซรั่ม 4) มอยส์เจอร์ไรเซอร์ 5) ครีมกันแดด (ตอนเช้า)"
 ],
    image: "https://www.smoothlife.com/cdn/shop/collections/Skincare-02.jpg?width=800",
    sources: ["American Academy of Dermatology", "Smooth Life Expert Panel"],
    readMins: 4,
  },
  {
    slug: "understanding-niacinamide",
    title: "ทำความรู้จัก Niacinamide สารบำรุงผิวยอดฮิต",
    category: "ingredient",
    excerpt: "ไนอาซินาไมด์ช่วยอะไรผิวได้บ้าง และเหมาะกับใคร",
    body: [
      "Niacinamide หรือวิตามินบี 3 เป็นสารบำรุงผิวที่ช่วยลดรอยแดง ควบคุมความมัน และเสริมสร้างเกราะปกป้องผิว",
      "งานวิจัยพบว่าความเข้มข้น 2-5% มีประสิทธิภาพในการลดเลือนรอยดำและกระจ่างใสผิวโดยไม่ระคายเคือง"
 ],
    image: "https://www.smoothlife.com/cdn/shop/files/th-11134201-7rask-m9g7bwf45sll65.webp?width=800",
    sources: ["Journal of Cosmetic Dermatology", "Smooth Life Expert Panel"],
    readMins: 3,
  },
  {
    slug: "routine-for-acne-prone-skin",
    title: "รูทีนดูแลผิวสำหรับคนเป็นสิวง่าย",
    category: "routine",
    excerpt: "จัดสูตรผลิตภัณฑ์ที่เหมาะกับผิวมันและเป็นสิวง่ายแบบเป็นขั้นตอน",
    body: [
      "เริ่มต้นด้วยเจลล้างหน้าที่มีส่วนผสมช่วยควบคุมความมันโดยไม่ทำให้ผิวแห้งตึงเกินไป",
      "ตามด้วยเซรั่มที่มีสารต้านการอักเสบ เช่น Niacinamide หรือ Salicylic Acid"
 ],
    image: "https://www.smoothlife.com/cdn/shop/files/th-11134201-7rasi-m8e9zf33lucu07.webp?width=800",
    sources: ["Smooth Life Expert Panel"],
    readMins: 5,
  },
  {
    slug: "faq-serum-vs-essence",
    title: "เซรั่มกับเอสเซนส์ต่างกันอย่างไร",
    category: "qa",
    excerpt: "คำถามยอดฮิตที่หลายคนสงสัยเรื่องความแตกต่างของสารบำรุงผิว",
    body: [
      "เอสเซนส์มีเนื้อสัมผัสบางเบากว่าเซรั่ม เน้นเตรียมผิวให้พร้อมดูดซึมขั้นตอนถัดไป",
      "เซรั่มมีความเข้มข้นของสารบำรุงสูงกว่า ออกแบบมาเพื่อแก้ปัญหาผิวเฉพาะจุด เช่น ริ้วรอยหรือจุดด่างดำ"
 ],
    image: "https://www.smoothlife.com/cdn/shop/files/set_sme_824.png?width=800",
    sources: ["Smooth Life Expert Panel"],
    readMins: 2,
  },
  {
    slug: "video-how-to-apply-serum",
    title: "วิดีโอสาธิต: วิธีทาเซรั่มให้ซึมไว",
    category: "video",
    excerpt: "เทคนิคการทาเซรั่มแบบมืออาชีพเพื่อให้ผิวดูดซึมได้เต็มที่",
    body: [
      "ใช้ปริมาณเซรั่มขนาดเท่าเหรียญบาท แตะเบาๆ ทั่วใบหน้าก่อนลูบให้ทั่ว",
      "ใช้ฝ่ามือกดเบาๆ (press) แทนการถูแรงๆ เพื่อช่วยให้สารบำรุงซึมเข้าสู่ผิวได้ดีขึ้น"
 ],
    image: "https://www.smoothlife.com/cdn/shop/files/set_sme_824.png?width=800",
    sources: ["Smooth Life Expert Panel"],
    readMins: 3,
  },
  {
    slug: "sunscreen-myths",
    title: "ความเชื่อผิดๆ เกี่ยวกับครีมกันแดดที่ควรเลิกเชื่อ",
    category: "guide",
    excerpt: "ไขข้อข้องใจเรื่องกันแดดที่หลายคนยังเข้าใจผิด",
    body: [
      "ความเชื่อที่ว่า 'อยู่แต่ในบ้านไม่ต้องทากันแดด' เป็นความเข้าใจผิด เพราะรังสี UVA สามารถทะลุกระจกหน้าต่างได้",
      "ควรทากันแดดซ้ำทุก 2-3 ชั่วโมงหากอยู่กลางแจ้งเป็นเวลานาน"
 ],
    image: "https://www.smoothlife.com/cdn/shop/collections/Skincare-02.jpg?width=800",
    sources: ["Skin Cancer Foundation", "Smooth Life Expert Panel"],
    readMins: 4,
  },
];

export function getArticleBySlug(slug: string) {
  return articles.find((a) => a.slug === slug);
}
