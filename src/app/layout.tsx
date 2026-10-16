import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { Logo } from "@/components/site-header";
import { isAnalysisOnly } from "@/lib/analysis-deployment";

export const metadata: Metadata = {
  title: { default: "Cotton Grade", template: "%s · Cotton Grade" },
  description: isAnalysisOnly() ? "Cotton photograph analysis, T1–T10 reference matching and experimental quality estimates." : "Progressive domain-adaptive transfer learning for fine-grained cotton cultivar identification from raw cotton fibre images.",
  applicationName: "Cotton Grade",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f7f4",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-card">Skip to content</a>
          <div className="flex min-h-screen flex-col">
            {isAnalysisOnly() ? <header className="border-b border-line bg-surface"><div className="mx-auto flex h-[72px] max-w-7xl items-center px-4 sm:px-6 lg:px-8"><Link href="/" aria-label="Cotton Grade home"><Logo /></Link></div></header> : <SiteHeader />}
            <main id="main" className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
