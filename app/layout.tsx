import type { Metadata } from "next";
import { Cairo, Noto_Sans_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import { config } from "@/lib/config";
import "./globals.css";

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: config.appName,
    template: `%s | ${config.appName}`,
  },
  description: "تصفّح قائمة ديبو واطلب بسهولة — الدفع نقداً عند الاستلام",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${notoArabic.variable} ${cairo.variable} h-full`}
    >
      <body className="min-h-full overflow-x-clip bg-[#f7f6f4] font-sans text-stone-900 antialiased">
        {children}
        <Toaster position="top-center" richColors dir="rtl" />
      </body>
    </html>
  );
}
