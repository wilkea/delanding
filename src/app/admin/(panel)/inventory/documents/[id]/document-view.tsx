"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { DocumentBadge, formatDate, formatMoney, Quantity } from "../../inventory-shared";

export function DocumentView({ id }: { id: string }) {
  const t = useTranslations("admin.inventory");
  const document = useQuery({
    queryKey: ["stockDocument", id],
    queryFn: () => call(api.GET("/api/admin/inventory/documents/{id}", { params: { path: { id } } })),
  });

  if (!document.data) {
    return <Skeleton className="mx-auto h-64 max-w-4xl" />;
  }

  const d = document.data;
  const withCost = d.movements.some((m) => m.unitCost != null);
  const totalCost = d.movements.reduce((sum, m) => sum + (m.unitCost == null ? 0 : Number(m.unitCost) * Number(m.quantity)), 0);
  const detail = (label: string, value: React.ReactNode) =>
    value ? (
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/inventory/documents" aria-label={t("documents.title")} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-heading text-2xl font-medium">
          {t(`types.${d.type}`)} #{Number(d.number)}
        </h1>
        <DocumentBadge type={d.type} />
      </div>
      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            {detail(d.toLocationName ? t("from") : t("location"), d.locationName)}
            {detail(t("to"), d.toLocationName)}
            {detail(t("supplier"), d.supplier)}
            {detail(t("documents.by"), d.createdBy)}
            {detail(t("documents.when"), formatDate(d.createdAt))}
            {detail(t("note"), d.note)}
          </dl>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sku")}</TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("location")}</TableHead>
              <TableHead>{t("reason")}</TableHead>
              <TableHead className="text-right">{t("quantity")}</TableHead>
              {withCost && <TableHead className="text-right">{t("unitCost")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.movements.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">{t("noDifferences")}</TableCell></TableRow>
            )}
            {d.movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                <TableCell>{textOf(m.productName)}</TableCell>
                <TableCell>{m.locationName}</TableCell>
                <TableCell>{m.reason ? t(`reasons.${m.reason}`) : t(`movements.${m.type}`)}</TableCell>
                <TableCell className="text-right"><Quantity value={m.quantity} /></TableCell>
                {withCost && <TableCell className="text-right tabular-nums">{m.unitCost == null ? "" : formatMoney(m.unitCost)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {withCost && (
        <p className="text-right text-sm">
          {t("totalCost")}: <span className="font-medium">{formatMoney(totalCost)}</span>
        </p>
      )}
    </div>
  );
}
