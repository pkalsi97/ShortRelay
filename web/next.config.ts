import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [process.env.NEXT_PUBLIC_CDN_DOMAIN!],
  },
};

export default nextConfig;