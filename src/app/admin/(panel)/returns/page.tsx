"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleSelect } from "@/components/admin/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import { ReturnStatusBadge, type ReturnStatus } from "./returns-shared";

const ALL = "all";
const pageSize = 30;
const statuses: ReturnStatus[] = ["Open", "Received", "Closed", "Cancelled"];

export default function ReturnsPage() {
  const t = useTranslations("admin.returns");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim().replace(/^#/, ""));
  const [page, setPage] = useState(1);

  const orderNumber = /^\d+$/.test(deferred) ? Number(deferred) : undefined;
  const query = { status: status === ALL ? undefined : (status as ReturnStatus), orderNumber, page, pageSize };
  const returns = useQuery({
    queryKey: ["returns", query],
    queryFn: () => call(api.GET("/api/admin/returns", { params: { query } })),
    placeholderData: keepPreviousData,
  });
  const total = Number(returns.data?.totalCount ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            inputMode="numeric"
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
          className="w-40"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[{ value: ALL, label: t("allStatuses") }, ...statuses.map((s) => ({ value: s, label: t(`statuses.${s}`) }))]}
        />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("number")}</TableHead>
              <TableHead>{t("order")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("items")}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t("paidForItems")}</TableHead>
              <TableHead className="text-right">{t("refunded")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.isPending && <TableRow><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {returns.data?.items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{tc("empty")}</TableCell></TableRow>
            )}
            {returns.data?.items.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/admin/returns/${r.id}`)}>
                <TableCell>
                  <Link href={`/admin/returns/${r.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    R-{Number(r.number)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/orders/${r.orderId}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    #{Number(r.orderNumber)}
                  </Link>
                </TableCell>
                <TableCell><ReturnStatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right">{Number(r.itemCount)}</TableCell>
                <TableCell className="hidden text-right whitespace-nowrap sm:table-cell">{formatMoney(r.paidForItems)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{r.refundedAmount == null ? "—" : formatMoney(r.refundedAmount)}</TableCell>
                <TableCell className="hidden text-xs whitespace-nowrap md:table-cell">{formatDate(r.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("count", { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("previous")} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
          <span>{t("page", { page, pages })}</span>
          <Button variant="outline" size="icon" aria-label={t("next")} disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
