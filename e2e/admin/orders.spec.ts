import { expect, test, type Page } from "@playwright/test";
import { logInFromStart, requireAdminCredentials } from "./helpers";
import { act, createShop, placeOrder } from "./shop";

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByLabel("Search…").fill(option);
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe("AO — admin orders", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);
  });

  test("AO-01 orders open on the to-handle tab with counts, and search finds by phone", async ({ page }) => {
    const shop = await createShop(page);
    const phone = "069 123 777";
    const fresh = await placeOrder(page, shop, [["xl", 1]], "CashOnDelivery", phone);
    const shipped = await placeOrder(page, shop, [["m", 1]], "CashOnDelivery", phone);
    await act(page, shipped.orderId, "confirm");
    await act(page, shipped.orderId, "pack", { locationId: shop.house1.id });
    await act(page, shipped.orderId, "ship", { waybillNumber: "20450000000000" });

    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Orders" }).click();
    await expect(page.getByRole("tab", { name: /To handle/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /To handle/ })).toContainText(/\d+/);

    await page.getByLabel("Search number, phone, name or email").fill(`Popescu ${shop.id}`);
    await expect(page.getByRole("row").filter({ hasText: `#${fresh.number}` })).toContainText("650 MDL");
    await expect(page.getByRole("row").filter({ hasText: `#${shipped.number}` })).toHaveCount(0);

    await page.getByRole("tab", { name: /Shipped/ }).click();
    await expect(page).toHaveURL(/tab=shipped/);
    const row = page.getByRole("row").filter({ hasText: `#${shipped.number}` });
    await expect(row).toContainText("Shipped");
    await expect(row).toContainText("Cash on delivery");
    await expect(row).toContainText("Not paid");
  });

  test("AO-02 AO-03 AO-05 the order page shows everything and walks through every step", async ({ page }) => {
    const shop = await createShop(page);
    const order = await placeOrder(page, shop, [["xl", 1], ["m", 1]]);

    await page.goto(`/admin/orders/${order.orderId}`);
    await expect(page.getByRole("heading", { name: `#${order.number}` })).toBeVisible();
    await expect(page.getByText(`Ana Popescu ${shop.id}`)).toBeVisible();
    await expect(page.getByText("Chișinău, Branch 5")).toBeVisible();
    await expect(page.getByText("Sunați înainte")).toBeVisible();
    await expect(page.getByText(shop.sku("xl"))).toBeVisible();
    await expect(page.getByText(`Mărime ${shop.id}: XL`)).toBeVisible();
    await expect(page.getByTestId("order-total")).toHaveText("1.100 MDL");

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Confirmed — pack it from a house.")).toBeVisible();

    await page.getByRole("button", { name: "Pack" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Pack" }).click();
    await expect(page.getByRole("dialog").getByRole("alert").filter({ hasText: "Not saved" })).toContainText("House");
    await choose(page, "House", `House 1 ${shop.id}`);
    await page.getByRole("dialog").getByRole("button", { name: "Pack" }).click();
    await expect(page.getByText("Packed — hand it to Nova Post")).toBeVisible();

    await page.getByRole("button", { name: "Ship" }).click();
    await page.getByLabel("Waybill").fill("20450000000000");
    await page.getByRole("dialog").getByRole("button", { name: "Ship" }).click();
    await expect(page.getByText("20450000000000")).toBeVisible();

    await page.getByRole("button", { name: "Delivered" }).click();
    await expect(page.getByRole("dialog")).toContainText("Cash on delivery: the order is marked paid (1.100 MDL).");
    await page.getByRole("dialog").getByRole("button", { name: "Delivered" }).click();
    await expect(page.getByText("Delivered. If the customer sends something back")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create return" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    const history = page.getByRole("list", { name: "History" });
    await expect(history.getByRole("listitem")).toHaveCount(5);
    await expect(history.getByRole("listitem").first()).toContainText("Delivered");

    await page.getByLabel("Internal note").fill("deliver after 18:00");
    await page.getByRole("button", { name: "Save note" }).click();
    await page.reload();
    await expect(page.getByLabel("Internal note")).toHaveValue("deliver after 18:00");
  });

  test("AO-03 a refused step shows the reason; AO-04 cancelling a paid order needs a refund", async ({ page }) => {
    const shop = await createShop(page, 1);
    const first = await placeOrder(page, shop, [["xl", 1]]);
    await act(page, first.orderId, "confirm");
    await act(page, first.orderId, "pack", { locationId: shop.house1.id });

    const paid = await placeOrder(page, shop, [["m", 1]], "Test");
    await page.request.post(`/api/orders/${paid.accessToken}/test-payment`);

    await page.goto(`/admin/orders/${paid.orderId}`);
    await page.getByRole("button", { name: "Pack" }).click();
    await choose(page, "House", `Defective ${shop.id}`);
    await page.getByRole("dialog").getByRole("button", { name: "Pack" }).click();
    await expect(page.getByRole("dialog").getByRole("alert").filter({ hasText: "Not saved" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();

    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByRole("dialog")).toContainText("Refund needed");
    await page.getByLabel("Reason").fill("customer called");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel order" }).click();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Cancelled$/ })).toBeVisible();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Refund needed$/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "History" })).toContainText("customer called");
  });

  test("AO-06 a new customer link replaces the old one; AO-07 the packing slip shows what to pack and collect", async ({ page, context }) => {
    const shop = await createShop(page);
    const order = await placeOrder(page, shop, [["xl", 2]]);

    await page.goto(`/admin/orders/${order.orderId}`);
    await page.getByRole("button", { name: "New customer link" }).click();
    await page.getByRole("button", { name: "Create link" }).click();
    const link = await page.getByRole("dialog").getByRole("textbox").inputValue();
    expect(link).toMatch(/\/order\/.+/);
    const token = link.split("/order/")[1];
    expect((await page.request.get(`/api/orders/${token}`)).ok()).toBeTruthy();
    expect((await page.request.get(`/api/orders/${order.accessToken}`)).ok()).toBeFalsy();
    await page.keyboard.press("Escape");

    const [slip] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "Print packing slip" }).click()]);
    await expect(slip.getByText(`#${order.number}`)).toBeVisible();
    await expect(slip.getByText(`Ana Popescu ${shop.id}`)).toBeVisible();
    await expect(slip.getByRole("row").filter({ hasText: shop.sku("xl") })).toContainText("2");
    await expect(slip.getByTestId("slip-collect")).toHaveText("Collect: 1.300 MDL");
    await expect(slip.getByRole("navigation")).toHaveCount(0);
  });
});
