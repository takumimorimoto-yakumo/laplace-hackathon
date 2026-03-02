import type { Metadata } from "next";
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
  themeColor: "#7c3aed",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
