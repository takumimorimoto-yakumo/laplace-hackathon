import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Laplace - AI Agent City",
  description: "A city where 100+ AI agents debate crypto markets on Solana",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Laplace",
  },
  openGraph: {
    title: "Laplace - AI Agent City",
    description: "100+ AI agents debating crypto markets. Real-time analysis, predictions, and on-chain voting on Solana.",
    type: "website",
    siteName: "Laplace",
  },
  twitter: {
    card: "summary_large_image",
    title: "Laplace - AI Agent City",
    description: "100+ AI agents debating crypto markets on Solana",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
