import { expect, test, type Page } from "@playwright/test";

/** باز کردن اپ با نشستِ از پیش ذخیره‌شده (auth.setup.ts). */
async function openApp(page: Page) {
  await page.goto("/app");
  await expect(page.getByTestId("composer")).toBeVisible();
}

/**
 * پیام را می‌فرستد و ردیف آن را برمی‌گرداند.
 * `match` برای پیام‌های مارک‌داونی لازم است، چون متن رندرشده با متن خام فرق دارد.
 */
async function send(page: Page, text: string, match: string = text) {
  const composer = page.getByTestId("composer");
  await composer.fill(text);
  await composer.press("Enter");
  const row = page.getByTestId("message").filter({ hasText: match }).last();
  await expect(row).toBeVisible();
  return row;
}

test.describe("جریان اصلی SR-Connect", () => {
  test("سلامت سرور و هدرهای امنیتی", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();

    const page = await request.get("/login");
    const headers = page.headers();
    expect(headers["content-security-policy"]).toContain("script-src");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("ورود و ارسال پیام", async ({ page }) => {
    await openApp(page);
    await send(page, `پیام تست ${Date.now()}`);
  });

  test("ری‌اکشن اضافه و کم می‌شود", async ({ page }) => {
    await openApp(page);
    const row = await send(page, `ری‌اکشن ${Date.now()}`);

    await row.hover();
    await row.getByTestId("quick-react").first().click();
    await expect(row.getByTestId("reaction")).toHaveCount(1);

    await row.getByTestId("reaction").first().click();
    await expect(row.getByTestId("reaction")).toHaveCount(0);
  });

  test("ویرایش پیام برچسب ویرایش‌شده می‌گیرد", async ({ page }) => {
    await openApp(page);
    const stamp = Date.now();
    const row = await send(page, `قبل از ویرایش ${stamp}`);

    await row.hover();
    await row.getByTestId("msg-edit").click();
    // لوکیتور را سطح صفحه می‌گیریم؛ بعد از fill متنِ ردیف عوض می‌شود و فیلتر hasText دیگر نمی‌گیرد.
    const box = page.getByTestId("edit-box");
    await expect(box).toBeVisible();
    await box.fill(`بعد از ویرایش ${stamp}`);
    await box.press("Enter");

    await expect(
      page.getByTestId("message").filter({ hasText: `بعد از ویرایش ${stamp}` }),
    ).toBeVisible();
    await expect(page.getByText("(ویرایش‌شده)").last()).toBeVisible();
  });

  test("پاسخ به پیام پیش‌نمایش می‌سازد", async ({ page }) => {
    await openApp(page);
    const stamp = Date.now();
    const row = await send(page, `اصل پیام ${stamp}`);

    await row.hover();
    await row.getByTestId("msg-reply").click();
    await expect(page.getByText("پاسخ به")).toBeVisible();

    await send(page, `جواب ${stamp}`);
    await expect(page.getByText(`اصل پیام ${stamp}`).last()).toBeVisible();
  });

  test("مارک‌داون رندر می‌شود", async ({ page }) => {
    await openApp(page);
    const stamp = Date.now();
    await send(page, `**پررنگ${stamp}** و \`کد${stamp}\``, `پررنگ${stamp}`);
    // last() چون موقع جایگزینی پیام خوش‌بینانه با پیام سرور، لحظه‌ای هر دو در DOM هستند.
    await expect(page.locator("strong", { hasText: `پررنگ${stamp}` }).last()).toBeVisible();
    await expect(page.locator("code", { hasText: `کد${stamp}` }).last()).toBeVisible();
  });

  test("حذف پیام با تأیید", async ({ page }) => {
    await openApp(page);
    const text = `حذف شود ${Date.now()}`;
    const row = await send(page, text);

    await row.hover();
    await row.getByTestId("msg-delete").click();
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByTestId("message").filter({ hasText: text })).toHaveCount(0);
  });

  /**
   * محافظ رگرسیون: هر استثنای سمت کلاینت (حلقه‌ی بی‌نهایت رندر، hydration mismatch،
   * چانک خراب) کل صفحه را سفید می‌کند. اینجا همه‌ی مسیرها را باز می‌کنیم و مطمئن
   * می‌شویم هیچ خطای رانتایمی رخ نمی‌دهد.
   */
  test("هیچ مسیری استثنای سمت کلاینت ندارد", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()} → ${e.message}`));
    const crash = page.getByText("Application error", { exact: false });

    for (const path of ["/", "/app", "/app/settings", "/app/updates"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1_500);
      await expect(crash, `صفحه‌ی ${path} کرش کرد`).toHaveCount(0);
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });
});

/** صفحه‌های مهمان: بدون نشست باز می‌شوند و نباید کرش کنند. */
test.describe("صفحه‌های مهمان", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("ورود و ثبت‌نام بدون خطای کلاینت باز می‌شوند", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()} → ${e.message}`));

    for (const path of ["/", "/login", "/register"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1_500);
      await expect(
        page.getByText("Application error", { exact: false }),
        `صفحه‌ی ${path} کرش کرد`,
      ).toHaveCount(0);
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
