"use client";

import { Plus, Trash2, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { SimpleSelect } from "@/components/admin/simple-select";
import { Swatch } from "@/components/admin/swatch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { textOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { blankVariant, missingCombinations, type Attribute, type ProductValues } from "./product-values";

type VariantErrors = Partial<Record<string, { message?: string } | Record<string, { message?: string }>>>;

export function VariantsTable({ form, axes }: { form: UseFormReturn<ProductValues>; axes: Attribute[] }) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("admin.common");
  const rows = useFieldArray({ control: form.control, name: "variants" });
  const variants = useWatch({ control: form.control, name: "variants" }) ?? [];
  const slug = useWatch({ control: form.control, name: "slug" }) ?? "";
  const missing = missingCombinations(axes, variants);
  const single = axes.length === 0;
  const errors = (form.formState.errors.variants ?? []) as unknown as VariantErrors[];

  function addAll() {
    const last = variants.at(-1);
    rows.append(missing.map((options) => blankVariant(axes, slug, options, last)));
  }

  const cellError = (index: number, field: string) => {
    const entry = errors[index]?.[field];
    return entry && "message" in entry ? (entry.message as string | undefined) : undefined;
  };
  const optionError = (index: number, code: string) =>
    (errors[index]?.options as Record<string, { message?: string }> | undefined)?.[code]?.message;

  const number = (index: number, field: "price" | "weightGrams" | "lengthMm" | "widthMm" | "heightMm", label: string, width: string) => (
    <td className="p-1 align-top">
      <Input
        aria-label={`${label} #${index + 1}`}
        inputMode="decimal"
        className={cn(width, "text-right")}
        aria-invalid={!!cellError(index, field)}
        {...form.register(`variants.${index}.${field}`)}
      />
    </td>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {axes.map((axis) => (
                <th key={axis.code} className="p-2 font-medium">
                  {textOf(axis.name)}
                </th>
              ))}
              <th className="p-2 font-medium">{t("sku")}</th>
              <th className="p-2 text-right font-medium">{t("priceMdl")}</th>
              <th className="p-2 text-right font-medium">{t("weightG")}</th>
              <th className="p-2 text-right font-medium">{t("sizeMm")}</th>
              <th className="p-2 font-medium">{t("active")}</th>
              {!single && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.fields.length === 0 && (
              <tr>
                <td colSpan={axes.length + 6} className="p-6 text-center text-muted-foreground">
                  {t("noVariants")}
                </td>
              </tr>
            )}
            {rows.fields.map((row, index) => {
              const messages = [
                ...axes.map((axis) => optionError(index, axis.code)),
                ...["sku", "price", "weightGrams", "lengthMm", "widthMm", "heightMm", "id"].map((f) => cellError(index, f)),
              ].filter(Boolean);
              return (
                <tr key={row.id} className="border-t" data-testid={`variant-${index}`}>
                  {axes.map((axis) => (
                    <td key={axis.code} className="p-1 align-top">
                      <Controller
                        control={form.control}
                        name={`variants.${index}.options.${axis.code}`}
                        render={({ field }) => {
                          const selected = axis.options.find((o) => o.code === field.value);
                          return (
                            <div className="flex items-center gap-1.5">
                              {axis.showAsSwatches && <Swatch colors={selected?.swatch} />}
                              <SimpleSelect
                                aria-label={`${textOf(axis.name)} #${index + 1}`}
                                className="w-32"
                                invalid={!!optionError(index, axis.code)}
                                value={field.value ?? null}
                                placeholder="—"
                                options={axis.options.map((o) => ({ value: o.code, label: textOf(o.label) }))}
                                onChange={field.onChange}
                              />
                            </div>
                          );
                        }}
                      />
                    </td>
                  ))}
                  <td className="p-1 align-top">
                    <Input
                      aria-label={`${t("sku")} #${index + 1}`}
                      className="w-44 font-mono uppercase"
                      aria-invalid={!!cellError(index, "sku")}
                      {...form.register(`variants.${index}.sku`)}
                    />
                    {messages.length > 0 && <p className="mt-1 max-w-56 text-xs text-destructive">{messages.join(" ")}</p>}
                  </td>
                  {number(index, "price", t("priceMdl"), "w-24")}
                  {number(index, "weightGrams", t("weightG"), "w-20")}
                  <td className="p-1 align-top">
                    <div className="flex items-center gap-1">
                      {(["lengthMm", "widthMm", "heightMm"] as const).map((field, i) => (
                        <Input
                          key={field}
                          aria-label={`${t(field)} #${index + 1}`}
                          placeholder={["L", "W", "H"][i]}
                          inputMode="numeric"
                          className="w-16 text-right"
                          aria-invalid={!!cellError(index, field)}
                          {...form.register(`variants.${index}.${field}`)}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    <Controller
                      control={form.control}
                      name={`variants.${index}.isActive`}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={(c) => field.onChange(c)} aria-label={`${t("active")} #${index + 1}`} />
                      )}
                    />
                  </td>
                  {!single && (
                    <td className="p-1 align-top">
                      <Button type="button" variant="ghost" size="icon" aria-label={`${tc("remove")} #${index + 1}`} onClick={() => rows.remove(index)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!single && (
        <div className="flex flex-wrap gap-2">
          {missing.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={addAll}>
              <Wand2 className="size-4" />
              {axes.length === 1 ? t("addAllOf", { name: textOf(axes[0].name), count: missing.length }) : t("addAllCombinations", { count: missing.length })}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => rows.append(blankVariant(axes, slug, {}, variants.at(-1)))}>
            <Plus className="size-4" />
            {t("addVariant")}
          </Button>
        </div>
      )}
      {single && <p className="text-xs text-muted-foreground">{t("singleVariantHint")}</p>}
    </div>
  );
}
