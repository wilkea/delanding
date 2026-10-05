"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { LocalizedInput } from "@/components/admin/localized-input";
import { PageHeader } from "@/components/admin/page-header";
import { ServerErrors, submitWith, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect, type SelectOption } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { useUnsavedChanges } from "@/components/admin/use-unsaved-changes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, call } from "@/lib/api/client";
import { cleanLocalized, textOf, type Localized, type Schemas } from "@/lib/api/types";
import { categoryOptions } from "../catalog/category-tree";
import { fromLocalInput, toLocalInput, type Discount } from "./discounts-shared";

type TargetType = Schemas["DiscountTargetType"];
type Values = {
  name: Localized;
  kind: Schemas["DiscountKind"];
  percent: string;
  buyQuantity: string;
  freeQuantity: string;
  activation: Schemas["DiscountActivation"];
  code: string;
  startsAt: string;
  endsAt: string;
  minOrderAmount: string;
  usageLimitTotal: string;
  usageLimitPerCustomer: string;
  isActive: boolean;
  targets: { type: TargetType; targetId: string | null }[];
};

const targetTypes: TargetType[] = ["All", "Category", "ProductType", "Brand", "Product", "Variant"];
const text = (n: number | string | null | undefined) => (n == null ? "" : String(n));
const optional = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));

function useTargetOptions() {
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => call(api.GET("/api/admin/categories")) });
  const types = useQuery({ queryKey: ["productTypes"], queryFn: () => call(api.GET("/api/admin/product-types")) });
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => call(api.GET("/api/admin/brands")) });
  const products = useQuery({
    queryKey: ["products", { pageSize: 100 }],
    queryFn: () => call(api.GET("/api/admin/products", { params: { query: { page: 1, pageSize: 100 } } })),
  });
  const variants = useQuery({
    queryKey: ["stock", { pageSize: 200 }],
    queryFn: () => call(api.GET("/api/admin/inventory/stock", { params: { query: { page: 1, pageSize: 200 } } })),
  });

  return (type: TargetType): SelectOption[] => {
    switch (type) {
      case "Category":
        return categoryOptions(categories.data ?? []);
      case "ProductType":
        return (types.data ?? []).map((x) => ({ value: x.id, label: textOf(x.name) }));
      case "Brand":
        return (brands.data ?? []).map((x) => ({ value: x.id, label: x.name }));
      case "Product":
        return (products.data?.items ?? []).map((x) => ({ value: x.id, label: textOf(x.name) }));
      case "Variant":
        return (variants.data?.items ?? []).map((x) => ({ value: x.variantId, label: `${x.sku} · ${textOf(x.productName)}` }));
      default:
        return [];
    }
  };
}

function defaults(discount: Discount | null): Values {
  return discount
    ? {
        name: discount.name,
        kind: discount.kind,
        percent: text(discount.percent),
        buyQuantity: text(discount.buyQuantity),
        freeQuantity: text(discount.freeQuantity),
        activation: discount.activation,
        code: discount.code ?? "",
        startsAt: toLocalInput(discount.startsAt),
        endsAt: toLocalInput(discount.endsAt),
        minOrderAmount: text(discount.minOrderAmount),
        usageLimitTotal: text(discount.usageLimitTotal),
        usageLimitPerCustomer: text(discount.usageLimitPerCustomer),
        isActive: discount.isActive,
        targets: discount.targets.map((x) => ({ type: x.type, targetId: x.targetId })),
      }
    : {
        name: {},
        kind: "Percentage",
        percent: "",
        buyQuantity: "2",
        freeQuantity: "1",
        activation: "Automatic",
        code: "",
        startsAt: toLocalInput(new Date().toISOString()),
        endsAt: "",
        minOrderAmount: "",
        usageLimitTotal: "",
        usageLimitPerCustomer: "",
        isActive: true,
        targets: [{ type: "All", targetId: null }],
      };
}

