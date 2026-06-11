import { expect, test } from "@playwright/test";
import { resetTestUsers } from "./_setup";

test.beforeEach(resetTestUsers);

test("admin can log in and reach the gallery", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill("admin-e2e@example.com");
  await page.getByLabel("비밀번호").fill("e2epassword");
  await page.getByRole("button", { name: /들어가기/ }).click();
  await expect(page).toHaveURL(/\/gallery/);
  await expect(page.getByRole("heading", { name: "갤러리" })).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill("admin-e2e@example.com");
  await page.getByLabel("비밀번호").fill("WRONG");
  await page.getByRole("button", { name: /들어가기/ }).click();
  await expect(page.getByText(/올바르지 않습니다/)).toBeVisible();
});

test("unauthenticated visit to /gallery redirects to /login", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page).toHaveURL(/\/login/);
});
