import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow large Server Action / route payloads (full GAS file sets pushed to the API).
    serverActions: { bodySizeLimit: "4mb" },
  },
  // Baseline security headers (SECURITY-TODO M-4). Nonce-based CSP is a separate, larger task —
  // a strict CSP would need careful allowances for Monaco, Supabase, and the preview iframe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
