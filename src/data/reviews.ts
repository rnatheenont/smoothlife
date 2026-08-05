import { Review } from "./types";

const names = ["น้ำฝน", "ปิยะดา", "Kanya", "ธนพล", "Suchada", "Warit", "Napat", "Chalisa", "Peerapat", "Ploy"];
const titles = [
  "ใช้แล้วเห็นผลจริง",
  "คุ้มค่ามาก แนะนำเลย",
  "ส่งไวของแท้แน่นอน",
  "ผิวดีขึ้นชัดเจน",
  "ซื้อซ้ำแน่นอน",
  "เนื้อสัมผัสดีมาก",
];
const bodies = [
  "ใช้มาประมาณ 2 สัปดาห์ รู้สึกว่าผิวชุ่มชื้นขึ้นเยอะ จะซื้อใช้ต่อแน่นอนค่ะ",
  "แพ็กเกจดี ส่งไว ของแท้ 100% ราคาคุ้มกว่าซื้อหน้าร้านมาก",
  "กลิ่นหอมอ่อนๆ ไม่แสบผิว ใช้ได้ทั้งเช้าและเย็น ชอบมากค่ะ",
  "ลองใช้ตามรีวิวเพื่อน ผลลัพธ์ดีเกินคาด ผิวเนียนขึ้นจริง",
  "เนื้อผลิตภัณฑ์ซึมไว ไม่เหนียวเหนอะหนะ เหมาะกับอากาศเมืองไทย",
  "สั่งมาเป็นชุดที่สองแล้ว เพราะใช้แล้วถูกใจมากจริงๆ",
];

export function generateReviews(seed: number, count = 4): Review[] {
  const reviews: Review[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % names.length;
    const tIdx = (seed + i * 3) % titles.length;
    const bIdx = (seed + i * 5) % bodies.length;
    reviews.push({
      author: names[idx],
      rating: 4 + ((seed + i) % 2 === 0 ? 1 : 0),
      date: `${(seed + i) % 28 + 1} ก.ค. 2569`,
      title: titles[tIdx],
      body: bodies[bIdx],
      verified: true,
    });
  }
  return reviews;
}
