import { expect, test, type Page } from "@playwright/test";

export const admin = {
  email: process.env.E2E_ADMIN_EMAIL ?? "",
  password: process.env.E2E_ADMIN_PASSWORD ?? "",
};

export function requireAdminCredentials() {
  test.skip(!admin.email || !admin.password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (the local seeded admin).");
}

export async function logIn(page: Page, email = admin.email, password = admin.password) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function logInFromStart(page: Page) {
  await page.goto("/admin/login");
  await logIn(page);
  await expect(page).toHaveURL(/\/admin$/);
}
