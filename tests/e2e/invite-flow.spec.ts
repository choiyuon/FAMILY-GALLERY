import { expect, test } from "@playwright/test";
import { resetTestUsers } from "./_setup";

test.beforeEach(resetTestUsers);

test("admin invites a new family member and they sign up", async ({ browser }) => {
  // Admin issues an invite
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/login");
  await adminPage.getByLabel("이메일").fill("admin-e2e@example.com");
  await adminPage.getByLabel("비밀번호").fill("e2epassword");
  await adminPage.getByRole("button", { name: /들어가기/ }).click();
  await adminPage.goto("/admin");
  await adminPage.getByRole("button", { name: /초대 발급/ }).click();
  const code = await adminPage.locator("code").first().textContent();
  expect(code).toBeTruthy();
  const inviteUrl = code!.trim();

  // New user visits the invite link
  const newUserContext = await browser.newContext();
  const newUserPage = await newUserContext.newPage();
  await newUserPage.goto(inviteUrl);
  await newUserPage.getByLabel(/이름/).fill("새 가족");
  await newUserPage.getByLabel("이메일").fill("new@example.com");
  await newUserPage.getByLabel(/비밀번호/).fill("strongpass123");
  await newUserPage.getByRole("button", { name: /시작하기/ }).click();
  await expect(newUserPage).toHaveURL(/\/gallery/);
});

test("expired/invalid invite shows error", async ({ page }) => {
  await page.goto("/invite/not-a-real-token");
  await expect(page.getByRole("heading", { name: /사용할 수 없어요/ })).toBeVisible();
});
