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
    vendorAliases: ["smoothlifethailand"],
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

  // The rest of the store's real vendors — pulled straight from the live
  // catalogue (see scripts/fetch-products.js), no hand-picked logo asset
  // sourced for these yet, so they render with the existing text-only
  // fallback until someone grabs a real logo file for each.
  { slug: "abhaibhubejhr", name: "Abhaibhubejhr", tagline: "ผลิตภัณฑ์สมุนไพรไทยแผนโบราณ" },
  {
    slug: "acne-aid",
    name: "Acne-Aid",
    tagline: "ผลิตภัณฑ์ทำความสะอาดผิวสำหรับผิวเป็นสิว",
    image: "https://www.smoothlife.com/cdn/shop/collections/19.png?v=1756029415",
  },
  {
    slug: "albupro",
    name: "Albupro",
    tagline: "ผลิตภัณฑ์เสริมอาหารโปรตีน",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/301764950_490471009756185_4101002936087462512_n.jpg?v=1759292095",
  },
  {
    slug: "allwell",
    name: "Allwell",
    tagline: "ผลิตภัณฑ์เพื่อสุขภาพ",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_431e02a7-4934-45ce-8bd4-b8326e237bd3.png?v=1755851268",
  },
  {
    slug: "ambulance",
    name: "Ambulance",
    tagline: "ยาหม่องบรรเทาอาการปวดเมื่อย",
    image: "https://www.smoothlife.com/cdn/shop/collections/16.png?v=1756027932",
  },
  {
    slug: "ammeltz",
    name: "Ammeltz",
    tagline: "สเปรย์และครีมบรรเทาอาการปวดเมื่อยกล้ามเนื้อ",
    image: "https://www.smoothlife.com/cdn/shop/collections/AMMELTZ.png?v=1759216857",
  },
  {
    slug: "aromase",
    name: "Aromase",
    tagline: "ผู้เชี่ยวชาญดูแลเส้นผมและหนังศีรษะจากไต้หวัน",
    image: "https://www.smoothlife.com/cdn/shop/collections/aromase_logo.jpg?v=1760069897",
  },
  {
    slug: "berocca",
    name: "Berocca",
    tagline: "วิตามินซีและบีรวมชนิดฟู่เสริมพลังงาน",
    image: "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_16.png?v=1760598304",
  },
  {
    slug: "botan",
    name: "Botan",
    tagline: "ผลิตภัณฑ์สูดดมและบรรเทาอาการคัดจมูก",
    image: "https://www.smoothlife.com/cdn/shop/collections/BOTAN.jpg?v=1759217984",
  },
  {
    slug: "centrum",
    name: "Centrum",
    tagline: "มัลติวิตามินรวมสำหรับทุกวัย",
    image: "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_11.png?v=1755252333",
  },
  {
    slug: "cetaphil",
    name: "Cetaphil",
    tagline: "ผลิตภัณฑ์ทำความสะอาดผิวอ่อนโยน แนะนำโดยแพทย์ผิวหนัง",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/10_518a72d6-5495-4a9a-8a03-aa4a545b290b.png?v=1755845102",
  },
  {
    slug: "dettol",
    name: "Dettol",
    tagline: "ผลิตภัณฑ์ฆ่าเชื้อและทำความสะอาด",
    image: "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_12.png?v=1755252344",
  },
  {
    slug: "dr-frei",
    name: "Dr.Frei",
    tagline: "ผลิตภัณฑ์ดูแลผิว",
    vendorAliases: ["Dr.Frei"],
    image: "https://www.smoothlife.com/cdn/shop/collections/Dr.Frei.jpg?v=1759218326",
  },
  {
    slug: "dr-master",
    name: "Dr.Master",
    tagline: "ผลิตภัณฑ์เสริมอาหาร",
    vendorAliases: ["Dr.Master"],
    image: "https://www.smoothlife.com/cdn/shop/collections/27.png?v=1756028276",
  },
  {
    slug: "exeter",
    name: "Exeter",
    tagline: "ผลิตภัณฑ์เพื่อสุขภาพ",
    image: "https://www.smoothlife.com/cdn/shop/collections/34.png?v=1756028995",
  },
  {
    slug: "flowflex",
    name: "Flowflex",
    tagline: "ชุดตรวจคัดกรองด้วยตนเอง",
    image: "https://www.smoothlife.com/cdn/shop/collections/Flowflex.png?v=1759219166",
  },
  {
    slug: "futuro",
    name: "Futuro",
    tagline: "ผ้าพยุงข้อและกล้ามเนื้อ",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_953b36c6-fcae-405f-8b64-b0ae91fd0940.png?v=1756096895",
  },
  {
    slug: "glucerna",
    name: "Glucerna",
    tagline: "โภชนาการสูตรครบถ้วนสำหรับผู้ที่ต้องควบคุมระดับน้ำตาล",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_1_153eabaf-9504-4af2-ba4c-82f2b6683fd9.png?v=1756097077",
  },
  {
    slug: "glucolin",
    name: "Glucolin",
    tagline: "เครื่องดื่มเกลือแร่ให้พลังงาน",
    image: "https://www.smoothlife.com/cdn/shop/collections/02010001_1.jpg?v=1759219349",
  },
  {
    slug: "hemomin",
    name: "Hemomin",
    tagline: "ผลิตภัณฑ์เสริมธาตุเหล็ก",
    image: "https://www.smoothlife.com/cdn/shop/collections/Hemomin.png?v=1759220216",
  },
  {
    slug: "hi-care",
    name: "Hi-Care",
    tagline: "ผลิตภัณฑ์ดูแลสุขภาพ",
    image: "https://www.smoothlife.com/cdn/shop/files/HI-CARECLEAN_CAREORGANIC100_WETWIPES_04040526.jpg?v=1755248260",
  },
  {
    slug: "i-kids",
    name: "I-Kids",
    tagline: "ผลิตภัณฑ์เพื่อสุขภาพเด็ก",
    vendorAliases: ["I-Kids"],
    image:
      "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_1_70858ff4-ea3b-430f-8180-a78176c808b7.png?v=1762239694",
  },
  { slug: "imumate", name: "Imumate", tagline: "ผลิตภัณฑ์เสริมภูมิคุ้มกัน" },
  { slug: "interpharma", name: "Interpharma", tagline: "ผลิตภัณฑ์เภสัชภัณฑ์" },
  {
    slug: "janeke",
    name: "Janeke",
    tagline: "แปรงและหวีคุณภาพพรีเมียมจากอิตาลี ตั้งแต่ปี 1830",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/janeke_logo_236994b6-55c5-40bc-98db-94697912055d.jpg?v=1779079715",
  },
  {
    slug: "karisma",
    name: "Karisma",
    tagline: "ผลิตภัณฑ์เพื่อความงาม",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/38_61ad1989-8db5-48ce-a7b7-006fea625d54.png?v=1756030001",
  },
  {
    slug: "klean-kare",
    name: "Klean&Kare",
    tagline: "ผลิตภัณฑ์ทำความสะอาดและสุขอนามัย",
    vendorAliases: ["Klean&Kare"],
    image:
      "https://www.smoothlife.com/cdn/shop/collections/14_f63ceb4c-4e0b-418b-9ae4-639b4f141a36.png?v=1756030969",
  },
  {
    slug: "koolfever",
    name: "Koolfever",
    tagline: "แผ่นเจลลดไข้",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/32_d3ebc5fd-5181-4fb5-bdbf-8b8f1ddc214e.png?v=1756028833",
  },
  { slug: "lactis", name: "Lactis", tagline: "โพรไบโอติกเพื่อสุขภาพลำไส้" },
  {
    slug: "lamoon",
    name: "Lamoon",
    tagline: "ผลิตภัณฑ์ดูแลผิว",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/31_e6908d63-f413-41c2-8ed8-1ee1d5abd434.png?v=1756028744",
  },
  {
    slug: "mamarine",
    name: "Mamarine",
    tagline: "ผลิตภัณฑ์สำหรับคุณแม่และเด็ก",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_11_dfc5da90-dc6a-4c3d-b905-870f93cdd353.png?v=1759141864",
  },
  {
    slug: "maro",
    name: "Maro",
    tagline: "ผลิตภัณฑ์ดูแลเส้นผมสำหรับผู้ชายจากญี่ปุ่น",
    image: "https://www.smoothlife.com/cdn/shop/collections/Maro_Logo.jpg?v=1759812295",
  },
  {
    slug: "mega",
    name: "Mega",
    tagline: "อาหารเสริมและวิตามินคุณภาพ",
    vendorAliases: ["Mega We Care"],
    image: "https://www.smoothlife.com/cdn/shop/collections/25.png?v=1756028173",
  },
  {
    slug: "neoplast",
    name: "Neoplast",
    tagline: "พลาสเตอร์ปิดแผล",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_10_95f58451-24f6-4939-ba13-6aaebcf90ee9.png?v=1758788236",
  },
  { slug: "neotape", name: "Neotape", tagline: "เทปทางการแพทย์" },
  { slug: "nola", name: "Nola", tagline: "ผลิตภัณฑ์เพื่อสุขภาพ" },
  { slug: "nutroplex", name: "Nutroplex", tagline: "วิตามินรวมชนิดน้ำสำหรับเด็ก" },
  {
    slug: "opti-free",
    name: "Opti-Free",
    tagline: "น้ำยาล้างและแช่คอนแทคเลนส์",
    image: "https://www.smoothlife.com/cdn/shop/collections/45.png?v=1756030598",
  },
  { slug: "oso-cal", name: "Oso-Cal", tagline: "แคลเซียมเสริม" },
  { slug: "phecare", name: "Phecare", tagline: "ผลิตภัณฑ์ดูแลสุขภาพ" },
  {
    slug: "physiogel",
    name: "Physiogel",
    tagline: "ผลิตภัณฑ์ดูแลผิวแพ้ง่ายและผิวบอบบาง",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/347815048_1399934397526644_3348982248096400466_n.png?v=1762154092",
  },
  { slug: "probac7", name: "Probac7", tagline: "โพรไบโอติกเพื่อระบบขับถ่ายและภูมิคุ้มกัน" },
  {
    slug: "sanita",
    name: "Sanita",
    tagline: "รองเท้าเพื่อสุขภาพเท้า",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/682456887_1552787580180409_8221779661978420471_n.jpg?v=1779767455",
  },
  {
    slug: "sebamed",
    name: "Sebamed",
    tagline: "ผลิตภัณฑ์ทำความสะอาดผิวค่า pH 5.5 จากเยอรมนี",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/449925629_865585575605336_4192252277912020621_n.jpg?v=1759723942",
  },
  { slug: "sensiplus", name: "Sensiplus", tagline: "ผลิตภัณฑ์สำหรับผิวแพ้ง่าย" },
  {
    slug: "sos",
    name: "Sos",
    tagline: "ผลิตภัณฑ์ปฐมพยาบาลเบื้องต้น",
    image: "https://www.smoothlife.com/cdn/shop/collections/Untitled_design_10.png?v=1755252300",
  },
  {
    slug: "tiger-balm",
    name: "Tiger Balm",
    tagline: "ยาหม่องบรรเทาอาการปวดเมื่อย",
    image: "https://www.smoothlife.com/cdn/shop/collections/15.png?v=1756028000",
  },
  {
    slug: "vantelin",
    name: "Vantelin",
    tagline: "ผ้าพยุงข้อและแผ่นแปะบรรเทาปวดจากญี่ปุ่น",
    image: "https://www.smoothlife.com/cdn/shop/collections/35.png?v=1756029249",
  },
  {
    slug: "vistra",
    name: "Vistra",
    tagline: "อาหารเสริมและวิตามินยอดนิยมของไทย",
    image:
      "https://www.smoothlife.com/cdn/shop/collections/29_6a13af9d-eec4-4771-8f98-8a67c1877298.png?v=1756028483",
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

// Smooth E / Smooth Life / Dentiste are the company's own house brands
// (per the "Life So Smooth" brand concept) — always featured first, in
// this fixed order, wherever brands are listed or browsed.
export const HOUSE_BRAND_SLUGS = ["smooth-e", "smooth-life", "dentiste"] as const;

export const houseBrands: Brand[] = HOUSE_BRAND_SLUGS.map((slug) => brands.find((b) => b.slug === slug)).filter(
  (b): b is Brand => !!b
);

export function isHouseBrand(slug: string) {
  return (HOUSE_BRAND_SLUGS as readonly string[]).includes(slug);
}

// Every other brand, in the same order they already appear in `brands`.
export const otherBrands: Brand[] = brands.filter((b) => !isHouseBrand(b.slug));
