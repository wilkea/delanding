"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PageHeader } from "@/components/admin/page-header";
import { ServerErrors, submitWith, useServerErrors } from "@/components/admin/server-errors";
import { useNotify } from "@/components/admin/use-notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { useLocations, type Location } from "../inventory-shared";

type Values = { name: string; contactName: string; phone: string; city: string; address: string; isSellable: boolean };

function LocationForm({ location, onClose }: { location: Location | null; onClose: () => void }) {
  const t = useTranslations("admin.inventory.locations");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    defaultValues: {
      name: location?.name ?? "",
      contactName: location?.contactName ?? "",
      phone: location?.phone ?? "",
      city: location?.city ?? "",
      address: location?.address ?? "",
      isSellable: location?.isSellable ?? true,
    },
  });
  const server = useServerErrors(form.setError, {
    name: t("name"),
    contactName: t("contact"),
    phone: t("phone"),
    city: t("city"),
    address: t("address"),
  });

  async function onSubmit(values: Values) {
    server.clear();
    const body = {
      name: values.name.trim(),
      contactName: values.contactName.trim() || null,
      phone: values.phone.trim() || null,
      city: values.city.trim() || null,
      address: values.address.trim() || null,
      isSellable: values.isSellable,
    };
    try {
      if (location) {
        await call(api.PUT("/api/admin/inventory/locations/{id}", { params: { path: { id: location.id } }, body }));
      } else {
        await call(api.POST("/api/admin/inventory/locations", { body }));
      }
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
      notify.saved();
      onClose();
    } catch (error) {
      server.show(error);
    }
  }

  const errors = form.formState.errors;
  const text = (name: Exclude<keyof Values, "isSellable">, label: string, placeholder?: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`location-${name}`}>{label}</FieldLabel>
      <Input id={`location-${name}`} placeholder={placeholder} aria-invalid={!!errors[name]} {...form.register(name)} />
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{location ? t("edit") : t("new")}</DialogTitle>
      </DialogHeader>
      <form id="location-form" onSubmit={submitWith(form, onSubmit)} noValidate>
        <FieldGroup>
          {text("name", t("name"), t("namePlaceholder"))}
          <div className="grid grid-cols-2 gap-3">
            {text("contactName", t("contact"))}
            {text("phone", t("phone"))}
          </div>
          {text("city", t("city"))}
          {text("address", t("address"))}
          <Field orientation="horizontal">
            <Controller control={form.control} name="isSellable" render={({ field }) => (
              <Switch id="location-sellable" checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
            )} />
            <div>
              <FieldLabel htmlFor="location-sellable">{t("sellable")}</FieldLabel>
              <FieldDescription>{t("sellableHint")}</FieldDescription>
            </div>
          </Field>
          <ServerErrors messages={server.messages} />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{tc("cancel")}</Button>
        <Button type="submit" form="location-form" disabled={form.formState.isSubmitting}>{tc("save")}</Button>
      </DialogFooter>
    </>
  );
}

export default function LocationsPage() {
  const t = useTranslations("admin.inventory.locations");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const locations = useLocations();
  const [editing, setEditing] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);

  async function toggle(location: Location) {
    try {
      const params = { path: { id: location.id } };
      await call(
        location.isActive
          ? api.POST("/api/admin/inventory/locations/{id}/deactivate", { params })
          : api.POST("/api/admin/inventory/locations/{id}/activate", { params }),
      );
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
      notify.saved();
    } catch (error) {
      notify.failed(error);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
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
              <TableHead className="hidden sm:table-cell">{t("contact")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("city")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.isPending && <TableRow><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {locations.data?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{tc("empty")}</TableCell></TableRow>
            )}
            {locations.data?.map((location) => (
              <TableRow key={location.id} className={location.isActive ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {location.name}
                    {location.isSellable ? <Badge variant="secondary">{t("sellable")}</Badge> : <Badge variant="outline">{t("notSellable")}</Badge>}
                    {!location.isActive && <Badge variant="outline">{t("inactive")}</Badge>}
                  </div>
                  {location.address && <div className="text-xs text-muted-foreground">{location.address}</div>}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div>{location.contactName}</div>
                  <div className="text-xs text-muted-foreground">{location.phone}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{location.city}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" aria-label={`${tc("edit")} ${location.name}`} onClick={() => { setEditing(location); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${location.isActive ? t("deactivate") : t("activate")} ${location.name}`}
                      title={location.isActive ? t("deactivate") : t("activate")}
                      onClick={() => toggle(location)}
                    >
                      {location.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <LocationForm location={editing} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
