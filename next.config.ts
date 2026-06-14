import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 0 spike: nothing special yet.
  // Phase 2 will add per-route `export const maxDuration = 800` + nodejs runtime
  // on /api/agent/* for the streaming agent loop (requires Vercel Pro + Fluid compute).
  experimental: {
    // Allow large Server Action / route payloads (full GAS file sets pushed to the API).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
