"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { PageHeader } from "@/components/admin/page-header";
import { ServerErrors, submitWith, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { useUnsavedChanges } from "@/components/admin/use-unsaved-changes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, call } from "@/lib/api/client";
import { textOf, type Schemas } from "@/lib/api/types";
import { formatMoney, useLocations, VariantPicker, type StockRow } from "../../inventory-shared";

export type FormType = "receipt" | "adjustment" | "count" | "transfer";
type Reason = Exclude<Schemas["AdjustmentReason"], "CountCorrection" | null>;

type Line = { variantId: string; sku: string; productName: string; stock: { locationId: string; onHand: number }[]; quantity: string; unitCost: string };
type Values = {
  locationId: string;
  toLocationId: string;
  supplier: string;
  note: string;
  reason: Reason;
  direction: "remove" | "add";
  lines: Line[];
};

const reasons: Reason[] = ["Damaged", "Lost", "GiftOrSample", "Found", "Other"];
const directionOf = (reason: Reason): Values["direction"] | null => (reason === "Found" ? "add" : reason === "Other" ? null : "remove");
const whole = (value: string) => (value.trim() === "" ? NaN : Number(value));

export function DocumentForm({ type }: { type: FormType }) {
  const t = useTranslations("admin.inventory");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const router = useRouter();
  const queryClient = useQueryClient();
  const locations = useLocations();
  const active = (locations.data ?? []).filter((l) => l.isActive);
  const [done, setDone] = useState(false);

  const form = useForm<Values>({
    defaultValues: { locationId: "", toLocationId: "", supplier: "", note: "", reason: "Damaged", direction: "remove", lines: [] },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const values = useWatch({ control: form.control });
  const server = useServerErrors(form.setError, {
    locationId: type === "transfer" ? t("from") : t("location"),
    fromLocationId: t("from"),
    toLocationId: t("to"),
    supplier: t("supplier"),
    note: t("note"),
    reason: t("reason"),
    lines: t("lines"),
  });

  useUnsavedChanges(form.formState.isDirty && !done, t("leaveConfirm"));

  const onHand = (line: { stock?: { locationId?: string; onHand?: number }[] } | undefined, locationId: string | undefined) =>
    Number(line?.stock?.find((s) => s.locationId === locationId)?.onHand ?? 0);
  const totalCost = (values.lines ?? []).reduce((sum, l) => sum + (whole(l?.quantity ?? "") || 0) * (Number((l?.unitCost ?? "").replace(",", ".")) || 0), 0);
  const fixedDirection = directionOf((values.reason ?? "Damaged") as Reason);
  const sign = (fixedDirection ?? values.direction) === "add" ? 1 : -1;

  function pick(row: StockRow) {
    lines.append({
      variantId: row.variantId,
      sku: row.sku,
      productName: textOf(row.productName),
      stock: row.locations.map((l) => ({ locationId: l.locationId, onHand: Number(l.onHand) })),
      quantity: "",
      unitCost: "",
    });
  }

  async function onSubmit(v: Values) {
    server.clear();
    try {
      const note = v.note.trim() || null;
      const document =
        type === "receipt"
          ? await call(api.POST("/api/admin/inventory/receipts", {
              body: { locationId: v.locationId, supplier: v.supplier.trim() || null, note, lines: v.lines.map((l) => ({ variantId: l.variantId, quantity: whole(l.quantity), unitCost: Number(l.unitCost.replace(",", ".")) })) },
            }))
          : type === "adjustment"
            ? await call(api.POST("/api/admin/inventory/adjustments", {
                body: { locationId: v.locationId, reason: v.reason, note, lines: v.lines.map((l) => ({ variantId: l.variantId, quantity: sign * whole(l.quantity) })) },
              }))
            : type === "count"
              ? await call(api.POST("/api/admin/inventory/counts", {
                  body: { locationId: v.locationId, note, lines: v.lines.map((l) => ({ variantId: l.variantId, countedQuantity: whole(l.quantity) })) },
                }))
              : await call(api.POST("/api/admin/inventory/transfers", {
                  body: { fromLocationId: v.locationId, toLocationId: v.toLocationId, note, lines: v.lines.map((l) => ({ variantId: l.variantId, quantity: whole(l.quantity) })) },
                }));

      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["stockDocuments"] });
      await queryClient.invalidateQueries({ queryKey: ["movements"] });
      notify.saved();
      router.push(`/admin/inventory/documents/${document.id}`);
    } catch (error) {
      server.show(error);
      if (error instanceof ApiError && error.fieldErrors.fromLocationId) {
        form.setError("locationId", { type: "server", message: error.fieldErrors.fromLocationId.join(" ") });
      }
    }
  }

  const errors = form.formState.errors;
  const lineMessages = (index: number) => {
    const entry = errors.lines?.[index] as Record<string, { message?: string }> | undefined;
    return entry ? Object.values(entry).map((e) => e?.message).filter(Boolean) : [];
  };
  const locationOptions = active.map((l) => ({ value: l.id, label: l.name }));
  const quantityLabel = type === "count" ? t("counted") : type === "adjustment" ? t("quantityAbs") : t("quantity");

  return (
    <form className="mx-auto flex max-w-4xl flex-col gap-5 pb-16" onSubmit={submitWith(form, onSubmit)} noValidate>
      <PageHeader
        title={t(`new.${type}`)}
        description={t(`new.${type}Hint`)}
        actions={
          <Link href="/admin/inventory" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft className="size-4" />
            {t("stock.title")}
          </Link>
        }
      />
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.locationId}>
            <FieldLabel htmlFor="doc-location">{type === "transfer" ? t("from") : t("location")}</FieldLabel>
            <Controller control={form.control} name="locationId" render={({ field }) => (
              <SimpleSelect id="doc-location" invalid={!!errors.locationId} value={field.value || null} placeholder={t("chooseLocation")} options={locationOptions} onChange={field.onChange} />
            )} />
            <FieldError errors={[errors.locationId]} />
          </Field>
          {type === "transfer" && (
            <Field data-invalid={!!errors.toLocationId}>
              <FieldLabel htmlFor="doc-to">{t("to")}</FieldLabel>
              <Controller control={form.control} name="toLocationId" render={({ field }) => (
                <SimpleSelect
                  id="doc-to"
                  invalid={!!errors.toLocationId}
                  value={field.value || null}
                  placeholder={t("chooseLocation")}
                  options={locationOptions.filter((o) => o.value !== values.locationId)}
                  onChange={field.onChange}
                />
              )} />
              <FieldError errors={[errors.toLocationId]} />
            </Field>
          )}
          {type === "receipt" && (
            <Field data-invalid={!!errors.supplier}>
              <FieldLabel htmlFor="doc-supplier">{t("supplier")}</FieldLabel>
              <Input id="doc-supplier" placeholder="AliExpress" {...form.register("supplier")} />
              <FieldError errors={[errors.supplier]} />
            </Field>
          )}
          {type === "adjustment" && (
            <>
              <Field data-invalid={!!errors.reason}>
                <FieldLabel htmlFor="doc-reason">{t("reason")}</FieldLabel>
                <Controller control={form.control} name="reason" render={({ field }) => (
                  <SimpleSelect id="doc-reason" value={field.value} options={reasons.map((r) => ({ value: r, label: t(`reasons.${r}`) }))} onChange={(r) => field.onChange(r as Reason)} />
                )} />
                <FieldError errors={[errors.reason]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="doc-direction">{t("direction")}</FieldLabel>
                {fixedDirection ? (
                  <p id="doc-direction" className="py-1.5 text-sm">{t(`directions.${fixedDirection}`)}</p>
                ) : (
                  <Controller control={form.control} name="direction" render={({ field }) => (
                    <SimpleSelect
                      id="doc-direction"
                      value={field.value}
                      options={(["remove", "add"] as const).map((d) => ({ value: d, label: t(`directions.${d}`) }))}
                      onChange={(d) => field.onChange(d as Values["direction"])}
                    />
                  )} />
                )}
              </Field>
            </>
          )}
          <Field data-invalid={!!errors.note} className="sm:col-span-2">
            <FieldLabel htmlFor="doc-note">
              {t("note")}
              {type === "adjustment" && values.reason === "Other" && <span className="text-destructive"> *</span>}
            </FieldLabel>
            <Textarea id="doc-note" rows={2} aria-invalid={!!errors.note} {...form.register("note")} />
            <FieldError errors={[errors.note]} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <VariantPicker label={t("addVariant")} exclude={new Set((values.lines ?? []).map((l) => l?.variantId ?? ""))} onPick={pick} />
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">{t("variant")}</th>
                  {type !== "receipt" && <th className="p-2 text-right font-medium">{type === "count" ? t("expected") : t("inStock")}</th>}
                  <th className="p-2 text-right font-medium">{quantityLabel}</th>
                  {type === "receipt" && <th className="p-2 text-right font-medium">{t("unitCost")}</th>}
                  {type === "count" && <th className="p-2 text-right font-medium">{t("difference")}</th>}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.fields.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("noLines")}</td></tr>
                )}
                {lines.fields.map((row, index) => {
                  const current = values.lines?.[index];
                  const have = onHand(current, values.locationId);
                  const typed = whole(current?.quantity ?? "");
                  const messages = lineMessages(index);
                  return (
                    <tr key={row.id} className="border-t align-top" data-testid={`line-${index}`}>
                      <td className="p-2">
                        <div className="font-mono text-xs">{row.sku}</div>
                        <div className="text-xs text-muted-foreground">{row.productName}</div>
                        {messages.length > 0 && <p className="mt-1 text-xs text-destructive">{messages.join(" ")}</p>}
                      </td>
                      {type !== "receipt" && (
                        <td className="p-2 text-right tabular-nums text-muted-foreground" data-testid={`have-${index}`}>
                          {values.locationId ? have : "—"}
                        </td>
                      )}
                      <td className="p-1 text-right">
                        <Input
                          aria-label={`${quantityLabel} ${row.sku}`}
                          inputMode="numeric"
                          className="ml-auto w-24 text-right"
                          aria-invalid={messages.length > 0}
                          {...form.register(`lines.${index}.quantity`)}
                        />
                      </td>
                      {type === "receipt" && (
                        <td className="p-1 text-right">
                          <Input aria-label={`${t("unitCost")} ${row.sku}`} inputMode="decimal" className="ml-auto w-28 text-right" {...form.register(`lines.${index}.unitCost`)} />
                        </td>
                      )}
                      {type === "count" && (
                        <td className="p-2 text-right font-mono tabular-nums" data-testid={`diff-${index}`}>
                          {Number.isNaN(typed) || !values.locationId ? "—" : typed - have > 0 ? `+${typed - have}` : typed - have}
                        </td>
                      )}
                      <td className="p-1">
                        <Button type="button" variant="ghost" size="icon" aria-label={`${tc("remove")} ${row.sku}`} onClick={() => lines.remove(index)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {type === "receipt" && lines.fields.length > 0 && (
            <p className="text-right text-sm">
              {t("totalCost")}: <span className="font-medium" data-testid="total-cost">{formatMoney(totalCost)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <ServerErrors messages={server.messages} />
      <div className="flex justify-end gap-2">
        <Link href="/admin/inventory" className={buttonVariants({ variant: "outline" })}>{tc("cancel")}</Link>
        <Button type="submit" disabled={form.formState.isSubmitting}>{t(`save.${type}`)}</Button>
      </div>
    </form>
  );
}
