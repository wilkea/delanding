import { expect, type Page } from "@playwright/test";

export function unique() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export async function post(page: Page, path: string, data: unknown) {
  const response = await page.request.post(path, { data });
  expect(response.ok(), `${path} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function put(page: Page, path: string, data: unknown) {
  const response = await page.request.put(path, { data });
  expect(response.ok(), `${path} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

export async function png(page: Page, width = 400, height = 400, color = "#984afe"): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h, c]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const context = canvas.getContext("2d")!;
      context.fillStyle = c as string;
      context.fillRect(0, 0, w as number, h as number);
      return canvas.toDataURL("image/png");
    },
    [width, height, color],
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

export type Shop = Awaited<ReturnType<typeof createShop>>;

export async function createShop(page: Page, stock = 5) {
  const id = unique();
  await put(page, "/api/admin/checkout/payment-methods/CashOnDelivery", { isEnabled: true, sortOrder: 1 });
  await put(page, "/api/admin/checkout/payment-methods/Test", { isEnabled: true, sortOrder: 2 });
  await put(page, "/api/admin/checkout/delivery-methods/NovaPostBranch", { isEnabled: true, fee: 50, freeFrom: 400, sortOrder: 1 });

  const size = await post(page, "/api/admin/attributes", {
    code: `size_${id}`, name: { ro: `Mărime ${id}` }, dataType: "Option", unit: null, isFilterable: true, showAsSwatches: false,
    options: ["m", "xl"].map((code, sortOrder) => ({ code, label: { ro: code.toUpperCase() }, sortOrder, swatch: null })),
  });
  const type = await post(page, "/api/admin/product-types", {
    code: `pad_${id}`, name: { ro: `Pad ${id}` }, attributes: [{ attributeId: size.id, isRequired: true, isVariantAxis: true, sortOrder: 0 }],
  });
  const category = await post(page, "/api/admin/categories", { parentId: null, slug: `shop-${id}`, name: { ro: `Shop ${id}` }, sortOrder: 0, isActive: true });
  const product = await post(page, "/api/admin/products", {
    productTypeId: type.id, categoryId: category.id, brandId: null, slug: `shadow-${id}`, name: { ro: `Shadow ${id}` },
    description: null, attributes: null, customAttributes: null, vatRate: null,
    variants: [["m", 450], ["xl", 650]].map(([s, price], i) => ({
      id: null, sku: `SHD-${id}-${s}`.toUpperCase(), barcode: null, price, options: { [size.code]: s },
      weightGrams: 300, lengthMm: null, widthMm: null, heightMm: null, isActive: true, sortOrder: i,
    })),
  });
  const upload = await page.request.post("/api/admin/media", {
    multipart: { file: { name: `shop-${id}.png`, mimeType: "image/png", buffer: await png(page) } },
  });
  const photo = await upload.json();
  await put(page, `/api/admin/products/${product.id}/images`, { images: [{ mediaId: photo.id, variantId: null, alt: {}, framing: null }] });
  await post(page, `/api/admin/products/${product.id}/status`, { status: "Active" });

  const location = (name: string, isSellable = true) =>
    post(page, "/api/admin/inventory/locations", { name: `${name} ${id}`, contactName: null, phone: null, city: "Chișinău", address: null, isSellable });
  const house1 = await location("House 1");
  const defective = await location("Defective", false);
  const variant = (s: "m" | "xl") => product.variants.find((v: { sku: string }) => v.sku.endsWith(`-${s.toUpperCase()}`)).id as string;
  const sku = (s: "m" | "xl") => `SHD-${id}-${s}`.toUpperCase();
  if (stock > 0) {
    await post(page, "/api/admin/inventory/receipts", {
      locationId: house1.id, supplier: null, note: null,
      lines: [{ variantId: variant("xl"), quantity: stock, unitCost: 210 }, { variantId: variant("m"), quantity: stock, unitCost: 140 }],
    });
  }

  return { id, product, house1, defective, variant, sku };
}

export async function placeOrder(page: Page, shop: Shop, lines: [("m" | "xl"), number][], payment = "CashOnDelivery", phone?: string) {
  const cart = lines.map(([s, quantity]) => ({ variantId: shop.variant(s), quantity }));
  const quote = await post(page, "/api/checkout/quote", { lines: cart, promoCode: null, selectedOfferId: null, deliveryMethod: "NovaPostBranch" });
  return (await post(page, "/api/checkout/orders", {
    lines: cart,
    promoCode: null,
    selectedOfferId: null,
    expectedTotal: quote.total,
    customer: { firstName: "Ana", lastName: `Popescu ${shop.id}`, phone: phone ?? `069 ${100 + Math.floor(Math.random() * 899)} ${100 + Math.floor(Math.random() * 899)}`, email: "ana.popescu@example.com", note: "Sunați înainte" },
    delivery: { method: "NovaPostBranch", city: "Chișinău", point: "Branch 5" },
    paymentMethod: payment,
  })) as { orderId: string; number: number; accessToken: string; total: number };
}

export async function act(page: Page, orderId: string, action: string, body: unknown = {}) {
  return post(page, `/api/admin/orders/${orderId}/${action}`, body);
}
