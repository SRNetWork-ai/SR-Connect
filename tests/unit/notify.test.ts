import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * قواعد اعلان دسکتاپ.
 * اینجا تصمیم «اعلان بدهم یا نه» تست می‌شود، نه خود API مرورگر.
 */

interface FakeWindow {
  Notification: { permission: string };
  localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void };
}

function install(opts: {
  permission?: string;
  pref?: string | null;
  visibility?: string;
  noNotification?: boolean;
}) {
  const store = new Map<string, string>();
  if (opts.pref != null) store.set("sr:desktop-notifications", opts.pref);

  const win: Partial<FakeWindow> = {
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    },
  };
  if (!opts.noNotification) win.Notification = { permission: opts.permission ?? "granted" };

  vi.stubGlobal("window", win);
  vi.stubGlobal("Notification", win.Notification);
  vi.stubGlobal("document", { visibilityState: opts.visibility ?? "hidden" });
}

async function load() {
  vi.resetModules();
  return import("@/lib/notify");
}

afterEach(() => vi.unstubAllGlobals());

describe("shouldNotify", () => {
  it("با اجازه‌ی گرفته‌شده و پنجره‌ی پنهان اعلان می‌دهد", async () => {
    install({ visibility: "hidden" });
    const { shouldNotify } = await load();
    expect(shouldNotify({ channelVisible: false, dnd: false })).toBe(true);
  });

  it("وقتی کاربر جلوی همان کانال نشسته، اعلان نمی‌دهد", async () => {
    install({ visibility: "visible" });
    const { shouldNotify } = await load();
    expect(shouldNotify({ channelVisible: true, dnd: false })).toBe(false);
  });

  it("پنجره باز است ولی کانال دیگری فعال است → اعلان می‌دهد", async () => {
    install({ visibility: "visible" });
    const { shouldNotify } = await load();
    expect(shouldNotify({ channelVisible: false, dnd: false })).toBe(true);
  });

  it("در حالت مزاحم نشوید هیچ اعلانی نمی‌دهد", async () => {
    install({ visibility: "hidden" });
    const { shouldNotify } = await load();
    expect(shouldNotify({ channelVisible: false, dnd: true })).toBe(false);
  });

  it("بدون اجازه‌ی مرورگر اعلان نمی‌دهد", async () => {
    install({ permission: "default", visibility: "hidden" });
    const { shouldNotify } = await load();
    expect(shouldNotify({ channelVisible: false, dnd: false })).toBe(false);
  });

  it("اگر کاربر خاموشش کرده باشد، اعلان نمی‌دهد", async () => {
    install({ pref: "off", visibility: "hidden" });
    const { shouldNotify } = await load();
    expect(shouldNotify({ channelVisible: false, dnd: false })).toBe(false);
  });

  it("پیش‌فرض روشن است — بدون هیچ تنظیم ذخیره‌شده هم اعلان می‌دهد", async () => {
    install({ pref: null, visibility: "hidden" });
    const { desktopNotificationsEnabled } = await load();
    expect(desktopNotificationsEnabled()).toBe(true);
  });

  it("روی مرورگر بدون Notification ساکت می‌ماند و خطا نمی‌دهد", async () => {
    install({ noNotification: true, visibility: "hidden" });
    const { shouldNotify, notifyPermission } = await load();
    expect(notifyPermission()).toBe("unsupported");
    expect(shouldNotify({ channelVisible: false, dnd: false })).toBe(false);
  });
});
