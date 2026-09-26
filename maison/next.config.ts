import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/home", destination: "/today", permanent: false },
      { source: "/cards", destination: "/maison", permanent: false },
    ];
  },
};

export default nextConfig;
