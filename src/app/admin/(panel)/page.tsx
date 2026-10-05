"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderStatusBadge, type OrderStatus } from "./orders/orders-shared";
import { useShopSettings } from "@/components/admin/use-shop-settings";
import { useCurrentUser } from "./use-current-user";

function Tile({ href, label, value, tone, testId }: { href: string; label: string; value: number | undefined; tone?: "warn"; testId: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-background p-4 transition-colors hover:border-primary",
        tone === "warn" && value ? "border-amber-300 bg-amber-50" : undefined,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      {value === undefined ? <Skeleton className="h-8 w-10" /> : <span className="font-heading text-3xl font-medium tabular-nums">{value}</span>}
    </Link>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Link href={href} className="flex items-center gap-1 text-sm text-primary hover:underline">
          {linkLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations("admin.dashboard");
  const user = useCurrentUser();
  const counts = useQuery({ queryKey: ["orders", "counts"], queryFn: () => call(api.GET("/api/admin/orders/counts")) });
  const latest = useQuery({
    queryKey: ["orders", { latest: 5 }],
    queryFn: () => call(api.GET("/api/admin/orders", { params: { query: { page: 1, pageSize: 5 } } })),
  });
  const toReceive = useQuery({
    queryKey: ["returns", { status: "Open", count: true }],
    queryFn: () => call(api.GET("/api/admin/returns", { params: { query: { status: "Open", page: 1, pageSize: 1 } } })),
  });
  const toRefund = useQuery({
    queryKey: ["returns", { status: "Received", count: true }],
    queryFn: () => call(api.GET("/api/admin/returns", { params: { query: { status: "Received", page: 1, pageSize: 1 } } })),
  });
  const shop = useShopSettings();
  const lowStockAt = shop.data ? Number(shop.data.lowStockAt) : undefined;
  const lowStock = useQuery({
    queryKey: ["stock", { lowStockAt, pageSize: 10 }],
    queryFn: () => call(api.GET("/api/admin/inventory/stock", { params: { query: { lowStockAt, page: 1, pageSize: 10 } } })),
    enabled: lowStockAt !== undefined,
  });

  const count = (status: OrderStatus) => (counts.data ? Number(counts.data.byStatus.find((c) => c.status === status)?.count ?? 0) : undefined);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">{t("title")}</h1>
        {user.data ? <p className="text-muted-foreground">{t("subtitle", { email: user.data.email })}</p> : <Skeleton className="h-5 w-64" />}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={t("toHandle")}>
        <Tile testId="tile-new" href="/admin/orders" label={t("newOrders")} value={count("New")} />
        <Tile testId="tile-confirmed" href="/admin/orders" label={t("toPack")} value={count("Confirmed")} />
        <Tile testId="tile-packed" href="/admin/orders" label={t("toShip")} value={count("Packed")} />
        <Tile
          testId="tile-refunds"
          href="/admin/orders?tab=closed"
          label={t("refundsNeeded")}
          value={counts.data ? Number(counts.data.refundNeeded) : undefined}
          tone="warn"
        />
        <Tile testId="tile-receive" href="/admin/returns" label={t("returnsToReceive")} value={toReceive.data ? Number(toReceive.data.totalCount) : undefined} />
        <Tile testId="tile-refund-returns" href="/admin/returns" label={t("returnsToRefund")} value={toRefund.data ? Number(toRefund.data.totalCount) : undefined} tone="warn" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("latestOrders")} href="/admin/orders?tab=all" linkLabel={t("allOrders")}>
          {latest.isPending && <Skeleton className="h-24 w-full" />}
          {latest.data?.items.length === 0 && <p className="text-sm text-muted-foreground">{t("noOrders")}</p>}
          <ul className="flex flex-col divide-y" aria-label={t("latestOrders")}>
            {latest.data?.items.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:text-primary">
                  <span className="font-medium">#{Number(o.number)}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.customerName}</span>
                  <span className="tabular-nums">{formatMoney(o.total)}</span>
                  <OrderStatusBadge status={o.status} />
                  <span className="w-full text-xs text-muted-foreground sm:w-auto">{formatDate(o.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("lowStock", { count: lowStockAt ?? "…" })} href="/admin/inventory?low=1" linkLabel={t("allLowStock")}>
          {lowStock.isPending && <Skeleton className="h-24 w-full" />}
          {lowStock.data?.items.length === 0 && <p className="text-sm text-muted-foreground">{t("noLowStock")}</p>}
          <ul className="flex flex-col divide-y" aria-label={t("lowStock", { count: lowStockAt ?? "…" })}>
            {lowStock.data?.items.map((row) => (
              <li key={row.variantId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs">{row.sku}</span>
                  <span className="text-xs text-muted-foreground">{textOf(row.productName)}</span>
                </span>
                <span className={cn("flex items-center gap-1 font-medium tabular-nums", Number(row.available) <= 0 && "text-destructive")}>
                  {Number(row.available) <= 0 && <AlertTriangle className="size-3.5" />}
                  {t("available", { count: Number(row.available) })}
                </span>
              </li>
            ))}
          </ul>
          {lowStock.data && Number(lowStock.data.totalCount) > lowStock.data.items.length && (
            <p className="mt-2 text-xs text-muted-foreground">{t("andMore", { count: Number(lowStock.data.totalCount) - lowStock.data.items.length })}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
