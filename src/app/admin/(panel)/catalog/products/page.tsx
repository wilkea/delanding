"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageOff, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleSelect } from "@/components/admin/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { textOf, type Schemas } from "@/lib/api/types";
import { categoryOptions } from "../category-tree";
import { formatPrice, StatusBadge } from "./product-status";

type Status = Schemas["ProductStatus"];

const ALL = "all";
const pageSize = 20;

function NewProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.products");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const [typeId, setTypeId] = useState<string | null>(null);
  const types = useQuery({ queryKey: ["productTypes"], queryFn: () => call(api.GET("/api/admin/product-types")) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
        </DialogHeader>
        {types.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noTypes")}{" "}
            <Link className="text-primary underline" href="/admin/catalog/types">
              {t("createType")}
            </Link>
          </p>
        ) : (
          <Field>
            <FieldLabel htmlFor="new-product-type">{t("chooseType")}</FieldLabel>
            <SimpleSelect
              id="new-product-type"
              value={typeId}
              placeholder={t("chooseType")}
              options={(types.data ?? []).map((type) => ({ value: type.id, label: textOf(type.name) }))}
              onChange={setTypeId}
            />
            <p className="text-xs text-muted-foreground">{t("typeHint")}</p>
          </Field>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={!typeId} onClick={() => router.push(`/admin/catalog/products/new?type=${typeId}`)}>
            {t("continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsPage() {
  const t = useTranslations("admin.products");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [typeId, setTypeId] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const filters = {
    search: deferredSearch || undefined,
    status: status === ALL ? undefined : (status as Status),
    categoryId: categoryId === ALL ? undefined : categoryId,
    productTypeId: typeId === ALL ? undefined : typeId,
    page,
    pageSize,
  };

  const products = useQuery({
    queryKey: ["products", filters],
    queryFn: () => call(api.GET("/api/admin/products", { params: { query: filters } })),
    placeholderData: keepPreviousData,
  });
  const types = useQuery({ queryKey: ["productTypes"], queryFn: () => call(api.GET("/api/admin/product-types")) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => call(api.GET("/api/admin/categories")) });

  const typeName = new Map((types.data ?? []).map((type) => [type.id, textOf(type.name)]));
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, textOf(c.name)]));
  const total = Number(products.data?.totalCount ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function filter(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setPage(1);
    };
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t("new")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("search")}
            aria-label={t("search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <SimpleSelect
          aria-label={t("status")}
          className="w-36"
          value={status}
          onChange={filter(setStatus)}
          options={[
            { value: ALL, label: t("allStatuses") },
            ...(["Draft", "Active", "Archived"] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          ]}
        />
        <SimpleSelect
          aria-label={t("category")}
          className="w-48"
          value={categoryId}
          onChange={filter(setCategoryId)}
          options={[{ value: ALL, label: t("allCategories") }, ...categoryOptions(categories.data ?? [])]}
        />
        <SimpleSelect
          aria-label={t("type")}
          className="w-40"
          value={typeId}
          onChange={filter(setTypeId)}
          options={[{ value: ALL, label: t("allTypes") }, ...(types.data ?? []).map((type) => ({ value: type.id, label: textOf(type.name) }))]}
        />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" />
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("type")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("category")}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t("variants")}</TableHead>
              <TableHead className="text-right">{t("price")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {products.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {tc("empty")}
                </TableCell>
              </TableRow>
            )}
            {products.data?.items.map((product) => (
              <TableRow
                key={product.id}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/catalog/products/${product.id}`)}
              >
                <TableCell>
                  {product.mainImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served and resized by the API, not by next/image
                    <img src={product.mainImageUrl} alt="" className="size-12 rounded-md border object-cover" />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                      <ImageOff className="size-4" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/admin/catalog/products/${product.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {textOf(product.name)}
                  </Link>
                  <div className="font-mono text-xs text-muted-foreground">{product.slug}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={product.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">{typeName.get(product.productTypeId)}</TableCell>
                <TableCell className="hidden md:table-cell">{categoryName.get(product.categoryId)}</TableCell>
                <TableCell className="hidden text-right sm:table-cell">{Number(product.variantCount)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {product.minPrice == null ? "—" : t("from", { price: formatPrice(product.minPrice) })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("count", { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("previous")} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span>{t("page", { page, pages })}</span>
          <Button variant="outline" size="icon" aria-label={t("next")} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <NewProductDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
