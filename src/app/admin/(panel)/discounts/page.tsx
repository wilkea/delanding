"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleSelect } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { DiscountStateBadge, gives, type Discount } from "./discounts-shared";
import { TryCart } from "./try-cart";

const ALL = "all";

export default function DiscountsPage() {
  const t = useTranslations("admin.discounts");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState(ALL);
  const discounts = useQuery({ queryKey: ["discounts"], queryFn: () => call(api.GET("/api/admin/discounts")) });
  const list = (discounts.data ?? []).filter((d) => filter === ALL || d.activation === filter);

  async function toggle(discount: Discount, isActive: boolean) {
    try {
      await call(
        api.PUT("/api/admin/discounts/{id}", {
          params: { path: { id: discount.id } },
          body: { ...discount, isActive, targets: discount.targets.map((x) => ({ type: x.type, targetId: x.targetId })) },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["discounts"] });
      notify.saved();
    } catch (error) {
      notify.failed(error);
    }
  }

  const appliesTo = (d: Discount) =>
    d.targets.map((x) => (x.type === "All" ? t("targetTypes.All") : t(`targetTypes.${x.type}`))).join(", ");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/admin/discounts/new" className={buttonVariants()}>
            <Plus className="size-4" />
            {t("new")}
          </Link>
        }
      />
      <div className="flex gap-2">
        <SimpleSelect
          aria-label={t("activation")}
          className="w-44"
          value={filter}
          onChange={setFilter}
          options={[
            { value: ALL, label: t("allActivations") },
            { value: "Automatic", label: t("activations.Automatic") },
            { value: "Code", label: t("activations.Code") },
          ]}
        />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("gives")}</TableHead>
              <TableHead>{t("activation")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("targets")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("dates")}</TableHead>
              <TableHead className="text-right">{t("used")}</TableHead>
              <TableHead>{t("state")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts.isPending && <TableRow><TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell></TableRow>}
            {list.length === 0 && !discounts.isPending && (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{tc("empty")}</TableCell></TableRow>
            )}
            {list.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/admin/discounts/${d.id}`)}>
                <TableCell>
                  <Link href={`/admin/discounts/${d.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {textOf(d.name)}
                  </Link>
                  {d.minOrderAmount != null && <div className="text-xs text-muted-foreground">{t("from", { amount: formatMoney(d.minOrderAmount) })}</div>}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{gives(d)}</TableCell>
                <TableCell>
                  {d.activation === "Code" ? <Badge variant="outline" className="font-mono">{d.code}</Badge> : <span className="text-sm">{t("activations.Automatic")}</span>}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">{appliesTo(d)}</TableCell>
                <TableCell className="hidden text-xs whitespace-nowrap lg:table-cell">
                  {formatDate(d.startsAt)}
                  {d.endsAt ? ` – ${formatDate(d.endsAt)}` : ` – ${t("noEndShort")}`}
                </TableCell>
                <TableCell className="text-right">
                  {Number(d.timesUsed)}
                  {d.usageLimitTotal != null && <span className="text-muted-foreground"> / {Number(d.usageLimitTotal)}</span>}
                </TableCell>
                <TableCell><DiscountStateBadge discount={d} /></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Switch checked={d.isActive} aria-label={`${t("isActive")} ${textOf(d.name)}`} onCheckedChange={(c) => toggle(d, c)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TryCart />
    </div>
  );
}
