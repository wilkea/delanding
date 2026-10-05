"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, ArchiveRestore, Eye, EyeOff, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { LocalizedInput } from "@/components/admin/localized-input";
import { ServerErrors, submitWith, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { useShopSettings } from "@/components/admin/use-shop-settings";
import { useUnsavedChanges } from "@/components/admin/use-unsaved-changes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, call } from "@/lib/api/client";
import { textOf, type Schemas } from "@/lib/api/types";
import { toSlug } from "@/lib/text";
import { categoryOptions } from "../category-tree";
import { AttributeInput } from "./attribute-input";
import { AttributePicker } from "./attribute-picker";
import { ProductPhotos } from "./product-photos";
import { StatusBadge } from "./product-status";
import { emptyValue, NO_BRAND, toRequest, toValues, type Attribute, type Product, type ProductType, type ProductValues } from "./product-values";
import { VariantsTable } from "./variants-table";

type Props = { productId?: string; typeId?: string };

export function ProductEditor({ productId, typeId }: Props) {
  const t = useTranslations("admin.products");
  const product = useQuery({
    queryKey: ["product", productId],
    queryFn: () => call(api.GET("/api/admin/products/{id}", { params: { path: { id: productId! } } })),
    enabled: !!productId,
  });
  const types = useQuery({ queryKey: ["productTypes"], queryFn: () => call(api.GET("/api/admin/product-types")) });
  const library = useQuery({ queryKey: ["attributes", ""], queryFn: () => call(api.GET("/api/admin/attributes", {})) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => call(api.GET("/api/admin/categories")) });
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => call(api.GET("/api/admin/brands")) });

  const type = types.data?.find((x) => x.id === (product.data?.productTypeId ?? typeId));
  const ready = (!productId || product.data) && types.data && library.data && categories.data && brands.data;

  if (ready && !type) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="text-muted-foreground">{t("typeMissing")}</p>
        <Link href="/admin/catalog/products" className="mt-4 inline-block text-primary underline">
          {t("backToList")}
        </Link>
      </div>
    );
  }

  if (!ready || !type) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <ProductForm
      key={product.data?.id ?? "new"}
      product={product.data ?? null}
      type={type}
      library={library.data!}
      categories={categories.data!}
      brands={brands.data!}
    />
  );
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

type FormProps = {
  product: Product | null;
  type: ProductType;
  library: Attribute[];
  categories: Schemas["CategoryResponse"][];
  brands: Schemas["BrandResponse"][];
};

