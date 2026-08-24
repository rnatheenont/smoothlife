// Real hero banner creatives from the live smoothlife.com storefront, used
// with the user's explicit go-ahead to reuse assets/data from the real site.
// Deliberately only the 3 generic, evergreen brand/collection banners —
// smoothlife.com's slideshow also had a royal-tribute banner (unrelated to
// products, not appropriate here) and a "1st Anniversary" campaign banner
// tied to a specific date, both excluded so nothing here goes stale or
// off-topic. Each links to a real brand filter on our own /shop page —
// Janeke and Lactis aren't in the curated brands list but are real Shopify
// vendors in the live catalogue, so the brand filter still matches them.
export type HeroBanner = {
  slug: string;
  title?: string;
  subtitle?: string;
  image: string;
  href: string;
};

export const heroBanners: HeroBanner[] = [
  {
    // Real "Keng Namping" campaign banner (Dentiste' brand ambassadors,
    // event at Siam Paragon 07.09.2026) — tied to a specific event date like
    // the excluded "1st Anniversary" slide, so it'll read as stale once that
    // date passes. Kept in because it was explicitly requested; swap/remove
    // when the event is over.
    slug: "keng-namping",
    title: "Keng Namping x Dentiste'",
    subtitle: "#KengNampingToneUpIconicSmile — พบกันที่สยามพารากอน 07.09.2026",
    image: "https://www.smoothlife.com/cdn/shop/files/RESIZE-KNP-2_1.png?v=1786631497&width=2000",
    href: "/shop?brand=dentiste",
  },
  {
    slug: "janeke",
    title: "Janeke 1830",
    subtitle: "แปรงผมพรีเมียมจากอิตาลี ตั้งแต่ปี 1830",
    image: "https://www.smoothlife.com/cdn/shop/files/Web_promotion_Aug-04.jpg?v=1785825355&width=2000",
    href: "/shop?brand=janeke",
  },
  {
    slug: "lactis",
    title: "LEXS by Smooth E",
    subtitle: "Lactis Acid Bacteria โพรไบโอติกเพื่อสุขภาพลำไส้",
    image: "https://www.smoothlife.com/cdn/shop/files/AW_Lactis_08-Aug-03.jpg?v=1786092037&width=2000",
    href: "/shop?brand=lactis",
  },
  {
    slug: "swisse",
    title: "Swisse",
    subtitle: "อาหารเสริมคุณภาพจากออสเตรเลีย",
    image: "https://www.smoothlife.com/cdn/shop/files/Web_p_f_Aug-02.jpg?v=1786352629&width=2000",
    href: "/shop?brand=swisse",
  },
];
