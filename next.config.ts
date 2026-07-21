import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // A stray package-lock.json in the home directory makes Next.js
    // mis-infer the workspace root — pin it to this project.
    root: __dirname,
  },
};

export default nextConfig;
