import { expect, test } from "@playwright/test";
import { resetTestUsers } from "./_setup";

test.beforeEach(resetTestUsers);

test("member visiting /admin gets redirected to /gallery", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill("member-e2e@example.com");
  await page.getByLabel("비밀번호").fill("e2epassword");
  await page.getByRole("button", { name: /들어가기/ }).click();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/gallery/);
});

test("member calling POST /api/invites returns 403", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill("member-e2e@example.com");
  await page.getByLabel("비밀번호").fill("e2epassword");
  await page.getByRole("button", { name: /들어가기/ }).click();
  // Reuse the page's cookie jar
  const res = await page.request.post("/api/invites");
  expect(res.status()).toBe(403);
});
