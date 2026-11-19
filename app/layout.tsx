import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
// @ts-expect-error CSS imports are handled by Next.js at build time.
import "./globals.css";
import BottomNav from "@/components/BottomNav";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "MT5 Co-Pilot",
  description: "Live SAST session co-pilot.",
};

export const viewport: Viewport = {
  themeColor: "#09090E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased font-sans bg-canvas text-alabaster selection:bg-lavender/30">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}