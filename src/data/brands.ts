import { Brand } from "./types";

const logo = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;

export const brands: Brand[] = [
  { slug: "smooth-e", name: "Smooth E", tagline: "ผู้เชี่ยวชาญวิตามินอีเพื่อผิวสวย", productCount: 120, logo: logo("smooth-e.com") },
  { slug: "smooth-life", name: "Smooth Life", tagline: "อาหารเสริมและเซ็ตสุขภาพครบวงจร", productCount: 95, logo: logo("smoothlife.com") },
  { slug: "dentiste", name: "Dentiste", tagline: "ยาสีฟันสมุนไพรเพื่อรอยยิ้มขาวสดใส", productCount: 40, logo: logo("dentiste-oralcare.com") },
  { slug: "cerave", name: "CeraVe", tagline: "เซราไมด์เพื่อเกราะปกป้องผิว", productCount: 38, logo: logo("cerave.com") },
  { slug: "bioderma", name: "Bioderma", tagline: "ผิวแพ้ง่ายไว้ใจได้", productCount: 22, logo: logo("bioderma.com") },
  { slug: "bepanthen", name: "Bepanthen", tagline: "ผู้เชี่ยวชาญด้านการซ่อมแซมผิว", productCount: 12, logo: logo("bepanthen.com") },
  { slug: "palmers", name: "Palmer's", tagline: "โกโก้บัตเตอร์เพื่อผิวชุ่มชื้น", productCount: 18, logo: logo("palmers.com") },
  { slug: "eucerin", name: "Eucerin", tagline: "ผิวบอบบางแพ้ง่าย โดยแพทย์ผิวหนัง", productCount: 30, logo: logo("eucerin.com") },
  { slug: "la-roche-posay", name: "La Roche-Posay", tagline: "ตำรับจากน้ำแร่บำบัดผิวแพ้ง่าย", productCount: 26, logo: logo("laroche-posay.com") },
  { slug: "vichy", name: "Vichy", tagline: "นวัตกรรมสกินแคร์จากน้ำแร่ภูเขาไฟ", productCount: 20, logo: logo("vichy.com") },
  { slug: "blackmores", name: "Blackmores", tagline: "อาหารเสริมคุณภาพจากออสเตรเลีย", productCount: 24, logo: logo("blackmores.com.au") },
  { slug: "ensure", name: "Ensure", tagline: "โภชนาการครบถ้วนสำหรับทุกวัย", productCount: 10, logo: logo("ensure.com") },
  { slug: "swisse", name: "Swisse", tagline: "วิตามินพรีเมียมเพื่อสุขภาพองค์รวม", productCount: 16, logo: logo("swisse.com") },
  { slug: "durex", name: "Durex", tagline: "ผลิตภัณฑ์เพื่อสุขภาวะทางเพศ", productCount: 14, logo: logo("durex.com") },
  { slug: "blistex", name: "Blistex", tagline: "ลิปบาล์มบำรุงริมฝีปาก", productCount: 8, logo: logo("blistex.com") },
];
