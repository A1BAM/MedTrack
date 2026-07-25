import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { MED_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `${MED_NAME} — MedTrack`,
  description: "Personal medication effectiveness tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <div className="mx-auto w-full max-w-md px-4 pt-6 pb-32">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
