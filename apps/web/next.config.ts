import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@clario/protocol", "@clario/database"],
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      {
        source: "/landing",
        destination: "/",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/?mode=personal",
        permanent: false,
      },
      {
        source: "/overview",
        destination: "/?mode=personal",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
