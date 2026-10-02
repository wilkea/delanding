import { cleanLocalized, type Localized, type Schemas } from "@/lib/api/types";
import { toSkuPart } from "@/lib/text";

export type Attribute = Schemas["AttributeResponse"];
export type Product = Schemas["ProductResponse"];
export type ProductType = Schemas["ProductTypeResponse"];

export type AttributeValue = string | string[] | Localized;

export type VariantValues = {
  id: string | null;
  sku: string;
  barcode: string;
  price: string;
  options: Record<string, string>;
  weightGrams: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  isActive: boolean;
};

export type ProductValues = {
  name: Localized;
  slug: string;
  description: Localized;
  categoryId: string;
  brandId: string;
  vatRate: string;
  attributes: Record<string, AttributeValue>;
  extra: string[];
  customAttributes: { label: Localized; value: Localized }[];
  variants: VariantValues[];
};

export const NO_BRAND = "none";

export function emptyValue(attribute: Attribute): AttributeValue {
  switch (attribute.dataType) {
    case "MultiOption":
      return [];
    case "LocalizedText":
      return {};
    default:
      return "";
  }
}

function fromJson(attribute: Attribute, json: unknown): AttributeValue {
  switch (attribute.dataType) {
    case "MultiOption":
      return Array.isArray(json) ? json.map(String) : [];
    case "LocalizedText":
      return json && typeof json === "object" ? (json as Localized) : {};
    case "Boolean":
      return typeof json === "boolean" ? String(json) : "";
    default:
      return json == null ? "" : String(json);
  }
}

export function toJson(attribute: Attribute, value: AttributeValue | undefined): unknown {
  switch (attribute.dataType) {
    case "MultiOption":
      return Array.isArray(value) && value.length > 0 ? value : undefined;
    case "LocalizedText": {
      const text = cleanLocalized(value as Localized | undefined);
      return Object.keys(text).length > 0 ? text : undefined;
    }
    case "Number": {
      const text = String(value ?? "").trim().replace(",", ".");
      return text === "" ? undefined : Number.isFinite(Number(text)) ? Number(text) : text;
    }
    case "Boolean":
      return value === "true" ? true : value === "false" ? false : undefined;
    default: {
      const text = String(value ?? "").trim();
      return text === "" ? undefined : text;
    }
  }
}

const text = (value: number | string | null | undefined) => (value == null ? "" : String(value));

export function blankVariant(axes: Attribute[], slug: string, options: Record<string, string> = {}, copyFrom?: VariantValues): VariantValues {
  const suffix = axes.map((axis) => options[axis.code]).filter(Boolean).map((code) => toSkuPart(code));
  const sku = slug ? [toSkuPart(slug), ...suffix].join("-") : "";
  return {
    id: null,
    sku,
    barcode: "",
    price: copyFrom?.price ?? "",
    options,
    weightGrams: copyFrom?.weightGrams ?? "",
    lengthMm: copyFrom?.lengthMm ?? "",
    widthMm: copyFrom?.widthMm ?? "",
    heightMm: copyFrom?.heightMm ?? "",
    isActive: true,
  };
}

export function toValues(product: Product | null, type: ProductType, library: Attribute[], axes: Attribute[]): ProductValues {
  const byCode = new Map(library.map((a) => [a.code, a]));
  const typeIds = new Set(type.attributes.map((a) => a.attributeId));
  const fields = type.attributes.filter((a) => !a.isVariantAxis).map((a) => library.find((l) => l.id === a.attributeId)).filter(Boolean) as Attribute[];
  const saved = (product?.attributes ?? {}) as Record<string, unknown>;
  const extra = Object.keys(saved).filter((code) => byCode.has(code) && !typeIds.has(byCode.get(code)!.id));

  const attributes: Record<string, AttributeValue> = {};
  for (const attribute of [...fields, ...extra.map((code) => byCode.get(code)!)]) {
    attributes[attribute.code] = attribute.code in saved ? fromJson(attribute, saved[attribute.code]) : emptyValue(attribute);
  }

  return {
    name: product?.name ?? {},
    slug: product?.slug ?? "",
    description: product?.description ?? {},
    categoryId: product?.categoryId ?? "",
    brandId: product?.brandId ?? NO_BRAND,
    vatRate: text(product?.vatRate),
    attributes,
    extra,
    customAttributes: (product?.customAttributes ?? []).map((c) => ({ label: c.label, value: c.value })),
    variants: product
      ? product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          barcode: v.barcode ?? "",
          price: text(v.price),
          options: { ...v.options },
          weightGrams: text(v.weightGrams),
          lengthMm: text(v.lengthMm),
          widthMm: text(v.widthMm),
          heightMm: text(v.heightMm),
          isActive: v.isActive,
        }))
      : axes.length === 0
        ? [blankVariant(axes, "")]
        : [],
  };
}

const integer = (value: string) => (value.trim() === "" ? null : Number(value));

export function toRequest(values: ProductValues, library: Attribute[], axes: Attribute[]) {
  const byCode = new Map(library.map((a) => [a.code, a]));
  const attributes = Object.fromEntries(
    Object.entries(values.attributes)
      .map(([code, value]) => [code, byCode.has(code) ? toJson(byCode.get(code)!, value) : undefined] as const)
      .filter(([, json]) => json !== undefined),
  );

  return {
    categoryId: values.categoryId,
    brandId: values.brandId === NO_BRAND ? null : values.brandId,
    slug: values.slug.trim(),
    name: cleanLocalized(values.name),
    description: cleanLocalized(values.description),
    attributes: attributes as Record<string, never>,
    customAttributes: values.customAttributes.map((c) => ({ label: cleanLocalized(c.label), value: cleanLocalized(c.value) })),
    vatRate: values.vatRate.trim() === "" ? null : Number(values.vatRate.replace(",", ".")),
    variants: values.variants.map((v, index) => ({
      id: v.id,
      sku: v.sku.trim(),
      barcode: v.barcode.trim() || null,
      price: Number(v.price.replace(",", ".")) || 0,
      options: axes.length > 0 ? v.options : null,
      weightGrams: integer(v.weightGrams) ?? 0,
      lengthMm: integer(v.lengthMm),
      widthMm: integer(v.widthMm),
      heightMm: integer(v.heightMm),
      isActive: v.isActive,
      sortOrder: index,
    })),
  };
}

export function missingCombinations(axes: Attribute[], variants: VariantValues[]): Record<string, string>[] {
  const combos = axes.reduce<Record<string, string>[]>(
    (acc, axis) => acc.flatMap((combo) => axis.options.map((o) => ({ ...combo, [axis.code]: o.code }))),
    [{}],
  );
  const key = (options: Record<string, string>) => axes.map((a) => options[a.code] ?? "").join("|");
  const existing = new Set(variants.map((v) => key(v.options)));
  return axes.length === 0 ? [] : combos.filter((combo) => !existing.has(key(combo)));
}
