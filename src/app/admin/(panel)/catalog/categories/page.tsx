"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { api, call } from "@/lib/api/client";
import { cleanLocalized, textOf, type Localized, type Schemas } from "@/lib/api/types";
import { toSlug } from "@/lib/text";

type Category = Schemas["CategoryResponse"];
type Node = Category & { children: Node[]; depth: number };
type Values = { parentId: string; slug: string; name: Localized; sortOrder: number; isActive: boolean };

const ROOT = "root";

function buildTree(categories: Category[]): Node[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }

  const build = (parentId: string | null, depth: number): Node[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
      .map((c) => ({ ...c, depth, children: build(c.id, depth + 1) }));

  return build(null, 0);
}

function flatten(nodes: Node[]): Node[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

type FormProps = { category: Category | null; parentId: string | null; all: Node[]; onClose: () => void };

function CategoryDialog({ open, onOpenChange, ...props }: Omit<FormProps, "onClose"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <CategoryForm {...props} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({ category, parentId, all, onClose }: FormProps) {
  const t = useTranslations("admin.categories");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [slugTouched, setSlugTouched] = useState(!!category);
  const form = useForm<Values>({
    defaultValues: category
      ? { parentId: category.parentId ?? ROOT, slug: category.slug, name: category.name, sortOrder: Number(category.sortOrder), isActive: category.isActive }
      : { parentId: parentId ?? ROOT, slug: "", name: {}, sortOrder: 0, isActive: true },
  });
  const server = useServerErrors(form.setError, {
    name: t("name"),
    slug: t("slug"),
    parentId: t("parent"),
    sortOrder: t("order"),
    isActive: t("active"),
  });
  const nameRo = useWatch({ control: form.control, name: "name.ro" });

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", toSlug(nameRo ?? ""));
    }
  }, [nameRo, slugTouched, form]);

  async function onSubmit(values: Values) {
    server.clear();
    const body = {
      parentId: values.parentId === ROOT ? null : values.parentId,
      slug: values.slug,
      name: cleanLocalized(values.name),
      sortOrder: Number(values.sortOrder) || 0,
      isActive: values.isActive,
    };

    try {
      if (category) {
        await call(api.PUT("/api/admin/categories/{id}", { params: { path: { id: category.id } }, body }));
      } else {
        await call(api.POST("/api/admin/categories", { body }));
      }

      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      notify.saved();
      onClose();
    } catch (error) {
      server.show(error);
    }
  }

  const parents = all.filter((n) => n.id !== category?.id);
  const errors = form.formState.errors;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{category ? t("edit") : t("new")}</DialogTitle>
      </DialogHeader>
      <form id="category-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="category-name">{t("name")}</FieldLabel>
            <Controller control={form.control} name="name" render={({ field }) => (
              <LocalizedInput id="category-name" value={field.value} onChange={field.onChange} invalid={!!errors.name} />
            )} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.slug}>
            <FieldLabel htmlFor="category-slug">{t("slug")}</FieldLabel>
            <Input id="category-slug" aria-invalid={!!errors.slug} {...form.register("slug", { onChange: () => setSlugTouched(true) })} />
            <FieldError errors={[errors.slug]} />
          </Field>
          <Field data-invalid={!!errors.parentId}>
            <FieldLabel htmlFor="category-parent">{t("parent")}</FieldLabel>
            <Controller control={form.control} name="parentId" render={({ field }) => (
              <SimpleSelect
                id="category-parent"
                value={field.value}
                onChange={field.onChange}
                options={[{ value: ROOT, label: t("noParent") }, ...parents.map((p) => ({ value: p.id, label: `${"— ".repeat(p.depth)}${textOf(p.name)}` }))]}
              />
            )} />
            <FieldError errors={[errors.parentId]} />
          </Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field>
              <FieldLabel htmlFor="category-order">{t("order")}</FieldLabel>
              <Input id="category-order" type="number" {...form.register("sortOrder", { valueAsNumber: true })} />
            </Field>
            <Field orientation="horizontal">
              <Controller control={form.control} name="isActive" render={({ field }) => (
                <Switch id="category-active" checked={field.value} onCheckedChange={(c) => field.onChange(c)} />
              )} />
              <FieldLabel htmlFor="category-active">{t("active")}</FieldLabel>
            </Field>
          </div>
          <ServerErrors messages={server.messages} />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{tc("cancel")}</Button>
        <Button type="submit" form="category-form" disabled={form.formState.isSubmitting}>{tc("save")}</Button>
      </DialogFooter>
    </>
  );
}

export default function CategoriesPage() {
  const t = useTranslations("admin.categories");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; category: Category | null; parentId: string | null }>({
    open: false,
    category: null,
    parentId: null,
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => call(api.GET("/api/admin/categories")) });
  const nodes = flatten(buildTree(categories.data ?? []));

  async function remove(category: Category) {
    try {
      await call(api.DELETE("/api/admin/categories/{id}", { params: { path: { id: category.id } } }));
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      notify.deleted();
    } catch (error) {
      notify.failed(error);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} actions={
        <Button onClick={() => setDialog({ open: true, category: null, parentId: null })}>
          <Plus className="size-4" />
          {t("new")}
        </Button>
      } />
      <ul className="divide-y rounded-lg border bg-background" aria-label={t("title")}>
        {categories.isPending && <li className="p-3"><Skeleton className="h-5 w-full" /></li>}
        {categories.data?.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">{tc("empty")}</li>}
        {nodes.map((node) => (
          <li key={node.id} className="flex items-center gap-2 p-2 pr-3" style={{ paddingLeft: `${0.75 + node.depth * 1.5}rem` }}>
            <div className="min-w-0 flex-1">
              <span className="font-medium">{textOf(node.name)}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">/{node.slug}</span>
              {!node.isActive && <Badge variant="outline" className="ml-2">{t("inactive")}</Badge>}
            </div>
            <Button variant="ghost" size="icon" aria-label={`${t("addChild")} ${node.slug}`} onClick={() => setDialog({ open: true, category: null, parentId: node.id })}>
              <FolderPlus className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`${tc("edit")} ${node.slug}`} onClick={() => setDialog({ open: true, category: node, parentId: node.parentId })}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmButton
              title={t("deleteTitle", { name: textOf(node.name) })}
              onConfirm={() => remove(node)}
              trigger={<Button variant="ghost" size="icon" aria-label={`${tc("delete")} ${node.slug}`}><Trash2 className="size-4" /></Button>}
            />
          </li>
        ))}
      </ul>
      <CategoryDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        category={dialog.category}
        parentId={dialog.parentId}
        all={nodes}
      />
    </div>
  );
}
