"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderStatusBadge, usePaymentLabel, type OrderStatus } from "./orders-shared";

const tabs = {
  todo: ["New", "Confirmed", "Packed"],
  shipped: ["Shipped"],
  delivered: ["Delivered"],
  closed: ["Cancelled", "ReturnedToSender"],
  all: [],
} satisfies Record<string, OrderStatus[]>;

type Tab = keyof typeof tabs;
const pageSize = 30;

function OrdersList() {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paymentLabel = usePaymentLabel();
  const tab = (params.get("tab") as Tab | null) && params.get("tab")! in tabs ? (params.get("tab") as Tab) : "todo";
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);

  const statuses = tabs[tab] as OrderStatus[];
  const query = { search: deferred || undefined, status: statuses.length > 0 ? statuses : undefined, page, pageSize };
  const orders = useQuery({
    queryKey: ["orders", query],
    queryFn: () => call(api.GET("/api/admin/orders", { params: { query } })),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({ queryKey: ["orders", "counts"], queryFn: () => call(api.GET("/api/admin/orders/counts")) });
  const countOf = (list: OrderStatus[]) =>
    (counts.data?.byStatus ?? []).filter((c) => list.length === 0 || list.includes(c.status)).reduce((sum, c) => sum + Number(c.count), 0);

  const total = Number(orders.data?.totalCount ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function openTab(next: Tab) {
    setPage(1);
    router.replace(next === "todo" ? pathname : `${pathname}?tab=${next}`);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} description={t("description")} />
      <div role="tablist" aria-label={t("title")} className="mb-4 flex flex-wrap gap-1 border-b">
        {(Object.keys(tabs) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => openTab(key)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${key}`)}
            {counts.data && (
              <span className={cn("rounded-full px-1.5 text-xs", tab === key ? "bg-primary/10" : "bg-muted")}>{countOf(tabs[key] as OrderStatus[])}</span>
            )}
          </button>
        ))}
        {counts.data && Number(counts.data.refundNeeded) > 0 && (
          <Badge variant="destructive" className="ml-auto self-center">{t("refundNeededCount", { count: Number(counts.data.refundNeeded) })}</Badge>
        )}
      </div>
      <div className="relative mb-4 max-w-sm">
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
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("customer")}</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("payment")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.isPending && <TableRow><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {orders.data?.items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{tab === "todo" ? t("nothingToDo") : tc("empty")}</TableCell></TableRow>
            )}
            {orders.data?.items.map((o) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                <TableCell>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    #{Number(o.number)}
                  </Link>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(o.createdAt)}</TableCell>
                <TableCell>
                  <div>{o.customerName}</div>
                  <div className="text-xs text-muted-foreground">{o.phone}</div>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatMoney(o.total)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm">{paymentLabel(o.paymentMethod)}</div>
                  <div className={cn("text-xs", o.paymentStatus === "Paid" ? "text-emerald-700" : "text-muted-foreground")}>{t(`paymentStatuses.${o.paymentStatus}`)}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <OrderStatusBadge status={o.status} />
                    {o.refundNeeded && <Badge variant="destructive">{t("refundNeeded")}</Badge>}
                  </div>
                </TableCell>
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

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersList />
    </Suspense>
  );
}
