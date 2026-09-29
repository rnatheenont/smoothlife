import type { MetadataRoute } from "next";

// Installed to a home screen, this is the whole of what the phone knows about
// the shop: its name under the icon, the colour of the window it opens in,
// and where it starts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Smoothlife.com",
    short_name: "Smoothlife",
    description: "ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม",
    lang: "th",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#00a87b",
    categories: ["shopping", "health", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops launcher icons to its own shape; this copy keeps the
      // mark inside the safe zone so no crop cuts into it.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the installed icon and these are the three things worth
    // going straight to.
    shortcuts: [
      { name: "ช้อปสินค้า", short_name: "ช้อป", url: "/shop", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "ตะกร้าของฉัน", short_name: "ตะกร้า", url: "/cart", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "คำสั่งซื้อของฉัน", short_name: "คำสั่งซื้อ", url: "/account/orders", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
