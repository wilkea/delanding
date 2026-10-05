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

test.describe("AD — layout robustness", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await page.setViewportSize({ width: 1280, height: 800 });
    await logInFromStart(page);
  });

  test("AD-13 long text wraps and the buttons stay on screen", async ({ page }) => {
    const id = unique();
    const longWord = "Suprafațăextremdelungăfărăspații".repeat(4);
    await post(page, "/api/admin/attributes", {
      code: `long_${id}_${"x".repeat(30)}`,
      name: { ro: `${longWord} ${id}` },
      dataType: "Option",
      unit: null,
      isFilterable: true,
      showAsSwatches: false,
      options: Array.from({ length: 12 }, (_, i) => ({ code: `option_${i}`, label: { ro: `Opțiune foarte lungă numărul ${i}` }, sortOrder: i, swatch: null })),
    });

    await page.goto("/admin/catalog/attributes");
    await page.getByLabel("Search attributes").fill(id);
    const edit = page.getByRole("button", { name: new RegExp(`^Edit long_${id}`) });
    await expect(edit).toBeVisible();

    const box = (await edit.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(0);
  });

  test("AD-14 dropdowns can be searched with mouse or keyboard", async ({ page }) => {
    const id = unique();
    await post(page, "/api/admin/product-types", { code: `findme_${id}`, name: { ro: `Findme ${id}` }, attributes: [] });

    await page.goto("/admin/catalog/products");
    await page.getByRole("button", { name: "New product" }).click();
    await page.getByRole("combobox", { name: "Product type" }).click();
    await page.getByLabel("Search…").fill(`Findme ${id}`);
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.getByLabel("Search…").press("ArrowDown");
    await page.getByLabel("Search…").press("Enter");
    await expect(page.getByRole("combobox", { name: "Product type" })).toContainText(`Findme ${id}`);

    await page.getByRole("combobox", { name: "Product type" }).click();
    await page.getByLabel("Search…").fill("no such type at all");
    await expect(page.getByText("Nothing found.")).toBeVisible();
  });
});
