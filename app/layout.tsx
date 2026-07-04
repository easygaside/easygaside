import type { Metadata } from "next";
import { headers } from "next/headers";
import { Prompt } from "next/font/google";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import "./globals.css";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves all relative OG/canonical URLs to the live domain (needed for correct social previews
  // and canonical tags). Override per-environment with NEXT_PUBLIC_SITE_URL.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://easygaside.tech"),
  title: "EasyGAS IDE — AI builder for Google Apps Script",
  description:
    "Chat with AI to build Google Apps Script tools, preview live, and deploy to your own Google account.",
  openGraph: {
    type: "website",
    siteName: "EasyGAS IDE",
    title: "EasyGAS — สร้างเครื่องมือบน Google Apps Script ด้วย AI",
    description:
      "คุยกับ AI เพื่อสร้างเครื่องมือบน Google Apps Script พรีวิวสด แล้วกดเดียว deploy เข้าบัญชี Google ของคุณเอง",
  },
  icons: {
    icon: [
      { url: "/icon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/icon/apple-icon-180x180.png", sizes: "180x180" }],
    shortcut: ["/icon/favicon.ico"],
  },
};

// Set the theme class before first paint to avoid a flash. Defaults to light; dark only when the
// user explicitly chose it (stored in localStorage by ThemeToggle).
const NO_FLASH_THEME = `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <head>
        {/* suppressHydrationWarning: React strips `nonce` from the client tree for security, so the
            server (with nonce) vs client (without) attribute always "mismatches" — expected, not a bug. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
