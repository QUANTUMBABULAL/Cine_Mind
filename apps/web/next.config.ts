import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the project root so Next.js ignores unrelated lockfiles in parent folders.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
