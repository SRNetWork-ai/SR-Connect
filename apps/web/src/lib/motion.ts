/**
 * پالت حرکت مشترک.
 *
 * چرا یک فایل: اگر هر کامپوننت spring خودش را بنویسد، حس اپ تکه‌تکه می‌شود.
 * همه‌ی حرکت‌ها از همین چند پریست می‌آیند تا کل اپ یک ریتم داشته باشد.
 */
import type { Transition, Variants } from "framer-motion";

/** برای جابه‌جایی و ظاهر شدن پنل‌ها — سریع ولی نرم. */
export const springSoft: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.7 };

/** برای دکمه‌ها و آیکون‌ها — تند و قاطع. */
export const springSnappy: Transition = { type: "spring", stiffness: 620, damping: 34, mass: 0.5 };

/** برای لایه‌های بزرگ (نما‌ها) — کشسانی کم تا سرگیجه نیاورد. */
export const springCalm: Transition = { type: "spring", stiffness: 260, damping: 30 };

export const easeOut: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };
export const easeQuick: Transition = { duration: 0.14, ease: [0.22, 1, 0.36, 1] };

/** ظاهر شدن از پایین؛ برای آیتم‌های لیست و کارت‌ها. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -4, transition: easeQuick },
};

/** ظاهر شدن با مقیاس؛ برای منو، پاپ‌اور و دیالوگ. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, scale: 0.96, y: 4, transition: easeQuick },
};

/** جابه‌جایی بین نما‌های اصلی اپ (گفت‌وگو / آپدیت / تنظیمات). */
export const viewSwap: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: springCalm },
  exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: easeQuick },
};

/** فشار دادن: همه‌ی دکمه‌های تعاملی همین حس را دارند. */
export const tap = { scale: 0.95 } as const;
export const tapSoft = { scale: 0.975 } as const;

/** چیدن آیتم‌های یک لیست با تأخیر پله‌ای. */
export function stagger(step = 0.035, delay = 0): Transition {
  return { staggerChildren: step, delayChildren: delay };
}
