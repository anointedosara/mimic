import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "MIMIC — Can you blend in, or will you be exposed?",
    template: "%s · MIMIC",
  },
  description:
    "MIMIC is a real-time multiplayer social deduction word game. Everyone gets the secret word — except the hidden imposters, who only get a hint. Discuss, deduce, and vote out the mimics.",
  keywords: ["MIMIC", "imposter game", "word game", "social deduction", "multiplayer", "party game"],
  authors: [{ name: "MIMIC" }],
  manifest: "/manifest.webmanifest",
  applicationName: "MIMIC",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MIMIC" },
  openGraph: {
    title: "MIMIC — Can you blend in, or will you be exposed?",
    description: "Real-time multiplayer imposter word game. Blend in or get exposed.",
    url: appUrl,
    siteName: "MIMIC",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MIMIC",
    description: "Real-time multiplayer imposter word game.",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
