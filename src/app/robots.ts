import { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/cart", "/checkout", "/api/", "/flash-sale/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
