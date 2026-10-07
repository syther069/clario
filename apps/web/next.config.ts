import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@clario/protocol", "@clario/database"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