function ProductForm({ product, type, library: loadedLibrary, categories, brands }: FormProps) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const router = useRouter();
  const queryClient = useQueryClient();
  const shop = useShopSettings();
  const [created, setCreated] = useState<Attribute[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!product);

  const library = useMemo(() => {
    const known = new Set(loadedLibrary.map((a) => a.id));
    return [...loadedLibrary, ...created.filter((a) => !known.has(a.id))];
  }, [loadedLibrary, created]);
  const byId = new Map(library.map((a) => [a.id, a]));
  const byCode = new Map(library.map((a) => [a.code, a]));
  const typeAttributes = [...type.attributes].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  const axes = typeAttributes.filter((a) => a.isVariantAxis).map((a) => byId.get(a.attributeId)).filter(Boolean) as Attribute[];
  const fields = typeAttributes.filter((a) => !a.isVariantAxis);

  const [initial] = useState(() => toValues(product, type, loadedLibrary, axes));
  const form = useForm<ProductValues>({ defaultValues: initial });
  const server = useServerErrors(form.setError, {
    name: t("name"),
    slug: t("slug"),
    description: t("descriptionLabel"),
    categoryId: t("category"),
    brandId: t("brand"),
    vatRate: t("vat"),
    attributes: t("attributes"),
    customAttributes: t("customAttributes"),
    variants: t("variants"),
    images: t("photos"),
  });
  const custom = useFieldArray({ control: form.control, name: "customAttributes" });
  const extra = useWatch({ control: form.control, name: "extra" }) ?? [];
  const nameRo = useWatch({ control: form.control, name: "name.ro" });
  const dirty = form.formState.isDirty;

  useUnsavedChanges(dirty && !busy, t("leaveConfirm"));

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", toSlug(nameRo ?? ""), { shouldDirty: true });
    }
  }, [nameRo, slugTouched, form]);

  async function save(values: ProductValues): Promise<Product | null> {
    server.clear();
    setBusy(true);
    try {
      const body = toRequest(values, library, axes);
      const saved = product
        ? await call(api.PUT("/api/admin/products/{id}", { params: { path: { id: product.id } }, body }))
        : await call(api.POST("/api/admin/products", { body: { ...body, productTypeId: type.id } }));

      queryClient.setQueryData(["product", saved.id], saved);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      form.reset(toValues(saved, type, library, axes));
      notify.saved();
      if (!product) {
        router.replace(`/admin/catalog/products/${saved.id}`);
      }
      return saved;
    } catch (error) {
      server.show(error);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: Schemas["ProductStatus"]) {
    if (!product) {
      return;
    }

    server.clear();
    setBusy(true);
    try {
      const saved = await call(api.POST("/api/admin/products/{id}/status", { params: { path: { id: product.id } }, body: { status } }));
      queryClient.setQueryData(["product", saved.id], saved);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify.saved();
    } catch (error) {
      server.show(error);
    } finally {
      setBusy(false);
    }
  }

  const publish = submitWith(form, async (values) => {
    if (form.formState.isDirty && !(await save(values))) {
      return;
    }

    await changeStatus("Active");
  });

  async function remove() {
    if (!product) {
      return;
    }

    try {
      await call(api.DELETE("/api/admin/products/{id}", { params: { path: { id: product.id } } }));
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      form.reset(form.getValues());
      notify.deleted();
      router.replace("/admin/catalog/products");
    } catch (error) {
      notify.failed(error);
    }
  }

  function addExtra(attribute: Attribute) {
    setCreated((list) => [...list, attribute]);
    form.setValue("extra", [...form.getValues("extra"), attribute.code], { shouldDirty: true });
    form.setValue(`attributes.${attribute.code}`, emptyValue(attribute), { shouldDirty: true });
  }

  function removeExtra(code: string) {
    form.setValue("extra", form.getValues("extra").filter((c) => c !== code), { shouldDirty: true });
    const { [code]: _removed, ...rest } = form.getValues("attributes");
    void _removed;
    form.setValue("attributes", rest, { shouldDirty: true });
  }

  const status = product?.status;
  const errors = form.formState.errors;
  const attributeError = (code: string) => (errors.attributes as Record<string, { message?: string }> | undefined)?.[code];
  const excluded = new Set([...typeAttributes.map((a) => byId.get(a.attributeId)?.code ?? ""), ...extra]);

  return (
    <form className="mx-auto flex max-w-5xl flex-col gap-5 pb-16" onSubmit={submitWith(form, save)} noValidate>
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Link href="/admin/catalog/products" aria-label={t("backToList")} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-xl font-medium">{textOf(product?.name) || t("new")}</h1>
          <p className="text-xs text-muted-foreground">
            {textOf(type.name)}
            {dirty && <span className="ml-2 text-amber-600">● {t("unsaved")}</span>}
          </p>
        </div>
        {status && <StatusBadge status={status} />}
        <div className="flex flex-wrap gap-2">
          {status === "Draft" && (
            <ConfirmButton
              title={t("deleteTitle")}
              description={t("deleteHint")}
              onConfirm={remove}
              trigger={
                <Button type="button" variant="ghost" disabled={busy}>
                  <Trash2 className="size-4" />
                  {tc("delete")}
                </Button>
              }
            />
          )}
          {(status === "Draft" || status === "Active") && (
            <ConfirmButton
              title={t("archiveTitle")}
              description={t("archiveHint")}
              confirmLabel={t("archive")}
              onConfirm={() => changeStatus("Archived")}
              trigger={
                <Button type="button" variant="ghost" disabled={busy}>
                  <Archive className="size-4" />
                  {t("archive")}
                </Button>
              }
            />
          )}
          {status === "Archived" && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeStatus("Draft")}>
              <ArchiveRestore className="size-4" />
              {t("restore")}
            </Button>
          )}
          {status === "Active" && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeStatus("Draft")}>
              <EyeOff className="size-4" />
              {t("unpublish")}
            </Button>
          )}
          {product && status !== "Active" && (
            <Button type="button" variant="outline" disabled={busy} onClick={publish}>
              <Eye className="size-4" />
              {t("publish")}
            </Button>
          )}
          <Button type="submit" disabled={busy || (!!product && !dirty)}>
            <Save className="size-4" />
            {tc("save")}
          </Button>
        </div>
      </div>

      <ServerErrors messages={server.messages} />

      <Section title={t("basics")}>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="product-name">{t("name")}</FieldLabel>
          <Controller control={form.control} name="name" render={({ field }) => (
            <LocalizedInput id="product-name" value={field.value} onChange={field.onChange} invalid={!!errors.name} />
          )} />
          <FieldError errors={[errors.name]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.slug}>
            <FieldLabel htmlFor="product-slug">{t("slug")}</FieldLabel>
            <Input id="product-slug" aria-invalid={!!errors.slug} {...form.register("slug", { onChange: () => setSlugTouched(true) })} />
            <FieldError errors={[errors.slug]} />
          </Field>
          <Field data-invalid={!!errors.vatRate}>
            <FieldLabel htmlFor="product-vat">{t("vat")}</FieldLabel>
            <Input id="product-vat" inputMode="decimal" placeholder={shop.data ? t("vatDefault", { rate: Number(shop.data.vatRate) }) : ""} aria-invalid={!!errors.vatRate} {...form.register("vatRate")} />
            <FieldError errors={[errors.vatRate]} />
          </Field>
          <Field data-invalid={!!errors.categoryId}>
            <FieldLabel htmlFor="product-category">{t("category")}</FieldLabel>
            <Controller control={form.control} name="categoryId" render={({ field }) => (
              <SimpleSelect
                id="product-category"
                invalid={!!errors.categoryId}
                value={field.value || null}
                placeholder={t("chooseCategory")}
                options={categoryOptions(categories)}
                onChange={field.onChange}
              />
            )} />
            <FieldError errors={[errors.categoryId]} />
          </Field>
          <Field data-invalid={!!errors.brandId}>
            <FieldLabel htmlFor="product-brand">{t("brand")}</FieldLabel>
            <Controller control={form.control} name="brandId" render={({ field }) => (
              <SimpleSelect
                id="product-brand"
                value={field.value}
                options={[{ value: NO_BRAND, label: t("noBrand") }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
                onChange={field.onChange}
              />
            )} />
            <FieldError errors={[errors.brandId]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="product-description">{t("descriptionLabel")}</FieldLabel>
          <Controller control={form.control} name="description" render={({ field }) => (
            <LocalizedInput id="product-description" multiline value={field.value} onChange={field.onChange} />
          )} />
        </Field>
      </Section>

      <Section
        title={t("attributes")}
        description={t("attributesHint")}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
            <Plus className="size-4" />
            {t("attribute")}
          </Button>
        }
      >
        {fields.length === 0 && extra.length === 0 && <p className="text-sm text-muted-foreground">{t("noAttributes")}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((entry) => {
            const attribute = byId.get(entry.attributeId);
            return attribute ? (
              <AttributeField key={attribute.code} form={form} attribute={attribute} required={entry.isRequired} error={attributeError(attribute.code)} />
            ) : null;
          })}
          {extra.map((code) => {
            const attribute = byCode.get(code);
            return attribute ? (
              <AttributeField
                key={code}
                form={form}
                attribute={attribute}
                error={attributeError(code)}
                onRemove={() => removeExtra(code)}
                removeLabel={`${tc("remove")} ${code}`}
              />
            ) : null;
          })}
        </div>
      </Section>

      <Section
        title={t("customAttributes")}
        description={t("customHint")}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => custom.append({ label: {}, value: {} })}>
            <Plus className="size-4" />
            {t("addCustom")}
          </Button>
        }
      >
        {custom.fields.length === 0 && <p className="text-sm text-muted-foreground">{t("noCustom")}</p>}
        {custom.fields.map((row, index) => {
          const rowErrors = errors.customAttributes?.[index];
          return (
            <div key={row.id} className="grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]">
              <Controller control={form.control} name={`customAttributes.${index}.label`} render={({ field }) => (
                <LocalizedInput id={`custom-${index}-label`} placeholder={t("customLabel")} value={field.value} onChange={field.onChange} invalid={!!rowErrors?.label} />
              )} />
              <Controller control={form.control} name={`customAttributes.${index}.value`} render={({ field }) => (
                <LocalizedInput id={`custom-${index}-value`} placeholder={t("customValue")} value={field.value} onChange={field.onChange} invalid={!!rowErrors?.value} />
              )} />
              <Button type="button" variant="ghost" size="icon" className="mt-7" aria-label={`${tc("remove")} custom #${index + 1}`} onClick={() => custom.remove(index)}>
                <Trash2 className="size-4" />
              </Button>
              <FieldError className="sm:col-span-3" errors={[rowErrors?.label, rowErrors?.value]} />
            </div>
          );
        })}
      </Section>

      <Section title={t("variants")} description={axes.length > 0 ? t("variantsHint", { axes: axes.map((a) => textOf(a.name)).join(", ") }) : undefined}>
        <VariantsTable form={form} axes={axes} />
      </Section>

      <Section title={t("photos")} description={product ? t("photosHint") : undefined}>
        {product ? <ProductPhotos product={product} /> : <p className="text-sm text-muted-foreground">{t("photosAfterSave")}</p>}
      </Section>

      <AttributePicker open={picking} onOpenChange={setPicking} library={library} exclude={excluded} onPick={addExtra} />
    </form>
  );
}

type FieldProps = {
  form: UseFormReturn<ProductValues>;
  attribute: Attribute;
  required?: boolean;
  error?: { message?: string };
  onRemove?: () => void;
  removeLabel?: string;
};

function AttributeField({ form, attribute, required, error, onRemove, removeLabel }: FieldProps) {
  const id = `attr-${attribute.code}`;
  return (
    <Field data-invalid={!!error}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>
          {textOf(attribute.name)}
          {required && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {onRemove && (
          <button type="button" aria-label={removeLabel} className="rounded p-0.5 text-muted-foreground hover:text-foreground" onClick={onRemove}>
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <Controller
        control={form.control}
        name={`attributes.${attribute.code}`}
        render={({ field }) => <AttributeInput id={id} attribute={attribute} value={field.value} onChange={field.onChange} invalid={!!error} />}
      />
      <FieldError errors={[error]} />
    </Field>
  );
}
