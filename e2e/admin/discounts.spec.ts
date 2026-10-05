import { expect, test, type Page } from "@playwright/test";
import { logInFromStart, requireAdminCredentials } from "./helpers";
import { createShop, post, type Shop } from "./shop";

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByLabel("Search…").fill(option);
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function codeDiscount(page: Page, shop: Shop, code: string, percent: number) {
  return post(page, "/api/admin/discounts", {
    name: { ro: `Cod ${code}` }, kind: "Percentage", percent, buyQuantity: null, freeQuantity: null, activation: "Code", code,
    startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: null, minOrderAmount: null, usageLimitTotal: null, usageLimitPerCustomer: null,
    isActive: true, targets: [{ type: "Product", targetId: shop.product.id }],
  });
}

async function addToCart(page: Page, sku: string) {
  await page.getByLabel("Add a product: type SKU or name").fill(sku);
  await page.getByRole("option").filter({ hasText: sku }).click();
}

test.describe("AP / AS — admin discounts and settings", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);
  });

  test("AP-02 AP-01 AP-05 an automatic discount is created and the try-a-cart panel shows the offers", async ({ page }) => {
    const shop = await createShop(page);
    const code = `TRY${shop.id}`.toUpperCase();
    await codeDiscount(page, shop, code, 20);

    await page.getByRole("link", { name: "Discounts" }).click();
    await page.getByRole("link", { name: "New discount" }).click();
    await page.getByLabel("discount-name RO").fill(`Toamnă ${shop.id}`);
    await page.getByLabel("Percent").fill("10");
    await choose(page, "Applies to #1", "Product");
    await choose(page, "Which one #1", `Shadow ${shop.id}`);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/admin\/discounts$/);
    const row = page.getByRole("row").filter({ hasText: `Toamnă ${shop.id}` });
    await expect(row).toContainText("−10 %");
    await expect(row).toContainText("Automatically");
    await expect(row).toContainText("Product");
    await expect(row).toContainText("Active");
    await expect(page.getByRole("row").filter({ hasText: `Cod ${code}` })).toContainText(code);

    await addToCart(page, shop.sku("xl"));
    await page.getByLabel("Promo code", { exact: true }).fill(code.toLowerCase());
    await page.getByRole("button", { name: "Show offers" }).click();
    const offers = page.getByRole("list", { name: "Offers" });
    await expect(offers.getByRole("listitem")).toHaveCount(2);
    await expect(offers.getByRole("listitem").filter({ hasText: "Sales" })).toContainText("585 MDL");
    await expect(offers.getByRole("listitem").filter({ hasText: code })).toContainText("520 MDL");
    await expect(offers.getByRole("listitem").filter({ hasText: code })).toContainText("Best");
    await offers.getByRole("listitem").filter({ hasText: "Sales" }).getByRole("button").click();
    await expect(page.getByTestId("cart-total")).toHaveText("585 MDL");

    await page.getByLabel("Promo code", { exact: true }).fill("NOSUCHCODE");
    await page.getByRole("button", { name: "Show offers" }).click();
    await expect(page.getByTestId("cart-preview")).toContainText("Code NOSUCHCODE does not exist.");
  });

  test("AP-03 every problem with a discount is listed at once", async ({ page }) => {
    await page.goto("/admin/discounts/new");
    await page.getByLabel("discount-name RO").fill("Greșit");
    await page.getByLabel("Percent").fill("150");
    await choose(page, "How it's applied", "With a promo code");
    await page.getByLabel("Code").fill("x");
    await page.getByLabel("Starts").fill("2026-10-10T10:00");
    await page.getByLabel("Ends").fill("2026-10-01T10:00");
    await page.getByRole("button", { name: "Save" }).click();

    const problems = page.getByRole("alert").filter({ hasText: "Not saved" });
    await expect(problems).toContainText("Percent:");
    await expect(problems).toContainText("Code:");
    await expect(problems).toContainText("Ends: Must be after the start.");
    await expect(page.getByLabel("Percent")).toHaveValue("150");
    await expect(page).toHaveURL(/\/discounts\/new$/);
  });

  test("AP-04 a discount is switched off, an unused one deleted, a used one refused", async ({ page }) => {
    const shop = await createShop(page);
    const unused = await codeDiscount(page, shop, `OFF${shop.id}`.toUpperCase(), 10);
    const usedCode = `USED${shop.id}`.toUpperCase();
    const used = await codeDiscount(page, shop, usedCode, 10);
    const cart = [{ variantId: shop.variant("xl"), quantity: 1 }];
    const quote = await post(page, "/api/checkout/quote", { lines: cart, promoCode: usedCode, selectedOfferId: null, deliveryMethod: "NovaPostBranch" });
    const offer = quote.pricing.offers.find((o: { code: string | null }) => o.code === usedCode);
    const priced = await post(page, "/api/checkout/quote", { lines: cart, promoCode: usedCode, selectedOfferId: offer.id, deliveryMethod: "NovaPostBranch" });
    await post(page, "/api/checkout/orders", {
      lines: cart, promoCode: usedCode, selectedOfferId: offer.id, expectedTotal: priced.total,
      customer: { firstName: "Ana", lastName: "Popescu", phone: "069 555 123", email: "ana@example.com", note: null },
      delivery: { method: "NovaPostBranch", city: "Chișinău", point: "Branch 5" }, paymentMethod: "CashOnDelivery",
    });

    await page.goto("/admin/discounts");
    const offName = `Cod ${unused.code}`;
    await page.getByRole("switch", { name: `On ${offName}` }).click();
    await expect(page.getByRole("row").filter({ hasText: offName })).toContainText("Off");

    await page.goto(`/admin/discounts/${unused.id}`);
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/admin\/discounts$/);
    await expect(page.getByRole("row").filter({ hasText: `OFF${shop.id}`.toUpperCase() })).toHaveCount(0);

    await page.goto(`/admin/discounts/${used.id}`);
    await expect(page.getByText("Used in 1 order.")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("This discount was already used in orders. Deactivate it instead.")).toBeVisible();
  });

  test("AS-01 delivery fee and free-from are saved, a negative fee is explained", async ({ page }) => {
    try {
      await page.getByRole("link", { name: "Settings" }).click();
      const nova = page.getByTestId("delivery-NovaPostBranch");
      await nova.getByLabel("Fee Nova Post branch").fill("-5");
      await nova.getByRole("button", { name: "Save" }).click();
      await expect(nova.getByRole("alert").filter({ hasText: "Not saved" })).toContainText("Fee: Cannot be negative.");

      await nova.getByLabel("Fee Nova Post branch").fill("60");
      await nova.getByLabel("Free from Nova Post branch").fill("500");
      await nova.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Saved").first()).toBeVisible();
      await page.reload();
      await expect(page.getByTestId("delivery-NovaPostBranch").getByLabel("Fee Nova Post branch")).toHaveValue("60");
      await expect(page.getByTestId("delivery-NovaPostBranch").getByLabel("Free from Nova Post branch")).toHaveValue("500");
      await expect(page.getByTestId("payment-CashOnDelivery")).toContainText("Cash on delivery");
    } finally {
      await page.request.put("/api/admin/checkout/delivery-methods/NovaPostBranch", { data: { isEnabled: true, fee: 50, freeFrom: 400, sortOrder: 1 } });
    }
  });
});
