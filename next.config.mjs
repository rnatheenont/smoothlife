/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.smoothlife.com" },
      { protocol: "https", hostname: "smoothlife.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
