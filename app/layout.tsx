import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "easygas — AI builder for Google Apps Script",
  description:
    "Chat with AI to build Google Apps Script tools, preview live, and deploy to your own Google account.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
