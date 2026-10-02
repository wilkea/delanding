"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { LocalizedInput } from "@/components/admin/localized-input";
import { PageHeader } from "@/components/admin/page-header";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { cleanLocalized, textOf, type Localized, type Schemas } from "@/lib/api/types";
import { toCode } from "@/lib/text";
import { cn } from "@/lib/utils";

type ProductType = Schemas["ProductTypeResponse"];
type Values = {
  code: string;
  name: Localized;
  attributes: { attributeId: string; isRequired: boolean; isVariantAxis: boolean }[];
};

function TypeDialog({ open, onOpenChange, type }: { open: boolean; onOpenChange: (open: boolean) => void; type: ProductType | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <TypeForm type={type} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TypeForm({ type, onClose }: { type: ProductType | null; onClose: () => void }) {
  const t = useTranslations("admin.types");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isNew = !type;
  const library = useQuery({ queryKey: ["attributes", ""], queryFn: () => call(api.GET("/api/admin/attributes", {})) });
  const form = useForm<Values>({
    defaultValues: type
      ? {
          code: type.code,
          name: type.name,
          attributes: type.attributes.map((a) => ({ attributeId: a.attributeId, isRequired: a.isRequired, isVariantAxis: a.isVariantAxis })),
        }
      : { code: "", name: {}, attributes: [] },
  });
  const server = useServerErrors(form.setError, { code: t("code"), name: t("name"), attributes: t("attributes") });
  const rows = useFieldArray({ control: form.control, name: "attributes" });
  const nameRo = useWatch({ control: form.control, name: "name.ro" });
  const chosen = useWatch({ control: form.control, name: "attributes" });

  useEffect(() => {
    if (isNew && !form.getFieldState("code").isDirty) {
      form.setValue("code", toCode(nameRo ?? ""));
    }
  }, [nameRo, isNew, form]);

  const byId = new Map((library.data ?? []).map((a) => [a.id, a]));
  const selected = new Set(chosen?.map((a) => a.attributeId));
  const available = (library.data ?? []).filter((a) => !selected.has(a.id));

  async function onSubmit(values: Values) {
    server.clear();
    const attributes = values.attributes.map((a, index) => ({ ...a, sortOrder: index }));
    try {
      if (isNew) {
        await call(api.POST("/api/admin/product-types", { body: { code: values.code, name: cleanLocalized(values.name), attributes } }));
      } else {
        await call(api.PUT("/api/admin/product-types/{id}", { params: { path: { id: type.id } }, body: { name: cleanLocalized(values.name), attributes } }));
      }

      await queryClient.invalidateQueries({ queryKey: ["productTypes"] });
      notify.saved();
      onClose();
    } catch (error) {
      server.show(error);
    }
  }

  const errors = form.formState.errors;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? t("new") : t("edit")}</DialogTitle>
      </DialogHeader>
      <form id="type-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="type-name">{t("name")}</FieldLabel>
            <Controller control={form.control} name="name" render={({ field }) => (
              <LocalizedInput id="type-name" value={field.value} onChange={field.onChange} invalid={!!errors.name} />
            )} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="type-code">{t("code")}</FieldLabel>
            <Input id="type-code" disabled={!isNew} aria-invalid={!!errors.code} {...form.register("code")} />
            <FieldError errors={[errors.code]} />
          </Field>
          <Field>
            <FieldLabel>{t("attributes")}</FieldLabel>
            <p className="text-xs text-muted-foreground">{t("attributesHint")}</p>
            <ul className="flex flex-col gap-2">
              {rows.fields.map((row, index) => {
                const attribute = byId.get(row.attributeId);
                const canBeAxis = attribute?.dataType === "Option";
                const rowErrors = errors.attributes?.[index];
                const rowMessages = [rowErrors?.attributeId, rowErrors?.isRequired, rowErrors?.isVariantAxis];
                return (
                  <li key={row.id} className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-2", rowMessages.some(Boolean) && "border-destructive")}>
                    <div className="min-w-32 flex-1">
                      <div className="text-sm font-medium">{attribute ? textOf(attribute.name) : row.attributeId}</div>
                      <div className="font-mono text-xs text-muted-foreground">{attribute?.code}</div>
                    </div>
                    <Controller control={form.control} name={`attributes.${index}.isRequired`} render={({ field }) => (
                      <label className="flex items-center gap-1.5 text-xs">
                        <Switch checked={field.value} onCheckedChange={(c) => field.onChange(c)} aria-label={`${t("required")} ${attribute?.code}`} />
                        {t("required")}
                      </label>
                    )} />
                    <Controller control={form.control} name={`attributes.${index}.isVariantAxis`} render={({ field }) => (
                      <label className="flex items-center gap-1.5 text-xs" title={canBeAxis ? undefined : t("axisOnlyOption")}>
                        <Switch
                          checked={field.value}
                          disabled={!canBeAxis}
                          onCheckedChange={(c) => field.onChange(c)}
                          aria-label={`${t("variant")} ${attribute?.code}`}
                        />
                        {t("variant")}
                      </label>
                    )} />
                    <div className="flex">
                      <Button type="button" variant="ghost" size="icon" aria-label={tc("moveUp")} disabled={index === 0} onClick={() => rows.move(index, index - 1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={tc("moveDown")} disabled={index === rows.fields.length - 1} onClick={() => rows.move(index, index + 1)}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`${tc("remove")} ${attribute?.code}`} onClick={() => rows.remove(index)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <FieldError className="w-full" errors={rowMessages} />
                  </li>
                );
              })}
            </ul>
            {available.length > 0 && (
              <SimpleSelect
                aria-label={t("addAttribute")}
                value={null}
                placeholder={t("addAttribute")}
                options={available.map((a) => ({ value: a.id, label: `${textOf(a.name)} (${a.code})` }))}
                onChange={(id) => rows.append({ attributeId: id, isRequired: false, isVariantAxis: false })}
              />
            )}
          </Field>
          <ServerErrors messages={server.messages} />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{tc("cancel")}</Button>
        <Button type="submit" form="type-form" disabled={form.formState.isSubmitting}>{tc("save")}</Button>
      </DialogFooter>
    </>
  );
}

export default function ProductTypesPage() {
  const t = useTranslations("admin.types");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductType | null>(null);
  const [open, setOpen] = useState(false);
  const types = useQuery({ queryKey: ["productTypes"], queryFn: () => call(api.GET("/api/admin/product-types")) });

  async function remove(type: ProductType) {
    try {
      await call(api.DELETE("/api/admin/product-types/{id}", { params: { path: { id: type.id } } }));
      await queryClient.invalidateQueries({ queryKey: ["productTypes"] });
      notify.deleted();
    } catch (error) {
      notify.failed(error);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} actions={
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" />
          {t("new")}
        </Button>
      } />
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("attributes")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.isPending && <TableRow><TableCell colSpan={3}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {types.data?.length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{tc("empty")}</TableCell></TableRow>
            )}
            {types.data?.map((type) => (
              <TableRow key={type.id}>
                <TableCell>
                  <div className="font-medium">{textOf(type.name)}</div>
                  <div className="font-mono text-xs text-muted-foreground">{type.code}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {type.attributes.map((a) => (
                      <Badge key={a.attributeId} variant={a.isVariantAxis ? "default" : "secondary"}>
                        {textOf(a.name)}
                        {a.isRequired && " *"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" aria-label={`${tc("edit")} ${type.code}`} onClick={() => { setEditing(type); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmButton
                      title={t("deleteTitle", { name: textOf(type.name) })}
                      onConfirm={() => remove(type)}
                      trigger={<Button variant="ghost" size="icon" aria-label={`${tc("delete")} ${type.code}`}><Trash2 className="size-4" /></Button>}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("legend")}</p>
      <TypeDialog open={open} onOpenChange={setOpen} type={editing} />
    </div>
  );
}
