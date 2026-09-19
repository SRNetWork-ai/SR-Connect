import { SplashScreen } from "@/components/splash/SplashScreen";

export const metadata = { title: "در حال به‌روزرسانی…" };

/**
 * ریشه‌ی اپ = اسپلش.
 * هر بار که اپ باز می‌شود اول اینجا می‌آییم: بررسی نسخه، آپدیت، بعد ورود.
 */
export default function SplashPage() {
  return <SplashScreen theatrical />;
}
