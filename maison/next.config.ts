import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return ["/home", "/today", "/market", "/pack", "/maison", "/cards", "/ranks"].map((source) => ({
      source,
      destination: "/learn",
      permanent: false,
    }));
  },
};

export default nextConfig;
