"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageHeader } from "@/components/admin/page-header";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { useNotify } from "@/components/admin/use-notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { toSlug } from "@/lib/text";

type Brand = Schemas["BrandResponse"];
type Values = { name: string; slug: string };

function BrandDialog({ open, onOpenChange, brand }: { open: boolean; onOpenChange: (open: boolean) => void; brand: Brand | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <BrandForm brand={brand} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BrandForm({ brand, onClose }: { brand: Brand | null; onClose: () => void }) {
  const t = useTranslations("admin.brands");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [slugTouched, setSlugTouched] = useState(!!brand);
  const form = useForm<Values>({ defaultValues: brand ? { name: brand.name, slug: brand.slug } : { name: "", slug: "" } });
  const server = useServerErrors(form.setError, { name: t("name"), slug: t("slug") });
  const name = useWatch({ control: form.control, name: "name" });

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", toSlug(name ?? ""));
    }
  }, [name, slugTouched, form]);

  async function onSubmit(values: Values) {
    server.clear();
    try {
      if (brand) {
        await call(api.PUT("/api/admin/brands/{id}", { params: { path: { id: brand.id } }, body: values }));
      } else {
        await call(api.POST("/api/admin/brands", { body: values }));
      }

      await queryClient.invalidateQueries({ queryKey: ["brands"] });
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
        <DialogTitle>{brand ? t("edit") : t("new")}</DialogTitle>
      </DialogHeader>
      <form id="brand-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="brand-name">{t("name")}</FieldLabel>
            <Input id="brand-name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.slug}>
            <FieldLabel htmlFor="brand-slug">{t("slug")}</FieldLabel>
            <Input id="brand-slug" aria-invalid={!!errors.slug} {...form.register("slug", { onChange: () => setSlugTouched(true) })} />
            <FieldError errors={[errors.slug]} />
          </Field>
          <ServerErrors messages={server.messages} />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{tc("cancel")}</Button>
        <Button type="submit" form="brand-form" disabled={form.formState.isSubmitting}>{tc("save")}</Button>
      </DialogFooter>
    </>
  );
}

export default function BrandsPage() {
  const t = useTranslations("admin.brands");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Brand | null>(null);
  const [open, setOpen] = useState(false);
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => call(api.GET("/api/admin/brands")) });

  async function remove(brand: Brand) {
    try {
      await call(api.DELETE("/api/admin/brands/{id}", { params: { path: { id: brand.id } } }));
      await queryClient.invalidateQueries({ queryKey: ["brands"] });
      notify.deleted();
    } catch (error) {
      notify.failed(error);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} actions={
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
              <TableHead>{t("slug")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.isPending && <TableRow><TableCell colSpan={3}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {brands.data?.length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{tc("empty")}</TableCell></TableRow>
            )}
            {brands.data?.map((brand) => (
              <TableRow key={brand.id}>
                <TableCell className="font-medium">{brand.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{brand.slug}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" aria-label={`${tc("edit")} ${brand.slug}`} onClick={() => { setEditing(brand); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmButton
                      title={t("deleteTitle", { name: brand.name })}
                      onConfirm={() => remove(brand)}
                      trigger={<Button variant="ghost" size="icon" aria-label={`${tc("delete")} ${brand.slug}`}><Trash2 className="size-4" /></Button>}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <BrandDialog open={open} onOpenChange={setOpen} brand={editing} />
    </div>
  );
}
