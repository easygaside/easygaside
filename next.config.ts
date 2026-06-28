import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qimwyprjnlejefeukuuy.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    // Allow large Server Action / route payloads (full GAS file sets pushed to the API).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    return [
      // The closed-beta page is retired — send anyone landing on /beta to the home page.
      { source: "/beta", destination: "/", permanent: false },
    ];
  },
  // Baseline security headers (SECURITY-TODO M-4). A full nonce-based script CSP is still a
  // separate, larger task (Monaco, Supabase, and the preview iframe need careful allowances), so
  // we deliberately do NOT set `script-src`/`default-src` here. The CSP below only locks framing
  // and forces https — both safe for the IDE — and doubles as a legitimacy signal for the domain.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // 2-year HSTS + preload (eligible for the browser preload list once submitted).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Modern framing lock (complements X-Frame-Options) + auto-upgrade any http subresource.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; upgrade-insecure-requests" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
