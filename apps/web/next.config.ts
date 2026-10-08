import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@clario/protocol", "@clario/database"],
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
      {
        source: "/overview",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
