import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionProvider } from "@/components/MotionProvider";
import { SwRegistrar } from "@/components/SwRegistrar";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const vazirmatn = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — گفت‌وگو و صوت روی سرور خودت`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "کلاینت گفت‌وگوی متنی و صوتی با تجربه‌ی دیسکورد و هسته‌ی صوتی تیم‌اسپیک، میزبانی‌شده روی سرور شخصی.",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
};

/**
 * CSP با nonce فقط روی رندر داینامیک کار می‌کند: Next باید هر بار
 * nonce درخواست را روی تگ‌های script بگذارد. صفحه‌های این اپ هم عملاً
 * داینامیک‌اند (همه‌چیز بعد از ورود از API می‌آید)، پس هزینه‌ای ندارد.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#1e1f22",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="antialiased">
        <SwRegistrar />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
