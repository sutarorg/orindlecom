import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keeps server actions within a predictable payload size for the contact form.
    serverActions: { bodySizeLimit: "256kb" },
  },
};

export default nextConfig;
