"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleSelect } from "@/components/admin/simple-select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { DocumentBadge, formatDate, useLocations, type DocumentType } from "../inventory-shared";

const ALL = "all";
const pageSize = 50;
const types: DocumentType[] = ["Receipt", "Adjustment", "Count", "Transfer", "Sale", "Return"];

export default function DocumentsPage() {
  const t = useTranslations("admin.inventory");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const locations = useLocations();
  const [type, setType] = useState(ALL);
  const [locationId, setLocationId] = useState(ALL);
  const [page, setPage] = useState(1);

  const filters = { type: type === ALL ? undefined : (type as DocumentType), locationId: locationId === ALL ? undefined : locationId, page, pageSize };
  const documents = useQuery({
    queryKey: ["stockDocuments", filters],
    queryFn: () => call(api.GET("/api/admin/inventory/documents", { params: { query: filters } })),
    placeholderData: keepPreviousData,
  });
  const total = Number(documents.data?.totalCount ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("documents.title")} description={t("documents.description")} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SimpleSelect
          aria-label={t("documents.type")}
          className="w-40"
          value={type}
          onChange={(v) => { setType(v); setPage(1); }}
          options={[{ value: ALL, label: t("documents.allTypes") }, ...types.map((x) => ({ value: x, label: t(`types.${x}`) }))]}
        />
        <SimpleSelect
          aria-label={t("location")}
          className="w-48"
          value={locationId}
          onChange={(v) => { setLocationId(v); setPage(1); }}
          options={[{ value: ALL, label: t("allLocations") }, ...(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))]}
        />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("documents.type")}</TableHead>
              <TableHead>{t("location")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("supplier")}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t("lines")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("documents.by")}</TableHead>
              <TableHead>{t("documents.when")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.isPending && <TableRow><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {documents.data?.items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{tc("empty")}</TableCell></TableRow>
            )}
            {documents.data?.items.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/admin/inventory/documents/${d.id}`)}>
                <TableCell>
                  <Link href={`/admin/inventory/documents/${d.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {Number(d.number)}
                  </Link>
                </TableCell>
                <TableCell><DocumentBadge type={d.type} /></TableCell>
                <TableCell>{d.toLocationName ? `${d.locationName} → ${d.toLocationName}` : d.locationName}</TableCell>
                <TableCell className="hidden md:table-cell">{d.supplier}</TableCell>
                <TableCell className="hidden text-right sm:table-cell">{Number(d.movementCount)}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{d.createdBy}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(d.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("documents.count", { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("previous")} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
          <span>{t("page", { page, pages })}</span>
          <Button variant="outline" size="icon" aria-label={t("next")} disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
