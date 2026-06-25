import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Real WeChat/Alipay bill exports can exceed Next's default Server Action body limit.
    serverActions: {
      bodySizeLimit: "10mb"
    }
  }
};

export default nextConfig;
