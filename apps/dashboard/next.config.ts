import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@appbase/types", "@appbase/sdk"],
};

export default nextConfig;
