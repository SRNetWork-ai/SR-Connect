export interface WelcomeScreen {
  enabled: boolean;
  title: string;
  description: string;
  /** کانال‌هایی که در کارت خوش‌آمد به تازه‌واردها پیشنهاد می‌شود. */
  channels: { channelId: string; description: string }[];
  rules: string[];
  buttonLabel: string;
}

export const WELCOME_DEFAULTS: WelcomeScreen = {
  enabled: false,
  title: "به سرور خوش آمدی",
  description: "چند قدم کوتاه تا شروع گفت‌وگو.",
  channels: [],
  rules: [],
  buttonLabel: "شروع کنیم",
};

export async function loadWelcome(): Promise<WelcomeScreen> {
  // ایمپورت تنبل تا این ماژول بدون اتصال به دیتابیس هم قابل استفاده باشد.
  const { one } = await import("@/lib/db/pool");
  const row = await one<{ value: Partial<WelcomeScreen> }>(
    `select value from settings where key = 'welcome_screen'`,
  );
  return { ...WELCOME_DEFAULTS, ...(row?.value ?? {}) };
}

/** ورودی کاربر همین‌جا بریده و پاک می‌شود تا هیچ متن بی‌انتها ذخیره نشود. */
export function sanitizeWelcome(input: Partial<WelcomeScreen>, base: WelcomeScreen): WelcomeScreen {
  return {
    enabled: input.enabled ?? base.enabled,
    title: (input.title ?? base.title).trim().slice(0, 80) || WELCOME_DEFAULTS.title,
    description: (input.description ?? base.description).trim().slice(0, 300),
    buttonLabel:
      (input.buttonLabel ?? base.buttonLabel).trim().slice(0, 32) || WELCOME_DEFAULTS.buttonLabel,
    rules: (input.rules ?? base.rules)
      .map((rule) => String(rule).trim().slice(0, 160))
      .filter(Boolean)
      .slice(0, 10),
    channels: (input.channels ?? base.channels)
      .filter((item) => Boolean(item?.channelId))
      .map((item) => ({
        channelId: String(item.channelId),
        description: String(item.description ?? "")
          .trim()
          .slice(0, 120),
      }))
      .slice(0, 5),
  };
}
