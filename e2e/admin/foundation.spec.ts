import { devices, expect, test } from "@playwright/test";
import { admin, logIn, logInFromStart, requireAdminCredentials } from "./helpers";
import { createShop, placeOrder } from "./shop";

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

  test("AD-12 dashboard shows what needs attention", async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);
    const shop = await createShop(page, 6);
    const newTile = page.getByTestId("tile-new").locator("span").last();
    await expect(newTile).toHaveText(/^\d+$/);
    const before = Number(await newTile.textContent());
    const order = await placeOrder(page, shop, [["xl", 2]]);

    await page.reload();
    await expect(page.getByTestId("tile-new").locator("span").last()).toHaveText(String(before + 1));
    await expect(page.getByRole("list", { name: "Latest orders" })).toContainText(`#${order.number}`);
    await expect(page.getByRole("list", { name: "Low stock (5 or fewer)" }).getByRole("listitem").first()).toContainText("available");

    await page.getByRole("link", { name: "All low stock" }).click();
    await expect(page.getByRole("checkbox", { name: "Low stock (5 or fewer available)" })).toBeChecked();
    await page.getByLabel("Search SKU or product").fill(`SHD-${shop.id}`.toUpperCase());
    const xl = page.getByRole("row").filter({ hasText: shop.sku("xl") });
    await expect(xl.getByRole("cell").last()).toHaveText("4");
    await expect(page.getByRole("row").filter({ hasText: shop.sku("m") })).toHaveCount(0);

    await page.goto("/admin");
    await page.getByTestId("tile-new").click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
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
