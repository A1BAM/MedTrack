import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

// Self-hosted at build time, so there's no third-party request at runtime and
// no flash of fallback type.
const ui = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});
const display = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

// Deliberately generic: this metadata is also served on the public login
// page, so it mustn't name the medication. Search engines are told to stay
// away too.
export const metadata: Metadata = {
  title: "MedTrack",
  description: "Private tracker",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#141310" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${ui.variable} ${display.variable}`}>
      <body className="min-h-dvh antialiased">
        <div className="mx-auto w-full max-w-md px-5 pt-8 pb-32">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
