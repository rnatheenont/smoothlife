import { Brand } from "./types";
import { products } from "./products";

// Logo images are pulled from the merchant's own Shopify brand collection
// pages (real assets they already uploaded) — not sourced elsewhere.
// productCount is left at 0 here and computed below from the real,
// live-fetched catalogue so it never drifts from what's actually on sale.
const brandDefs: Omit<Brand, "productCount">[] = [
  {
    slug: "smooth-e",
    name: "Smooth E",
    tagline: "ผู้เชี่ยวชาญวิตามินอีเพื่อผิวสวย",
    vendorAliases: ["Smooth-e-thailand"],
    image:
      "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/smooth_e_logo_36d31bf6-ba55-4fe3-acca-fb533ca2bd51.jpg?v=1760494356",
  },
  {
    slug: "smooth-life",
    name: "Smooth Life",
    tagline: "อาหารเสริมและเซ็ตสุขภาพครบวงจร",
    image:
      "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Screenshot_2025-09-25_095352-removebg-preview_1.png?v=1779079828",
  },
  {
    slug: "dentiste",
    name: "Dentiste",
    tagline: "ยาสีฟันสมุนไพรเพื่อรอยยิ้มขาวสดใส",
    vendorAliases: ["Dentiste thailand", "Dentiste'"],
    image:
      "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Untitled_design_12_6754e6ad-42bf-4608-94e9-1e011c046773.png?v=1759811944",
  },
  {
    slug: "cerave",
    name: "CeraVe",
    tagline: "เซราไมด์เพื่อเกราะปกป้องผิว",
    image:
      "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Cerave-Logo-Vector_svg_0287756b-9ac4-4a6b-bcf4-2a1eb5f10b94.png?v=1755839482",
  },
  {
    slug: "bioderma",
    name: "Bioderma",
    tagline: "ผิวแพ้ง่ายไว้ใจได้",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Bioderma.webp?v=1758277671",
  },
  {
    slug: "bepanthen",
    name: "Bepanthen",
    tagline: "ผู้เชี่ยวชาญด้านการซ่อมแซมผิว",
    image:
      "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/387084897_660439099520536_8990679544341794278_n.jpg?v=1759126235",
  },
  {
    slug: "palmers",
    name: "Palmer's",
    tagline: "โกโก้บัตเตอร์เพื่อผิวชุ่มชื้น",
    vendorAliases: ["Palmers"],
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Palmer_s_Logo_1.jpg?v=1759812225",
  },
  {
    slug: "eucerin",
    name: "Eucerin",
    tagline: "ผิวบอบบางแพ้ง่าย โดยแพทย์ผิวหนัง",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Untitled_design_7.png?v=1755514772",
  },
  {
    slug: "la-roche-posay",
    name: "La Roche-Posay",
    tagline: "ตำรับจากน้ำแร่บำบัดผิวแพ้ง่าย",
    image:
      "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Untitled_design_1_52849b44-1fdd-41be-97b0-a6453fcfd8c7.png?v=1757485704",
  },
  {
    slug: "vichy",
    name: "Vichy",
    tagline: "นวัตกรรมสกินแคร์จากน้ำแร่ภูเขาไฟ",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/a_logo-vichy_og-image.png?v=1758265086",
  },
  {
    slug: "blackmores",
    name: "Blackmores",
    tagline: "อาหารเสริมคุณภาพจากออสเตรเลีย",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Untitled_design_13.png?v=1755252369",
  },
  {
    slug: "ensure",
    name: "Ensure",
    tagline: "โภชนาการครบถ้วนสำหรับทุกวัย",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Untitled_design_8.png?v=1755252385",
  },
  {
    slug: "swisse",
    name: "Swisse",
    tagline: "วิตามินพรีเมียมเพื่อสุขภาพองค์รวม",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/Untitled_design_9.png?v=1755252318",
  },
  {
    slug: "durex",
    name: "Durex",
    tagline: "ผลิตภัณฑ์เพื่อสุขภาวะทางเพศ",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/RB__Logo_Brand__1000x1000px-03.jpg?v=1765353185",
  },
  {
    slug: "blistex",
    name: "Blistex",
    tagline: "ลิปบาล์มบำรุงริมฝีปาก",
    image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/collections/blistex_logo.png?v=1760069844",
  },
];

export function slugifyVendor(vendor: string) {
  return vendor.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

// Every slug variant (from the brand's own name + its known aliases) that
// should be treated as this brand when matching a product's Shopify vendor.
export function brandSlugAliases(brand: Pick<Brand, "name" | "vendorAliases">) {
  return [brand.name, ...(brand.vendorAliases || [])].map(slugifyVendor);
}

export const brands: Brand[] = brandDefs
  .map((b) => {
    const slugAliases = brandSlugAliases(b);
    const productCount = products.filter((p) => slugAliases.includes(slugifyVendor(p.brand))).length;
    return { ...b, productCount };
  })
  .filter((b) => b.productCount > 0);
