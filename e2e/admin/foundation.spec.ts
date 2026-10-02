import { devices, expect, test } from "@playwright/test";
import { admin, logIn, logInFromStart, requireAdminCredentials } from "./helpers";

test.describe("AD — admin foundation", () => {
  test("AD-01 wrong password shows a message and keeps the email", async ({ page }) => {
    await page.goto("/admin/login");
    await logIn(page, "someone@depad.local", "wrong-password");

    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password." })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("someone@depad.local");
  });

  test("AD-01 / AD-20 invalid input is shown under the field", async ({ page }) => {
    await page.goto("/admin/login");
    await logIn(page, "not-an-email", "");

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("AD-02 admin pages need a login and you come back where you wanted to go", async ({ page }) => {
    requireAdminCredentials();

    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/login\?returnTo=%2Fadmin%2Fsettings$/);

    await logIn(page);
    await expect(page).toHaveURL(/\/admin\/settings$/);
  });

  test("AD-03 expired session sends you to login with a message and back afterwards", async ({ page, context }) => {
    requireAdminCredentials();

    await context.addCookies([{ name: "depad_auth", value: "expired-session", url: "http://localhost:3000" }]);
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login\?expired=1&returnTo=%2Fadmin$/);
    await expect(page.getByRole("status")).toHaveText("Your session expired, please log in again.");

    await logIn(page);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("AD-04 logout ends the session", async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?returnTo=%2Fadmin$/);
  });

  test("AD-10 / AD-12 sidebar and dashboard show who is logged in", async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);

    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Dashboard" }))
      .toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("current-user")).toHaveText(admin.email);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});

test.describe("AD-11 on a phone", () => {
  test.use({ viewport: devices["iPhone 13"].viewport, isMobile: true, hasTouch: true });

  test("the sidebar becomes a menu button", async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);

    await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  });
});