export function DiscountForm({ discount }: { discount: Discount | null }) {
  const t = useTranslations("admin.discounts");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const router = useRouter();
  const queryClient = useQueryClient();
  const targetOptions = useTargetOptions();
  const form = useForm<Values>({ defaultValues: defaults(discount) });
  const targets = useFieldArray({ control: form.control, name: "targets" });
  const kind = useWatch({ control: form.control, name: "kind" });
  const activation = useWatch({ control: form.control, name: "activation" });
  const watchedTargets = useWatch({ control: form.control, name: "targets" }) ?? [];
  const server = useServerErrors(form.setError, {
    name: t("name"),
    percent: t("percent"),
    buyQuantity: t("buy"),
    freeQuantity: t("free"),
    code: t("code"),
    startsAt: t("startsAt"),
    endsAt: t("endsAt"),
    minOrderAmount: t("minOrder"),
    usageLimitTotal: t("usageTotal"),
    usageLimitPerCustomer: t("usagePerCustomer"),
    targets: t("targets"),
  });

  useUnsavedChanges(form.formState.isDirty, t("leaveConfirm"));

  async function onSubmit(v: Values) {
    server.clear();
    const body = {
      name: cleanLocalized(v.name),
      kind: v.kind,
      percent: v.kind === "Percentage" ? optional(v.percent) : null,
      buyQuantity: v.kind === "BuyXGetY" ? optional(v.buyQuantity) : null,
      freeQuantity: v.kind === "BuyXGetY" ? optional(v.freeQuantity) : null,
      activation: v.activation,
      code: v.activation === "Code" ? v.code.trim() : null,
      startsAt: fromLocalInput(v.startsAt) ?? new Date().toISOString(),
      endsAt: fromLocalInput(v.endsAt),
      minOrderAmount: optional(v.minOrderAmount),
      usageLimitTotal: v.activation === "Code" ? optional(v.usageLimitTotal) : null,
      usageLimitPerCustomer: v.activation === "Code" ? optional(v.usageLimitPerCustomer) : null,
      isActive: v.isActive,
      targets: v.targets.map((x) => ({ type: x.type, targetId: x.type === "All" ? null : x.targetId })),
    };

    try {
      const saved = discount
        ? await call(api.PUT("/api/admin/discounts/{id}", { params: { path: { id: discount.id } }, body }))
        : await call(api.POST("/api/admin/discounts", { body }));
      await queryClient.invalidateQueries({ queryKey: ["discounts"] });
      queryClient.setQueryData(["discount", saved.id], saved);
      form.reset(defaults(saved));
      notify.saved();
      router.push("/admin/discounts");
    } catch (error) {
      server.show(error);
    }
  }

  async function remove() {
    if (!discount) {
      return;
    }

    try {
      await call(api.DELETE("/api/admin/discounts/{id}", { params: { path: { id: discount.id } } }));
      await queryClient.invalidateQueries({ queryKey: ["discounts"] });
      form.reset(form.getValues());
      notify.deleted();
      router.push("/admin/discounts");
    } catch (error) {
      notify.failed(error);
    }
  }

  const errors = form.formState.errors;
  const num = (name: "percent" | "buyQuantity" | "freeQuantity" | "minOrderAmount" | "usageLimitTotal" | "usageLimitPerCustomer", label: string, hint?: string, suffix?: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`discount-${name}`}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id={`discount-${name}`} inputMode="decimal" aria-invalid={!!errors[name]} {...form.register(name)} />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <FieldDescription>{hint}</FieldDescription>}
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  return (
    <form className="mx-auto flex max-w-3xl flex-col gap-5 pb-16" onSubmit={submitWith(form, onSubmit)} noValidate>
      <PageHeader
        title={discount ? t("editTitle") : t("new")}
        description={discount ? t("usedTimes", { count: Number(discount.timesUsed) }) : t("newHint")}
        actions={
          <Link href="/admin/discounts" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft className="size-4" />
            {t("title")}
          </Link>
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="discount-name">{t("name")}</FieldLabel>
            <Controller control={form.control} name="name" render={({ field }) => (
              <LocalizedInput id="discount-name" value={field.value} onChange={field.onChange} invalid={!!errors.name} placeholder={t("namePlaceholder")} />
            )} />
            <FieldDescription>{t("nameHint")}</FieldDescription>
            <FieldError errors={[errors.name]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="discount-kind">{t("kind")}</FieldLabel>
              <Controller control={form.control} name="kind" render={({ field }) => (
                <SimpleSelect
                  id="discount-kind"
                  value={field.value}
                  options={[{ value: "Percentage", label: t("kinds.Percentage") }, { value: "BuyXGetY", label: t("kinds.BuyXGetY") }]}
                  onChange={(v) => field.onChange(v as Values["kind"])}
                />
              )} />
            </Field>
            {kind === "Percentage" ? (
              num("percent", t("percent"), undefined, "%")
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {num("buyQuantity", t("buy"))}
                {num("freeQuantity", t("free"))}
              </div>
            )}
          </div>
          {kind === "BuyXGetY" && <p className="text-xs text-muted-foreground">{t("buyXGetYHint")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("howItStarts")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="discount-activation">{t("activation")}</FieldLabel>
              <Controller control={form.control} name="activation" render={({ field }) => (
                <SimpleSelect
                  id="discount-activation"
                  value={field.value}
                  options={[{ value: "Automatic", label: t("activations.Automatic") }, { value: "Code", label: t("activations.Code") }]}
                  onChange={(v) => field.onChange(v as Values["activation"])}
                />
              )} />
            </Field>
            {activation === "Code" && (
              <Field data-invalid={!!errors.code}>
                <FieldLabel htmlFor="discount-code">{t("code")}</FieldLabel>
                <Input id="discount-code" className="font-mono uppercase" placeholder="DEPAD10" aria-invalid={!!errors.code} {...form.register("code")} />
                <FieldError errors={[errors.code]} />
              </Field>
            )}
          </div>
          {activation === "Code" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {num("usageLimitTotal", t("usageTotal"), t("noLimit"))}
              {num("usageLimitPerCustomer", t("usagePerCustomer"), t("perCustomerHint"))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!errors.startsAt}>
              <FieldLabel htmlFor="discount-startsAt">{t("startsAt")}</FieldLabel>
              <Input id="discount-startsAt" type="datetime-local" {...form.register("startsAt")} />
              <FieldError errors={[errors.startsAt]} />
            </Field>
            <Field data-invalid={!!errors.endsAt}>
              <FieldLabel htmlFor="discount-endsAt">{t("endsAt")}</FieldLabel>
              <Input id="discount-endsAt" type="datetime-local" aria-invalid={!!errors.endsAt} {...form.register("endsAt")} />
              <FieldDescription>{t("noEnd")}</FieldDescription>
              <FieldError errors={[errors.endsAt]} />
            </Field>
            {num("minOrderAmount", t("minOrder"), t("minOrderHint"), "MDL")}
          </div>
          <Field orientation="horizontal">
            <Controller control={form.control} name="isActive" render={({ field }) => (
              <Switch id="discount-active" checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
            )} />
            <FieldLabel htmlFor="discount-active">{t("isActive")}</FieldLabel>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("targets")}</CardTitle>
          <CardDescription>{t("targetsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {targets.fields.map((row, index) => {
            const type = watchedTargets[index]?.type ?? "All";
            const rowError = (errors.targets?.[index] as { targetId?: { message?: string }; message?: string } | undefined);
            return (
              <div key={row.id} className="flex flex-wrap items-start gap-2" data-testid={`target-${index}`}>
                <Controller control={form.control} name={`targets.${index}.type`} render={({ field }) => (
                  <SimpleSelect
                    aria-label={`${t("targetType")} #${index + 1}`}
                    className="w-40"
                    value={field.value}
                    options={targetTypes.map((x) => ({ value: x, label: t(`targetTypes.${x}`) }))}
                    onChange={(v) => {
                      field.onChange(v as TargetType);
                      form.setValue(`targets.${index}.targetId`, null);
                    }}
                  />
                )} />
                {type !== "All" && (
                  <Controller control={form.control} name={`targets.${index}.targetId`} render={({ field }) => (
                    <SimpleSelect
                      aria-label={`${t("target")} #${index + 1}`}
                      className="min-w-56 flex-1"
                      value={field.value}
                      invalid={!!rowError?.targetId}
                      placeholder={t("chooseTarget")}
                      options={targetOptions(type)}
                      onChange={field.onChange}
                    />
                  )} />
                )}
                {targets.fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`${tc("remove")} #${index + 1}`} onClick={() => targets.remove(index)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <FieldError className="w-full" errors={[rowError?.targetId, rowError?.message ? rowError : undefined]} />
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => targets.append({ type: "Category", targetId: null })}>
            <Plus className="size-4" />
            {t("addTarget")}
          </Button>
        </CardContent>
      </Card>

      <ServerErrors messages={server.messages} />
      <div className="flex flex-wrap justify-end gap-2">
        {discount && (
          <ConfirmButton
            title={t("deleteTitle")}
            description={t("deleteHint")}
            onConfirm={remove}
            trigger={<Button type="button" variant="ghost" className="mr-auto text-destructive">{tc("delete")}</Button>}
          />
        )}
        <Link href="/admin/discounts" className={buttonVariants({ variant: "outline" })}>{tc("cancel")}</Link>
        <Button type="submit" disabled={form.formState.isSubmitting}>{tc("save")}</Button>
      </div>
    </form>
  );
}
