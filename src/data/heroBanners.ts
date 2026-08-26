// Real hero banner creatives from the live smoothlife.com storefront, used
// with the user's explicit go-ahead to reuse assets/data from the real site.
// Deliberately only the 3 generic, evergreen brand/collection banners —
// smoothlife.com's slideshow also had a royal-tribute banner (unrelated to
// products, not appropriate here) and a "1st Anniversary" campaign banner
// tied to a specific date, both excluded so nothing here goes stale or
// off-topic. Each links to a real brand filter on our own /shop page —
// Janeke and Lactis aren't in the curated brands list but are real Shopify
// vendors in the live catalogue, so the brand filter still matches them.
//
// Every slide uses the same desktop-wide creative on both breakpoints
// (mobile crops existed for some slides but were dropped per feedback —
// the desktop crop read better across the board, worth the mobile side-crop
// from object-cover).
export type HeroBanner = {
  slug: string;
  title?: string;
  subtitle?: string;
  image: string;
  href: string;
};

export const heroBanners: HeroBanner[] = [
  {
    // Real "Smooth Sale 22-29 Aug" campaign creative — tied to a specific
    // date range like the Keng Namping slide below, swap/remove once it ends.
    slug: "smooth-sale-22-29-aug",
    title: "Smooth Sale 22-29 Aug",
    image: "https://www.smoothlife.com/cdn/shop/files/Web_Smooth_Sale_22-29Aug-02_2.jpg?v=1787656809&width=3200",
    href: "/promotions",
  },
  {
    // Real "Keng Namping" campaign banner (Dentiste' brand ambassadors,
    // event at Siam Paragon 07.09.2026) — tied to a specific event date like
    // the excluded "1st Anniversary" slide, so it'll read as stale once that
    // date passes. Kept in because it was explicitly requested; swap/remove
    // when the event is over. Creative refreshed to match the one currently
    // live on smoothlife.com's own slideshow.
    slug: "keng-namping",
    title: "Keng Namping x Dentiste'",
    subtitle: "#KengNampingToneUpIconicSmile — พบกันที่สยามพารากอน 07.09.2026",
    image: "https://www.smoothlife.com/cdn/shop/files/BANNER-WEB.png?v=1786690336&width=2000",
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
    // Real "Aromase" scalp-care campaign, currently live on
    // smoothlife.com's own slideshow — not in the curated brands list but a
    // real Shopify vendor in the live catalogue, so the brand filter matches.
    slug: "aromase",
    title: "Aromase",
    subtitle: "เพื่อสุขภาพหนังศีรษะที่แข็งแรง",
    image: "https://www.smoothlife.com/cdn/shop/files/Web_promotion_Aug-06.jpg?v=1785825169&width=2000",
    href: "/shop?brand=aromase",
  },
  {
    slug: "swisse",
    title: "Swisse",
    subtitle: "อาหารเสริมคุณภาพจากออสเตรเลีย",
    image: "https://www.smoothlife.com/cdn/shop/files/Web_p_f_Aug-02.jpg?v=1786352629&width=2000",
    href: "/shop?brand=swisse",
  },
];
