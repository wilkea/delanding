import { expect, test, type Page } from "@playwright/test";
import { logInFromStart, requireAdminCredentials } from "./helpers";
import { act, createShop, placeOrder, type Shop } from "./shop";

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByLabel("Search…").fill(option);
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function deliveredOrder(page: Page, shop: Shop) {
  const order = await placeOrder(page, shop, [["xl", 2], ["m", 1]]);
  await act(page, order.orderId, "confirm");
  await act(page, order.orderId, "pack", { locationId: shop.house1.id });
  await act(page, order.orderId, "ship", { waybillNumber: "20450000000000" });
  await act(page, order.orderId, "deliver");
  return order;
}

async function onHand(page: Page, sku: string, locationId: string) {
  const stock = await (await page.request.get(`/api/admin/inventory/stock?search=${sku}`)).json();
  return Number(stock.items[0].locations.find((l: { locationId: string }) => l.locationId === locationId)?.onHand ?? 0);
}

test.describe("AR — admin returns", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);
  });

  test("AR-02 AR-03 AR-04 AR-06 a return is created from the order, received into stock and refunded by hand", async ({ page }) => {
    const shop = await createShop(page);
    const order = await deliveredOrder(page, shop);
    const before = await onHand(page, shop.sku("xl"), shop.house1.id);

    await page.goto(`/admin/orders/${order.orderId}`);
    await page.getByRole("link", { name: "Create return" }).click();
    await expect(page.getByRole("heading", { name: `New return for #${order.number}` })).toBeVisible();
    await expect(page.getByTestId(`return-line-${shop.sku("xl")}`)).toContainText("2 of 2 can still be returned · paid 650 MDL each");
    await page.getByLabel(`Quantity ${shop.sku("xl")}`).fill("1");
    await expect(page.getByTestId("paid-total")).toHaveText("650 MDL");
    await page.getByRole("button", { name: "Create return" }).click();

    await expect(page.getByRole("heading", { name: /^R-\d+$/ })).toBeVisible();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Open$/ })).toBeVisible();
    await expect(page.getByText("Wrong size / ordered wrong item")).toBeVisible();

    await page.getByRole("button", { name: "Receive" }).click();
    await page.getByRole("combobox", { name: `Place ${shop.sku("xl")}` }).click();
    await page.getByLabel("Search…").fill(shop.id);
    await expect(page.getByRole("option", { name: `Defective ${shop.id}` })).toHaveCount(0);
    await page.getByRole("option", { name: `House 1 ${shop.id}`, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Receive" }).click();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Received$/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Received" })).toContainText(`Resellable → House 1 ${shop.id}`);
    expect(await onHand(page, shop.sku("xl"), shop.house1.id)).toBe(before + 1);

    await page.getByRole("button", { name: "Mark refunded" }).click();
    await expect(page.getByLabel("Amount, MDL")).toHaveValue("650");
    await page.getByLabel("Amount, MDL").fill("600");
    await page.getByLabel("Note").fill("bank transfer 05.10");
    await page.getByRole("dialog").getByRole("button", { name: "Mark refunded" }).click();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Closed$/ })).toBeVisible();
    await expect(page.getByTestId("refunded-amount")).toHaveText("600 MDL");
    await expect(page.getByRole("list", { name: "History" }).getByRole("listitem")).toHaveCount(3);

    await page.getByRole("link", { name: `for order #${order.number}` }).click();
    await expect(page.getByText(/^R-\d+$/).first()).toBeVisible();
    await expect(page.getByText("600 MDL")).toBeVisible();
  });

  test("AR-02 more than is left is refused at the line; AR-03 damaged items only go to B-grade; AR-05 cancel", async ({ page }) => {
    const shop = await createShop(page);
    const order = await deliveredOrder(page, shop);
    const first = await page.request.post("/api/admin/returns", {
      data: { orderId: order.orderId, note: null, lines: [{ variantId: shop.variant("xl"), quantity: 1, reason: "WrongSize", note: null }] },
    });
    expect(first.ok()).toBeTruthy();

    await page.goto(`/admin/returns/new?order=${order.orderId}`);
    await expect(page.getByTestId(`return-line-${shop.sku("xl")}`)).toContainText("1 of 2 can still be returned");
    await page.getByLabel(`Quantity ${shop.sku("xl")}`).fill("2");
    await page.getByRole("button", { name: "Create return" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Not saved" })).toBeVisible();
    await expect(page.getByTestId(`return-line-${shop.sku("xl")}`)).toContainText(/At most 1/);

    await page.getByLabel(`Quantity ${shop.sku("xl")}`).fill("");
    await page.getByLabel(`Quantity ${shop.sku("m")}`).fill("1");
    await choose(page, `Reason ${shop.sku("m")}`, "Defective / damaged");
    await page.getByRole("button", { name: "Create return" }).click();
    await expect(page.getByRole("heading", { name: /^R-\d+$/ })).toBeVisible();

    await page.getByRole("button", { name: "Receive" }).click();
    await choose(page, `Condition ${shop.sku("m")}`, "Damaged (B-grade)");
    await page.getByRole("combobox", { name: `Place ${shop.sku("m")}` }).click();
    await page.getByLabel("Search…").fill(shop.id);
    await expect(page.getByRole("option", { name: `House 1 ${shop.id}` })).toHaveCount(0);
    await page.getByRole("option", { name: `Defective ${shop.id}`, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();

    await page.getByRole("button", { name: "Cancel return" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel return" }).click();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Cancelled$/ })).toBeVisible();
  });

  test("AR-01 the returns list finds returns by order number", async ({ page }) => {
    const shop = await createShop(page);
    const order = await deliveredOrder(page, shop);
    await page.request.post("/api/admin/returns", {
      data: { orderId: order.orderId, note: null, lines: [{ variantId: shop.variant("m"), quantity: 1, reason: "ChangedMind", note: null }] },
    });

    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Returns" }).click();
    await page.getByLabel("Order number").fill(String(order.number));
    const row = page.getByRole("row").filter({ hasText: `#${order.number}` });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Open");
    await expect(row).toContainText("450 MDL");
  });
});
