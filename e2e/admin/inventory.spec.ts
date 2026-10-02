import { expect, test, type Page } from "@playwright/test";
import { logInFromStart, requireAdminCredentials } from "./helpers";

function unique() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

async function post(page: Page, path: string, data: unknown) {
  const response = await page.request.post(path, { data });
  expect(response.ok(), `${path} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function setup(page: Page, id: string) {
  const size = await post(page, "/api/admin/attributes", {
    code: `size_${id}`, name: { ro: `Mărime ${id}` }, dataType: "Option", unit: null, isFilterable: true, showAsSwatches: false,
    options: ["m", "xl"].map((code, sortOrder) => ({ code, label: { ro: code.toUpperCase() }, sortOrder, swatch: null })),
  });
  const type = await post(page, "/api/admin/product-types", {
    code: `pad_${id}`, name: { ro: `Pad ${id}` }, attributes: [{ attributeId: size.id, isRequired: true, isVariantAxis: true, sortOrder: 0 }],
  });
  const category = await post(page, "/api/admin/categories", { parentId: null, slug: `inv-${id}`, name: { ro: `Inv ${id}` }, sortOrder: 0, isActive: true });
  const product = await post(page, "/api/admin/products", {
    productTypeId: type.id, categoryId: category.id, brandId: null, slug: `shadow-${id}`, name: { ro: `Shadow ${id}` },
    description: null, attributes: null, customAttributes: null, vatRate: null,
    variants: ["m", "xl"].map((s, i) => ({
      id: null, sku: `INV-${id}-${s}`.toUpperCase(), barcode: null, price: 400, options: { [size.code]: s },
      weightGrams: 300, lengthMm: null, widthMm: null, heightMm: null, isActive: true, sortOrder: i,
    })),
  });
  const location = (name: string) => post(page, "/api/admin/inventory/locations", { name, contactName: null, phone: null, city: "Chișinău", address: null, isSellable: true });
  const house1 = await location(`House 1 ${id}`);
  const house2 = await location(`House 2 ${id}`);
  const sku = (s: "m" | "xl") => `INV-${id}-${s}`.toUpperCase();
  const variant = (s: "m" | "xl") => product.variants.find((v: { sku: string }) => v.sku === sku(s)).id as string;
  return { house1, house2, sku, variant };
}

async function receive(page: Page, locationId: string, lines: [string, number, number][]) {
  return post(page, "/api/admin/inventory/receipts", {
    locationId, supplier: null, note: null, lines: lines.map(([variantId, quantity, unitCost]) => ({ variantId, quantity, unitCost })),
  });
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  const item = page.getByRole("option", { name: option, exact: true });
  await item.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await item.click();
}

async function addLine(page: Page, sku: string) {
  await page.getByLabel("Add a product: type SKU or name").first().fill(sku);
  await page.getByRole("option").filter({ hasText: sku }).click();
}

test.describe("AI — admin inventory", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);
  });

  test("AI-01 locations are added, and one holding stock cannot be deactivated", async ({ page }) => {
    const id = unique();
    const s = await setup(page, id);
    await receive(page, s.house1.id, [[s.variant("xl"), 1, 210]]);

    await page.getByRole("link", { name: "Locations" }).click();
    await page.getByRole("button", { name: "New location" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(`Old shop ${id}`);
    await dialog.getByLabel("City").fill("Bălți");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByRole("row").filter({ hasText: `Old shop ${id}` });
    await expect(row).toContainText("Sellable");

    await page.getByRole("button", { name: `Deactivate House 1 ${id}` }).click();
    await expect(page.getByText(/stock/i).filter({ hasText: /zero|transfer|adjust/i }).first()).toBeVisible();

    await page.getByRole("button", { name: `Deactivate Old shop ${id}` }).click();
    await expect(row).toContainText("Inactive");
    await page.getByRole("button", { name: `Activate Old shop ${id}` }).click();
    await expect(row).not.toContainText("Inactive");
  });

  test("AI-10 AI-14 receiving stock shows the total, opens the numbered receipt and fills the stock", async ({ page }) => {
    const id = unique();
    const s = await setup(page, id);

    await page.goto("/admin/inventory");
    await page.getByRole("link", { name: "Receive" }).click();
    await choose(page, "Location", `House 1 ${id}`);
    await page.getByLabel("Supplier").fill("AliExpress");
    await addLine(page, s.sku("xl"));
    await addLine(page, s.sku("m"));
    await page.getByLabel(`Quantity ${s.sku("xl")}`).fill("0");
    await page.getByLabel(`Cost per unit, MDL ${s.sku("xl")}`).fill("210");
    await page.getByLabel(`Quantity ${s.sku("m")}`).fill("30");
    await page.getByLabel(`Cost per unit, MDL ${s.sku("m")}`).fill("140");
    await page.getByRole("button", { name: "Record receipt" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Not saved" })).toContainText("Lines #1 quantity");
    await expect(page.getByTestId("line-0")).toContainText(/./);

    await page.getByLabel(`Quantity ${s.sku("xl")}`).fill("20");
    await expect(page.getByTestId("total-cost")).toHaveText("8.400 MDL");
    await page.getByRole("button", { name: "Record receipt" }).click();
    await expect(page).toHaveURL(/\/admin\/inventory\/documents\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: /Receipt #\d+/ })).toBeVisible();
    await expect(page.getByText("AliExpress")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: s.sku("xl") })).toContainText("+20");

    await page.getByRole("link", { name: "Stock", exact: true }).click();
    await page.getByLabel("Search SKU or product").fill(`INV-${id}`.toUpperCase());
    const xl = page.getByRole("row").filter({ hasText: s.sku("xl") });
    await expect(xl).toContainText("20");
    await expect(page.getByRole("columnheader", { name: `House 1 ${id}` })).toBeVisible();

    await page.getByRole("link", { name: "Documents" }).click();
    await choose(page, "Type", "Receipt");
    const newest = page.getByRole("row").nth(1);
    await expect(newest).toContainText(`House 1 ${id}`);
    await expect(newest).toContainText("AliExpress");
  });

  test("AI-11 adjustments remove with a reason, require a note for Other and cannot take more than there is", async ({ page }) => {
    const id = unique();
    const s = await setup(page, id);
    await receive(page, s.house1.id, [[s.variant("xl"), 2, 210]]);

    await page.goto("/admin/inventory/new/adjustment");
    await choose(page, "Location", `House 1 ${id}`);
    await expect(page.getByText("Remove from stock")).toBeVisible();
    await addLine(page, s.sku("xl"));
    await expect(page.getByTestId("have-0")).toHaveText("2");
    await page.getByLabel(`How many ${s.sku("xl")}`).fill("3");
    await page.getByRole("button", { name: "Record adjustment" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Not saved" })).toContainText("Only 2 in stock at this location.");

    await choose(page, "Reason", "Other");
    await page.getByLabel(`How many ${s.sku("xl")}`).fill("1");
    await page.getByRole("button", { name: "Record adjustment" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Not saved" })).toContainText("Note: A note is required when the reason is Other.");

    await choose(page, "Reason", "Gift / Sample");
    await page.getByLabel("Note").fill("Review sample for streamer");
    await page.getByRole("button", { name: "Record adjustment" }).click();
    await expect(page.getByRole("heading", { name: /Adjustment #\d+/ })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: s.sku("xl") })).toContainText("−1".replace("−", "-"));
    await expect(page.getByRole("row").filter({ hasText: s.sku("xl") })).toContainText("Gift / Sample");
  });

  test("AI-12 a count shows expected and difference and records only the differences", async ({ page }) => {
    const id = unique();
    const s = await setup(page, id);
    await receive(page, s.house1.id, [[s.variant("xl"), 10, 210], [s.variant("m"), 4, 140]]);

    await page.goto("/admin/inventory/new/count");
    await choose(page, "Location", `House 1 ${id}`);
    await addLine(page, s.sku("xl"));
    await addLine(page, s.sku("m"));
    await expect(page.getByTestId("have-0")).toHaveText("10");
    await page.getByLabel(`Counted ${s.sku("xl")}`).fill("8");
    await page.getByLabel(`Counted ${s.sku("m")}`).fill("4");
    await expect(page.getByTestId("diff-0")).toHaveText("-2");
    await expect(page.getByTestId("diff-1")).toHaveText("0");
    await page.getByRole("button", { name: "Record count" }).click();

    await expect(page.getByRole("heading", { name: /Count #\d+/ })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: s.sku("xl") })).toContainText("-2");
    await expect(page.getByRole("row").filter({ hasText: s.sku("m") })).toHaveCount(0);
  });

  test("AI-13 AI-02 AI-03 a transfer moves stock and the variant history shows both sides", async ({ page }) => {
    const id = unique();
    const s = await setup(page, id);
    await receive(page, s.house1.id, [[s.variant("xl"), 10, 210]]);

    await page.goto("/admin/inventory/new/transfer");
    await choose(page, "From", `House 1 ${id}`);
    await page.getByRole("combobox", { name: "To" }).click();
    await expect(page.getByRole("option", { name: `House 1 ${id}`, exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: `House 2 ${id}`, exact: true }).click();
    await addLine(page, s.sku("xl"));
    await expect(page.getByTestId("have-0")).toHaveText("10");
    await page.getByLabel(`Quantity ${s.sku("xl")}`).fill("3");
    await page.getByRole("button", { name: "Record transfer" }).click();
    await expect(page.getByRole("heading", { name: /Transfer #\d+/ })).toBeVisible();

    await page.goto("/admin/inventory");
    await page.getByLabel("Search SKU or product").fill(s.sku("xl"));
    const row = page.getByRole("row").filter({ hasText: s.sku("xl") });
    const cells = row.getByRole("cell");
    await expect(page.getByRole("columnheader", { name: `House 1 ${id}` })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: `House 2 ${id}` })).toBeVisible();
    await expect(cells.nth(2)).toHaveText("7");
    await expect(cells.nth(3)).toHaveText("3");
    await expect(cells.nth(4)).toHaveText("10");

    await row.getByRole("button", { name: s.sku("xl") }).click();
    const history = page.getByRole("dialog");
    await expect(history.getByRole("listitem")).toHaveCount(3);
    await expect(history.getByRole("listitem").first()).toContainText("Transfer #");
    await history.getByRole("link", { name: /Receipt #\d+/ }).click();
    await expect(page.getByRole("heading", { name: /Receipt #\d+/ })).toBeVisible();
  });
});
