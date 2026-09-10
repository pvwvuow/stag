import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /**
   * فاز ۷.۱ — type errors must never silently ship again: the build now
   * FAILS on any TypeScript error, and StrictMode is on so lifecycle bugs
   * (double-effect, stale refs) surface in dev instead of production.
   */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
