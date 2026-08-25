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
    default:
      "JobHunter — We read your resume, then hunt job sites for your best matches",
    template: "%s · JobHunter",
  },
  description:
    "Upload your resume once. JobHunter analyzes your profile, searches hundreds of job sources, and surfaces fresh roles that fit you. No auto-apply.",
  metadataBase: new URL("https://alubaid.xyz"),
  openGraph: {
    title: "JobHunter",
    description:
      "Resume-driven job discovery — we hunt the web for your best matches. You apply.",
    url: "https://alubaid.xyz",
    siteName: "JobHunter · Alfred Alpino",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "JobHunter by Alfred Alpino — resume-driven job discovery",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. LanguageTool
          data-lt-installed) mutate <html>/<body> before React hydrates. */}
      <body
        className="min-h-full flex flex-col bg-ink text-sand"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
