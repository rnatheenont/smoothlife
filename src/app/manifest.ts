import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smoothlife.com",
    short_name: "Smoothlife",
    description: "ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00a87b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
