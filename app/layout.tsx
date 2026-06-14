import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EasyGAS IDE — AI builder for Google Apps Script",
  description:
    "Chat with AI to build Google Apps Script tools, preview live, and deploy to your own Google account.",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
