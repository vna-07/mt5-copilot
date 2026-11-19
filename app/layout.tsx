import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MT5 Co-Pilot",
  description: "SAST session clock, quant setups, and step-by-step MT5 Mobile guidance.",
};

export const viewport: Viewport = {
  themeColor: "#09090E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}