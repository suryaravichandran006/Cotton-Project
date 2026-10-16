import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.ANALYSIS_ONLY === "true" ? "standalone" : undefined,
};

export default nextConfig;
