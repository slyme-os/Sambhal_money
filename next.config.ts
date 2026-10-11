import type { NextConfig } from "next";

// NEXT_EXPORT=1 builds static files into out/ for the Android app (see
// capacitor.config.ts). The regular web build is unchanged.
const exportStatic = process.env.NEXT_EXPORT === "1";

const nextConfig: NextConfig = exportStatic
  ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
  : {};

export default nextConfig;
