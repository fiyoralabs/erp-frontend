import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { GlobalNumberInputScrollFix } from "@/components/shared/global-number-input-scroll-fix";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiyora ERP",
  description: "Fiyora Enterprise Resource Planning",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <GlobalNumberInputScrollFix />
          {children}
          <Toaster richColors position="top-right" />
          <Analytics />
        </QueryProvider>
      </body>
    </html>
  );
}
