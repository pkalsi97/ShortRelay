import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    domains: [process.env.NEXT_PUBLIC_CDN_DOMAIN!],
    unoptimized: true,
  },
};

export default nextConfig;