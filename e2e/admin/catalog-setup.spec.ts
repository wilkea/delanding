import { expect, test, type Page } from "@playwright/test";
import { logInFromStart, requireAdminCredentials } from "./helpers";

type Created = { id: string; code?: string; slug?: string };

function unique() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

async function post(page: Page, path: string, data: unknown): Promise<Created> {
  const response = await page.request.post(path, { data });
  expect(response.ok(), `${path} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function optionAttribute(page: Page, id: string, name: string, options: string[]) {
  return post(page, "/api/admin/attributes", {
    code: `${name}_${id}`,
    name: { ro: `${name} ${id}`, ru: `${name} ru ${id}` },
    dataType: "Option",
    unit: null,
    isFilterable: true,
    options: options.map((code, sortOrder) => ({ code, label: { ro: code.toUpperCase() }, sortOrder })),
  });
}

async function productUsing(page: Page, id: string, { brandId = null as string | null } = {}) {
  const attribute = await optionAttribute(page, id, "surface", ["speed", "control"]);
  const type = await post(page, "/api/admin/product-types", {
    code: `pad_${id}`,
    name: { ro: `Pad ${id}` },
    attributes: [{ attributeId: attribute.id, isRequired: true, isVariantAxis: true, sortOrder: 0 }],
  });
  const category = await post(page, "/api/admin/categories", {
    parentId: null,
    slug: `pads-${id}`,
    name: { ro: `Pads ${id}` },
    sortOrder: 0,
    isActive: true,
  });
  await post(page, "/api/admin/products", {
    productTypeId: type.id,
    categoryId: category.id,
    brandId,
    slug: `pad-${id}`,
    name: { ro: `Pad ${id}` },
    description: null,
    attributes: null,
    customAttributes: null,
    vatRate: null,
    variants: [
      {
        id: null,
        sku: `PAD-${id}`.toUpperCase(),
        barcode: null,
        price: 100,
        options: { [`surface_${id}`]: "speed" },
        weightGrams: 300,
        lengthMm: null,
        widthMm: null,
        heightMm: null,
        isActive: true,
        sortOrder: 0,
      },
    ],
  });
  return { attribute, category, type };
}

test.describe("AC — admin catalog setup", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);
  });

  test("AC-01 attribute library lists attributes and search finds Russian names", async ({ page }) => {
    const id = unique();
    await optionAttribute(page, id, "size", ["m", "xl"]);

    await page.getByRole("link", { name: "Attributes" }).click();
    await expect(page.getByRole("heading", { name: "Attributes" })).toBeVisible();

    await page.getByLabel("Search attributes").fill(`size ru ${id}`);
    const row = page.getByRole("row").filter({ hasText: `size_${id}` });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`size ${id}`);
    await expect(row).toContainText("One option");
    await expect(row).toContainText("M, XL");
    await expect(page.getByRole("row")).toHaveCount(2);
  });

  test("AC-02 creating an attribute suggests codes and shows the right fields per type", async ({ page }) => {
    const id = unique();
    await page.goto("/admin/catalog/attributes");
    await page.getByRole("button", { name: "New attribute" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.locator("#attribute-type").click();
    await page.getByRole("option", { name: "Number" }).click();
    await expect(dialog.getByLabel("Unit")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add option" })).toHaveCount(0);

    await dialog.locator("#attribute-type").click();
    await page.getByRole("option", { name: "Yes / no" }).click();
    await expect(dialog.getByLabel("Unit")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Add option" })).toHaveCount(0);

    await dialog.locator("#attribute-type").click();
    await page.getByRole("option", { name: "One option" }).click();

    await dialog.getByLabel("attribute-name RO").fill(`Suprafață ${id}`);
    await dialog.getByRole("tab", { name: /^ru/i }).first().click();
    await dialog.getByLabel("attribute-name RU").fill(`Поверхность ${id}`);
    await expect(dialog.locator("#attribute-code")).toHaveValue(`suprafata_${id}`);

    await dialog.getByRole("button", { name: "Add option" }).click();
    await dialog.getByLabel("option-0 RO").fill("Speed");
    await dialog.getByRole("button", { name: "Add option" }).click();
    await dialog.getByLabel("option-1 RO").fill("Control");
    await expect(dialog.getByPlaceholder("Code").nth(0)).toHaveValue("speed");
    await expect(dialog.getByPlaceholder("Code").nth(1)).toHaveValue("control");

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Saved")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: `suprafata_${id}` });
    await expect(row).toContainText("Speed, Control");
    await expect(row).toContainText(`Поверхность ${id}`);
  });

  test("AC-03 removing a used option shows the backend message, renaming is allowed", async ({ page }) => {
    const id = unique();
    const { attribute } = await productUsing(page, id);

    await page.goto("/admin/catalog/attributes");
    await page.getByLabel("Search attributes").fill(attribute.code!);
    await page.getByRole("button", { name: `Edit ${attribute.code}` }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("button", { name: "Remove" }).first().click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Not saved: 1 problem" })).toContainText("Options: Option 'speed' is used by products and cannot be removed.");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: `Edit ${attribute.code}` }).click();
    await dialog.getByLabel("option-0 RO").fill("Speed Pro");
    await expect(dialog.getByPlaceholder("Code").nth(0)).toHaveValue("speed");
    await expect(dialog.getByPlaceholder("Code").nth(0)).not.toBeEditable();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: attribute.code! })).toContainText("Speed Pro, CONTROL");
  });

  test("AC-07 presets create ready attributes and cannot be added twice", async ({ page }) => {
    const existing: { code: string }[] = await (await page.request.get("/api/admin/attributes")).json();
    await page.goto("/admin/catalog/attributes");

    if (!existing.some((a) => a.code === "color")) {
      await page.getByRole("button", { name: "Add from presets" }).click();
      await page.getByRole("menuitem", { name: /^Color/ }).click();
      await expect(page.getByText("“Culoare” added to the library")).toBeVisible();
    }

    await page.getByLabel("Search attributes").fill("color");
    const row = page.getByRole("row").filter({ hasText: /^Culoare/ }).filter({ hasText: "color" }).first();
    await expect(row).toBeVisible();

    const colors: { code: string; showAsSwatches: boolean; options: { code: string; swatch: string[] }[] }[] = await (
      await page.request.get("/api/admin/attributes?search=color")
    ).json();
    const color = colors.find((a) => a.code === "color")!;
    expect(color.showAsSwatches).toBe(true);
    expect(color.options.find((o) => o.code === "violet")?.swatch).toEqual(["#984AFE"]);

    await page.getByRole("button", { name: "Add from presets" }).click();
    const item = page.getByRole("menuitem", { name: /^Color/ });
    await expect(item).toContainText("Added");
    await expect(item).toHaveAttribute("aria-disabled", "true");
  });

  test("AC-08 swatch options get one or two colors, a missing color is explained", async ({ page }) => {
    const id = unique();
    await page.goto("/admin/catalog/attributes");
    await page.getByRole("button", { name: "New attribute" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("attribute-name RO").fill(`Culoare pad ${id}`);
    await dialog.getByRole("switch", { name: "Show as color swatches" }).click();
    await dialog.getByRole("button", { name: "Add option" }).click();
    await dialog.getByLabel("option-0 RO").fill("Negru Rosu");
    await dialog.getByLabel("Color 1 option-0", { exact: true }).fill("#111111");
    await dialog.getByRole("button", { name: "Add color option-0" }).click();
    await dialog.getByLabel("Color 2 option-0", { exact: true }).fill("#e11d2e");
    await expect(dialog.getByText("#E11D2E")).toBeVisible();

    await dialog.getByRole("button", { name: "Add option" }).click();
    await dialog.getByLabel("option-1 RO").fill("Alb");
    await dialog.getByRole("button", { name: "Remove color 1 option-1" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Not saved" })).toContainText("Options #2 swatch: Pick 1 or 2 colors.");

    await dialog.getByRole("button", { name: "Add color option-1" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row").filter({ hasText: `culoare_pad_${id}` });
    await expect(row.locator("[data-slot=swatch]")).toHaveCount(2);
    const saved: { code: string; options: { swatch: string[] }[] }[] = await (
      await page.request.get(`/api/admin/attributes?search=culoare_pad_${id}`)
    ).json();
    expect(saved[0].options[0].swatch).toEqual(["#111111", "#E11D2E"]);
  });

  test("AC-04 product type keeps chosen order, variant only for option attributes", async ({ page }) => {
    const id = unique();
    const size = await optionAttribute(page, id, "size", ["m", "xl"]);
    const thickness = await post(page, "/api/admin/attributes", {
      code: `thickness_${id}`,
      name: { ro: `Grosime ${id}` },
      dataType: "Number",
      unit: "mm",
      isFilterable: false,
      options: null,
    });

    await page.getByRole("link", { name: "Product types" }).click();
    await page.getByRole("button", { name: "New product type" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("type-name RO").fill(`Mousepad ${id}`);
    await expect(dialog.locator("#type-code")).toHaveValue(`mousepad_${id}`);

    for (const label of [`size ${id} (size_${id})`, `Grosime ${id} (thickness_${id})`]) {
      await dialog.getByRole("combobox", { name: "Add attribute…" }).click();
      await page.getByRole("option", { name: label }).click();
    }

    await dialog.getByRole("switch", { name: `Variant ${size.code}` }).click();
    await expect(dialog.getByRole("switch", { name: `Variant ${thickness.code}` })).toBeDisabled();
    await dialog.getByRole("switch", { name: `Required ${thickness.code}` }).click();
    await dialog.getByRole("button", { name: "Move up" }).nth(1).click();

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByRole("row").filter({ hasText: `mousepad_${id}` });
    await expect(row.locator("[data-slot=badge]")).toHaveText([`Grosime ${id} *`, `size ${id}`]);
  });

  test("AC-04 changing variants on a type with products explains why it is refused", async ({ page }) => {
    const id = unique();
    const { attribute, type } = await productUsing(page, id);

    await page.goto("/admin/catalog/types");
    await page.getByRole("button", { name: `Edit ${type.code}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("switch", { name: `Variant ${attribute.code}` }).click();
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog.getByRole("alert").filter({ hasText: "Not saved: 1 problem" })).toContainText("Attributes: Variant attributes cannot change while products of this type exist.");
    await expect(dialog).toBeVisible();
  });

  test("AC-05 categories show as a tree with add child, hide, and guarded delete", async ({ page }) => {
    const id = unique();
    await post(page, "/api/admin/categories", {
      parentId: null,
      slug: `periferice-${id}`,
      name: { ro: `Periferice ${id}` },
      sortOrder: 0,
      isActive: true,
    });

    await page.getByRole("link", { name: "Categories" }).click();
    await page.getByRole("button", { name: `Add sub-category to periferice-${id}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("category-name RO").fill(`Mousepad-uri ${id}`);
    await expect(dialog.locator("#category-slug")).toHaveValue(`mousepad-uri-${id}`);
    await expect(dialog.locator("#category-parent")).toContainText(`Periferice ${id}`);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    const parentRow = page.getByRole("listitem").filter({ hasText: `/periferice-${id}` });
    const childRow = page.getByRole("listitem").filter({ hasText: `/mousepad-uri-${id}` });
    await expect(childRow).toBeVisible();
    const indent = async (row: typeof childRow) => parseFloat(await row.evaluate((el) => getComputedStyle(el).paddingLeft));
    expect(await indent(childRow)).toBeGreaterThan(await indent(parentRow));

    await page.getByRole("button", { name: `Edit mousepad-uri-${id}` }).click();
    await dialog.getByRole("switch", { name: "Active" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(childRow).toContainText("Hidden");

    await page.getByRole("button", { name: `Delete periferice-${id}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Category has subcategories and cannot be deleted.")).toBeVisible();

    await page.getByRole("button", { name: `Delete mousepad-uri-${id}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(childRow).toHaveCount(0);
  });

  test("AC-06 brands get a slug from the name; a brand with products cannot be deleted", async ({ page }) => {
    const id = unique();
    await page.getByRole("link", { name: "Brands" }).click();
    await page.getByRole("button", { name: "New brand" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(`Depad ${id}`);
    await expect(dialog.getByLabel("URL slug")).toHaveValue(`depad-${id}`);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("row").filter({ hasText: `depad-${id}` })).toContainText(`Depad ${id}`);

    await page.getByRole("button", { name: "New brand" }).click();
    await dialog.getByLabel("Name").fill(`Depad ${id}`);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Not saved" })).toContainText("URL slug: This value is already used. Choose another one.");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    const used = await post(page, "/api/admin/brands", { slug: `used-${id}`, name: `Used ${id}` });
    await productUsing(page, id, { brandId: used.id });
    await page.reload();
    await page.getByRole("button", { name: `Delete used-${id}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Brand has products and cannot be deleted.")).toBeVisible();
  });
});
