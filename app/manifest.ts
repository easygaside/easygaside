import type { MetadataRoute } from "next";

/** PWA manifest — served at /manifest.webmanifest; Next auto-links it. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EasyGAS IDE",
    short_name: "EasyGAS",
    description: "AI builder for Google Apps Script — chat, preview, deploy to your own Google account.",
    start_url: "/projects",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10b981",
    icons: [
      { src: "/icon/android-icon-144x144.png", sizes: "144x144", type: "image/png" },
      { src: "/icon/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon/ms-icon-310x310.png", sizes: "310x310", type: "image/png" },
    ],
  };
}
