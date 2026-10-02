import { expect, test, type Page } from "@playwright/test";
import { logInFromStart, requireAdminCredentials } from "./helpers";

type Created = { id: string; code: string; slug: string };

function unique() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

async function post(page: Page, path: string, data: unknown) {
  const response = await page.request.post(path, { data });
  expect(response.ok(), `${path} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function png(page: Page, width: number, height: number, color: string): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h, c]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const context = canvas.getContext("2d")!;
      context.fillStyle = c as string;
      context.fillRect(0, 0, w as number, h as number);
      context.fillStyle = "#ffffff";
      context.fillRect(10, 10, 40, 40);
      return canvas.toDataURL("image/png");
    },
    [width, height, color],
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function uploadMedia(page: Page, name: string, width = 800, height = 600, color = "#984afe") {
  const response = await page.request.post("/api/admin/media", {
    multipart: { file: { name, mimeType: "image/png", buffer: await png(page, width, height, color) } },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { id: string; url: string; fileName: string };
}

async function catalog(page: Page, id: string) {
  const option = (code: string, sortOrder: number) => ({ code, label: { ro: code.toUpperCase() }, sortOrder, swatch: null });
  const size: Created = await post(page, "/api/admin/attributes", {
    code: `size_${id}`, name: { ro: `Mărime ${id}` }, dataType: "Option", unit: null, isFilterable: true, showAsSwatches: false,
    options: [option("m", 0), option("xl", 1)],
  });
  const surface: Created = await post(page, "/api/admin/attributes", {
    code: `surface_${id}`, name: { ro: `Suprafață ${id}` }, dataType: "Option", unit: null, isFilterable: true, showAsSwatches: false,
    options: [option("speed", 0), option("control", 1)],
  });
  const thickness: Created = await post(page, "/api/admin/attributes", {
    code: `thickness_${id}`, name: { ro: `Grosime ${id}` }, dataType: "Number", unit: "mm", isFilterable: false, showAsSwatches: false, options: null,
  });
  const extra: Created = await post(page, "/api/admin/attributes", {
    code: `material_${id}`, name: { ro: `Material ${id}` }, dataType: "Text", unit: null, isFilterable: false, showAsSwatches: false, options: null,
  });
  const type: Created = await post(page, "/api/admin/product-types", {
    code: `pad_${id}`,
    name: { ro: `Mousepad ${id}` },
    attributes: [
      { attributeId: size.id, isRequired: true, isVariantAxis: true, sortOrder: 0 },
      { attributeId: surface.id, isRequired: true, isVariantAxis: false, sortOrder: 1 },
      { attributeId: thickness.id, isRequired: false, isVariantAxis: false, sortOrder: 2 },
    ],
  });
  const category: Created = await post(page, "/api/admin/categories", {
    parentId: null, slug: `pads-${id}`, name: { ro: `Mousepad-uri ${id}` }, sortOrder: 0, isActive: true,
  });
  return { size, surface, thickness, extra, type, category };
}

async function product(page: Page, id: string, setup: Awaited<ReturnType<typeof catalog>>) {
  return (await post(page, "/api/admin/products", {
    productTypeId: setup.type.id,
    categoryId: setup.category.id,
    brandId: null,
    slug: `shadow-${id}`,
    name: { ro: `Shadow ${id}` },
    description: null,
    attributes: { [setup.surface.code]: "speed" },
    customAttributes: null,
    vatRate: null,
    variants: ["m", "xl"].map((size, i) => ({
      id: null, sku: `SHD-${id}-${size}`.toUpperCase(), barcode: null, price: i === 0 ? 350 : 450,
      options: { [setup.size.code]: size }, weightGrams: 300, lengthMm: null, widthMm: null, heightMm: null, isActive: true, sortOrder: i,
    })),
  })) as { id: string; variants: { id: string; sku: string }[] };
}

test.describe("AC — admin products and photos", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await logInFromStart(page);
  });

  test("AC-10 product list shows photo, status, type, category, variants and lowest price, with filters", async ({ page }) => {
    const id = unique();
    const setup = await catalog(page, id);
    const created = await product(page, id, setup);
    const photo = await uploadMedia(page, `list-${id}.png`);
    await page.request.put(`/api/admin/products/${created.id}/images`, {
      data: { images: [{ mediaId: photo.id, variantId: null, alt: {}, framing: null }] },
    });

    await page.getByRole("link", { name: "Products" }).click();
    await page.getByLabel("Search by name or SKU").fill(`SHD-${id}-XL`);
    const row = page.getByRole("row").filter({ hasText: `Shadow ${id}` });
    await expect(row).toContainText("Draft");
    await expect(row).toContainText(`Mousepad ${id}`);
    await expect(row).toContainText(`Mousepad-uri ${id}`);
    await expect(row).toContainText("2");
    await expect(row).toContainText("from 350 MDL");
    await expect(row.locator("img")).toHaveAttribute("src", new RegExp(`/media/${photo.id}/`));

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Active" }).click();
    await expect(page.getByText("Nothing here yet.")).toBeVisible();
  });

  test("AC-11 AC-12 AC-14 AC-16 a product is created from its type, gets variants, and is published once complete", async ({ page }) => {
    const id = unique();
    const setup = await catalog(page, id);

    await page.goto("/admin/catalog/products");
    await page.getByRole("button", { name: "New product" }).click();
    await page.getByRole("combobox", { name: "Product type" }).click();
    await page.getByRole("option", { name: `Mousepad ${id}` }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(`Suprafață ${id}`)).toBeVisible();
    await expect(page.locator(`label[for="attr-${setup.surface.code}"]`)).toContainText("*");
    await expect(page.getByText("mm", { exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: `Mărime ${id}` })).toBeVisible();

    await page.getByLabel("product-name RO").fill(`Shadow ${id}`);
    await expect(page.getByLabel("URL slug")).toHaveValue(`shadow-${id}`);
    await page.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: `Mousepad-uri ${id}` }).click();
    await page.getByRole("button", { name: `Add all Mărime ${id} (2)` }).click();
    await expect(page.getByLabel("SKU #1")).toHaveValue(`SHADOW-${id.toUpperCase()}-M`);
    await expect(page.getByLabel("SKU #2")).toHaveValue(`SHADOW-${id.toUpperCase()}-XL`);
    for (const [row, price] of [[1, "350"], [2, "450"]] as const) {
      await page.getByLabel(`Price, MDL #${row}`).fill(price);
      await page.getByLabel(`Weight, g #${row}`).fill("300");
    }

    await page.getByRole("button", { name: "Custom", exact: true }).click();
    await page.getByLabel("custom-0-label RO").fill("Colaborare");
    await page.getByLabel("custom-0-value RO").fill("Ediție limitată");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/catalog\/products\/[0-9a-f-]{36}$/);
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Draft$/ })).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    const problems = page.getByRole("alert").filter({ hasText: "Not saved" });
    await expect(problems).toContainText(`Attributes surface_${id}: Required to publish the product.`);
    await expect(problems).toContainText("Photos: At least one photo is required to publish the product.");

    await page.getByRole("combobox", { name: `Suprafață ${id}` }).or(page.locator(`#attr-${setup.surface.code}`)).first().click();
    await page.getByRole("option", { name: "SPEED" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Unsaved changes")).toBeHidden();

    await page.getByTestId("photo-upload").setInputFiles({ name: `front-${id}.png`, mimeType: "image/png", buffer: await png(page, 800, 600, "#222222") });
    await expect(page.getByTestId("photo")).toHaveCount(1);
    await expect(page.getByTestId("photo").first()).toContainText("Main");

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Active$/ })).toBeVisible();

    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Draft$/ })).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
    await expect(page.locator("[data-slot=badge]").filter({ hasText: /^Archived$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await page.getByRole("button", { name: "Restore as draft" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/admin\/catalog\/products$/);
  });

  test("AC-13 an extra attribute from the library is added to one product", async ({ page }) => {
    const id = unique();
    const setup = await catalog(page, id);
    const created = await product(page, id, setup);

    await page.goto(`/admin/catalog/products/${created.id}`);
    await page.getByRole("button", { name: "Attribute", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Search attributes").fill(`material_${id}`);
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`Material ${id}`) }).click();
    await page.locator(`#attr-material_${id}`).fill("Cauciuc natural");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Unsaved changes")).toBeHidden();

    await page.reload();
    await expect(page.locator(`#attr-material_${id}`)).toHaveValue("Cauciuc natural");
  });

  test("AC-15 every problem is shown at once and nothing typed is lost", async ({ page }) => {
    const id = unique();
    const setup = await catalog(page, id);
    const created = await product(page, id, setup);

    await page.goto(`/admin/catalog/products/${created.id}`);
    await page.getByLabel("SKU #2").fill("");
    await page.getByRole("combobox", { name: `Mărime ${id} #2` }).click();
    await page.getByRole("option", { name: "M", exact: true }).click();
    await page.getByLabel("URL slug").fill("Bad Slug");
    await page.getByRole("button", { name: "Save" }).click();

    const problems = page.getByRole("alert").filter({ hasText: "Not saved" });
    await expect(problems).toContainText("URL slug:");
    await expect(problems).toContainText("Variants #2");
    await expect(page.getByLabel("URL slug")).toHaveValue("Bad Slug");
    await expect(page.getByLabel("URL slug")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("URL slug").fill(`shadow-${id}`);
    await page.getByLabel("SKU #2").fill(`SHD-${id}-XL`);
    await page.getByRole("combobox", { name: `Mărime ${id} #2` }).click();
    await page.getByRole("option", { name: "XL", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(problems).toBeHidden();
    await expect(page.getByText("Unsaved changes")).toBeHidden();
  });

  test("AC-17 leaving with unsaved changes asks first", async ({ page }) => {
    const id = unique();
    const setup = await catalog(page, id);
    const created = await product(page, id, setup);

    await page.goto(`/admin/catalog/products/${created.id}`);
    await page.getByLabel("product-name RO").fill(`Shadow ${id} changed`);

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Brands" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${created.id}$`));

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("Leave without saving? Your changes will be lost.");
      void dialog.accept();
    });
    await page.getByRole("link", { name: "Brands" }).click();
    await expect(page).toHaveURL(/\/admin\/catalog\/brands$/);
  });

  test("AC-20 media library uploads, shows usage, deletes only unused images", async ({ page }) => {
    const id = unique();
    const setup = await catalog(page, id);
    const created = await product(page, id, setup);
    const used = await uploadMedia(page, `used-${id}.png`);
    await page.request.put(`/api/admin/products/${created.id}/images`, {
      data: { images: [{ mediaId: used.id, variantId: null, alt: {}, framing: null }] },
    });

    await page.getByRole("link", { name: "Media" }).click();
    await page.getByTestId("media-upload").setInputFiles([
      { name: `free-${id}.png`, mimeType: "image/png", buffer: await png(page, 300, 300, "#16a34a") },
      { name: `notes-${id}.txt`, mimeType: "text/plain", buffer: Buffer.from("not an image") },
    ]);
    await expect(page.getByText(`notes-${id}.txt was not uploaded`)).toBeVisible();

    await page.getByLabel("Search by file name").fill(id);
    const usedItem = page.getByTestId("media-item").filter({ hasText: `used-${id}` });
    const freeItem = page.getByTestId("media-item").filter({ hasText: `free-${id}` });
    await expect(usedItem).toContainText(`Used by Shadow ${id}`);
    await expect(freeItem).toContainText("Not used");

    await usedItem.getByRole("button", { name: /^Delete/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(/used by/i).filter({ hasText: "cannot be deleted" })).toBeVisible();

    await freeItem.getByRole("button", { name: /^Delete/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(freeItem).toHaveCount(0);
  });

  test("AC-21 AC-22 photos are ordered, described, linked to a variant and cropped per use", async ({ page }) => {
    const id = unique();
    const setup = await catalog(page, id);
    const created = await product(page, id, setup);
    const fromLibrary = await uploadMedia(page, `library-${id}.png`, 400, 400, "#dc2626");

    await page.goto(`/admin/catalog/products/${created.id}`);
    await page.getByTestId("photo-upload").setInputFiles([
      { name: `front-${id}.png`, mimeType: "image/png", buffer: await png(page, 800, 600, "#111111") },
      { name: `back-${id}.png`, mimeType: "image/png", buffer: await png(page, 800, 600, "#2563eb") },
    ]);
    const photos = page.getByTestId("photo");
    await expect(photos).toHaveCount(2);
    await expect(photos.first()).toContainText("Main");

    await page.getByRole("button", { name: "From library" }).click();
    await page.getByRole("dialog").getByLabel("Search by file name").fill(`library-${id}`);
    await page.getByRole("dialog").getByRole("button", { name: `library-${id}.png` }).click();
    await page.getByRole("button", { name: "Add 1 image" }).click();
    await expect(photos).toHaveCount(3);

    await page.getByRole("button", { name: `Move right front-${id}.png` }).click();
    await expect(photos.first()).toHaveAttribute("data-testid", "photo");
    await expect(photos.first().locator("img")).not.toHaveAttribute("src", new RegExp(`front-${id}`));

    await page.getByRole("button", { name: `Edit front-${id}.png` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("crop-size")).toHaveText("800 × 600 px");
    await dialog.getByRole("button", { name: "1:1" }).click();
    await expect(dialog.getByTestId("crop-size")).toHaveText("600 × 600 px");
    const corner = (await dialog.getByTestId("crop-handle-se").boundingBox())!;
    await page.mouse.move(corner.x + 8, corner.y + 8);
    await page.mouse.down();
    await page.mouse.move(corner.x - 100, corner.y - 100, { steps: 5 });
    await page.mouse.up();
    await expect(dialog.getByTestId("crop-size")).not.toHaveText("600 × 600 px");
    await expect(dialog.getByTestId("crop-size")).toHaveText(/^(\d+) × \1 px$/);
    await dialog.getByRole("button", { name: "Focal point" }).click();
    const frame = (await dialog.getByTestId("crop-frame").boundingBox())!;
    await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await expect(dialog.getByTestId("focal-point")).toBeVisible();
    await dialog.getByRole("button", { name: "Crop", exact: true }).click();
    await dialog.getByRole("button", { name: "Rotate right" }).click();
    await expect(dialog.getByTestId("crop-size")).toHaveText("600 × 800 px");
    await dialog.getByRole("button", { name: "1:1" }).click();
    await dialog.getByLabel("photo-alt RO").fill("Shadow văzut din față");
    await dialog.getByRole("combobox", { name: "Shown for" }).click();
    await page.getByRole("option", { name: new RegExp(`SHD-${id}-XL`, "i") }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    const saved = await (await page.request.get(`/api/admin/products/${created.id}`)).json();
    const front = saved.images.find((i: { fileName: string }) => i.fileName.startsWith(`front-${id}`));
    expect(saved.images.map((i: { fileName: string }) => i.fileName.split(".")[0])).toEqual([`back-${id}`, `front-${id}`, `library-${id}`]);
    expect(front.framing.rotation).toBe(90);
    expect([front.width, front.height]).toEqual([600, 600]);
    expect(front.alt.ro).toBe("Shadow văzut din față");
    expect(front.variantId).toBe(created.variants[1].id);
    expect(front.url).toContain("?f=");
    expect(fromLibrary.id).toBeTruthy();
    await expect(photos.nth(1)).toContainText(`SHD-${id}-XL`.toUpperCase());
  });
});
