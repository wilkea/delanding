"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ChevronLeft, ChevronRight, ClipboardCheck, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleSelect } from "@/components/admin/simple-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { formatDate, formatMoney, Quantity, useLocations, type StockRow } from "./inventory-shared";

const ALL = "all";
const pageSize = 50;

function VariantHistory({ row, onClose }: { row: StockRow | null; onClose: () => void }) {
  const t = useTranslations("admin.inventory");
  const movements = useQuery({
    queryKey: ["movements", row?.variantId],
    queryFn: () => call(api.GET("/api/admin/inventory/variants/{variantId}/movements", { params: { path: { variantId: row!.variantId }, query: { page: 1, pageSize: 100 } } })),
    enabled: !!row,
  });

  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-mono">{row?.sku}</SheetTitle>
          <SheetDescription>{textOf(row?.productName)} · {t("onHandShort", { count: Number(row?.total ?? 0) })}</SheetDescription>
        </SheetHeader>
        <ol className="flex flex-col divide-y px-4 pb-6" aria-label={t("history")}>
          {movements.isPending && <Skeleton className="h-16 w-full" />}
          {movements.data?.items.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{t("noMovements")}</li>}
          {movements.data?.items.map((m) => (
            <li key={m.movementId} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <Link href={`/admin/inventory/documents/${m.documentId}`} className="font-medium text-primary hover:underline">
                  {t(`types.${m.documentType}`)} #{Number(m.documentNumber)}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {m.locationName}
                  {m.reason && ` · ${t(`reasons.${m.reason}`)}`}
                  {m.unitCost != null && ` · ${formatMoney(m.unitCost)}`}
                </div>
                {m.note && <div className="text-xs">{m.note}</div>}
                <div className="text-xs text-muted-foreground">{formatDate(m.createdAt)} · {m.createdBy}</div>
              </div>
              <Quantity value={m.quantity} />
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}

export default function StockPage() {
  const t = useTranslations("admin.inventory");
  const tc = useTranslations("admin.common");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [locationId, setLocationId] = useState(ALL);
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockRow | null>(null);
  const locations = useLocations();
  const active = (locations.data ?? []).filter((l) => l.isActive);

  const filters = { search: deferred || undefined, locationId: locationId === ALL ? undefined : locationId, onlyInStock, page, pageSize };
  const stock = useQuery({
    queryKey: ["stock", filters],
    queryFn: () => call(api.GET("/api/admin/inventory/stock", { params: { query: filters } })),
    placeholderData: keepPreviousData,
  });
  const total = Number(stock.data?.totalCount ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const holding = new Set((stock.data?.items ?? []).flatMap((row) => row.locations.filter((l) => Number(l.onHand) > 0).map((l) => l.locationId)));
  const columns = (locationId === ALL ? active : active.filter((l) => l.id === locationId)).filter((l) => holding.has(l.id) || l.id === locationId);

  const action = (href: string, icon: React.ReactNode, label: string) => (
    <Link href={href} className={buttonVariants({ variant: "outline" })}>
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("stock.title")}
        description={t("stock.description")}
        actions={
          <>
            {action("/admin/inventory/new/receipt", <PackagePlus className="size-4" />, t("actions.receipt"))}
            {action("/admin/inventory/new/adjustment", <SlidersHorizontal className="size-4" />, t("actions.adjustment"))}
            {action("/admin/inventory/new/count", <ClipboardCheck className="size-4" />, t("actions.count"))}
            {action("/admin/inventory/new/transfer", <ArrowLeftRight className="size-4" />, t("actions.transfer"))}
          </>
        }
      />
      {locations.data && active.length === 0 && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          {t("noLocations")}{" "}
          <Link className="font-medium text-primary underline" href="/admin/inventory/locations">{t("addLocation")}</Link>
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder={t("stock.search")} aria-label={t("stock.search")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <SimpleSelect
          aria-label={t("location")}
          className="w-48"
          value={locationId}
          onChange={(v) => { setLocationId(v); setPage(1); }}
          options={[{ value: ALL, label: t("allLocations") }, ...active.map((l) => ({ value: l.id, label: l.name }))]}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyInStock} onCheckedChange={(c) => { setOnlyInStock(!!c); setPage(1); }} />
          {t("stock.onlyInStock")}
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sku")}</TableHead>
              <TableHead>{t("product")}</TableHead>
              {columns.map((l) => (
                <TableHead key={l.id} className="text-right">{l.name}</TableHead>
              ))}
              <TableHead className="text-right">{t("stock.total")}</TableHead>
              <TableHead className="text-right" title={t("stock.reservedHint")}>{t("stock.reserved")}</TableHead>
              <TableHead className="text-right" title={t("stock.availableHint")}>{t("stock.available")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.isPending && <TableRow><TableCell colSpan={columns.length + 5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {stock.data?.items.length === 0 && (
              <TableRow><TableCell colSpan={columns.length + 5} className="py-8 text-center text-muted-foreground">{tc("empty")}</TableCell></TableRow>
            )}
            {stock.data?.items.map((row) => (
              <TableRow key={row.variantId} className="cursor-pointer" onClick={() => setSelected(row)}>
                <TableCell className="font-mono text-xs">
                  <button type="button" className="hover:underline" onClick={() => setSelected(row)}>{row.sku}</button>
                </TableCell>
                <TableCell>{textOf(row.productName)}</TableCell>
                {columns.map((l) => (
                  <TableCell key={l.id} className="text-right tabular-nums">
                    {Number(row.locations.find((x) => x.locationId === l.id)?.onHand ?? 0) || <span className="text-muted-foreground">0</span>}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">{Number(row.total)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(row.reserved)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{Number(row.available)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("stock.count", { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("previous")} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
          <span>{t("page", { page, pages })}</span>
          <Button variant="outline" size="icon" aria-label={t("next")} disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <VariantHistory row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
