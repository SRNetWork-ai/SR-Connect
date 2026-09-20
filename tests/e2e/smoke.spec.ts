import { expect, test, type Page } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME ?? "e2e";
const PASSWORD = process.env.E2E_PASSWORD ?? "E2e-passw0rd!";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل یا نام کاربری").fill(USERNAME);
  await page.getByLabel("گذرواژه").fill(PASSWORD);
  await page.getByRole("button", { name: /ورود/ }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });
  await expect(page.getByTestId("composer")).toBeVisible();
}

async function send(page: Page, text: string) {
  const composer = page.getByTestId("composer");
  await composer.fill(text);
  await composer.press("Enter");
  const row = page.getByTestId("message").filter({ hasText: text }).last();
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
    await signIn(page);
    const text = `پیام تست ${Date.now()}`;
    await send(page, text);
  });

  test("ری‌اکشن اضافه و کم می‌شود", async ({ page }) => {
    await signIn(page);
    const row = await send(page, `ری‌اکشن ${Date.now()}`);

    await row.hover();
    await row.getByTestId("quick-react").first().click();
    await expect(row.getByTestId("reaction")).toHaveCount(1);

    await row.getByTestId("reaction").first().click();
    await expect(row.getByTestId("reaction")).toHaveCount(0);
  });

  test("ویرایش پیام برچسب ویرایش‌شده می‌گیرد", async ({ page }) => {
    await signIn(page);
    const stamp = Date.now();
    const row = await send(page, `قبل از ویرایش ${stamp}`);

    await row.hover();
    await row.getByTestId("msg-edit").click();
    const box = row.getByTestId("edit-box");
    await box.fill(`بعد از ویرایش ${stamp}`);
    await box.press("Enter");

    await expect(
      page.getByTestId("message").filter({ hasText: `بعد از ویرایش ${stamp}` }),
    ).toBeVisible();
    await expect(page.getByText("(ویرایش‌شده)").last()).toBeVisible();
  });

  test("پاسخ به پیام پیش‌نمایش می‌سازد", async ({ page }) => {
    await signIn(page);
    const stamp = Date.now();
    const row = await send(page, `اصل پیام ${stamp}`);

    await row.hover();
    await row.getByTestId("msg-reply").click();
    await expect(page.getByText("پاسخ به")).toBeVisible();

    await send(page, `جواب ${stamp}`);
    await expect(page.getByText(`اصل پیام ${stamp}`).last()).toBeVisible();
  });

  test("مارک‌داون رندر می‌شود", async ({ page }) => {
    await signIn(page);
    const stamp = Date.now();
    await send(page, `**پررنگ${stamp}** و \`کد${stamp}\``);
    await expect(page.locator("strong", { hasText: `پررنگ${stamp}` })).toBeVisible();
    await expect(page.locator("code", { hasText: `کد${stamp}` })).toBeVisible();
  });

  test("حذف پیام با تأیید", async ({ page }) => {
    await signIn(page);
    const text = `حذف شود ${Date.now()}`;
    const row = await send(page, text);

    await row.hover();
    await row.getByTestId("msg-delete").click();
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByTestId("message").filter({ hasText: text })).toHaveCount(0);
  });
});
