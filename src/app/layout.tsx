import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JobHunter — Fresh jobs. Your resume. Your move.",
    template: "%s · JobHunter",
  },
  description:
    "Resume-first worldwide job filter by Alfredterminal. Match roles by region and skills. Keep only fresh ads (≤14 days). No auto-apply.",
  metadataBase: new URL("https://alfredterminal.xyz"),
  openGraph: {
    title: "JobHunter",
    description:
      "Resume-first worldwide job hunt — fresh listings only, no auto-apply.",
    url: "https://alfredterminal.xyz",
    siteName: "JobHunter · Alfredterminal",
    images: [{ url: "/logo.png", width: 1024, height: 1024, alt: "JobHunter" }],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-sand">{children}</body>
    </html>
  );
}
