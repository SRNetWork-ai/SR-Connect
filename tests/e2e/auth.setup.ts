import { expect, test as setup } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME ?? "e2e";
const PASSWORD = process.env.E2E_PASSWORD ?? "E2e-passw0rd!";

export const AUTH_STATE = "tests/e2e/.auth/user.json";

/**
 * یک بار وارد می‌شویم و کوکی نشست را ذخیره می‌کنیم.
 * دلیل: لاگین سقف نرخ دارد (۸ تلاش در دقیقه). اگر هر تست جداگانه لاگین کند،
 * اجرای پشت‌سرهم سوییت به ۴۲۹ می‌خورد و تست‌ها الکی قرمز می‌شوند.
 */
setup("ورود یک‌باره و ذخیره‌ی نشست", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا نام کاربری").fill(USERNAME);
  await page.getByLabel("گذرواژه").fill(PASSWORD);
  await page.getByRole("button", { name: /ورود/ }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });
  await expect(page.getByTestId("composer")).toBeVisible();
  await page.context().storageState({ path: AUTH_STATE });
});
