"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { useNotify } from "@/components/admin/use-notify";
import { useShopSettings } from "@/components/admin/use-shop-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, call } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

type Payment = Schemas["PaymentMethodSettingResponse"];
type Delivery = Schemas["DeliveryMethodSettingResponse"];

function useMethodName() {
  const t = useTranslations("admin.orders.methods");
  return (code: string) => (t.has(code) ? t(code) : code);
}

function PaymentRow({ method }: { method: Payment }) {
  const t = useTranslations("admin.settings");
  const name = useMethodName();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState(String(Number(method.sortOrder)));
  const server = useServerErrors(null, { sortOrder: t("order") });

  async function save(isEnabled: boolean, sortOrder: string) {
    server.clear();
    try {
      await call(api.PUT("/api/admin/checkout/payment-methods/{code}", { params: { path: { code: method.code } }, body: { isEnabled, sortOrder: Number(sortOrder) } }));
      await queryClient.invalidateQueries({ queryKey: ["checkout", "payment"] });
      notify.saved();
    } catch (error) {
      server.show(error);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3" data-testid={`payment-${method.code}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={method.isEnabled} aria-label={`${t("enabled")} ${name(method.code)}`} onCheckedChange={(c) => save(c, order)} />
        <span className="flex-1 font-medium">{name(method.code)}</span>
        {method.isOnline && <Badge variant="secondary">{t("online")}</Badge>}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("order")}
          <Input aria-label={`${t("order")} ${name(method.code)}`} inputMode="numeric" className="w-16" value={order} onChange={(e) => setOrder(e.target.value)} />
        </label>
        <Button variant="outline" size="sm" disabled={order === String(Number(method.sortOrder))} onClick={() => save(method.isEnabled, order)}>
          {t("save")}
        </Button>
      </div>
      <ServerErrors messages={server.messages} />
    </li>
  );
}

function DeliveryRow({ method }: { method: Delivery }) {
  const t = useTranslations("admin.settings");
  const name = useMethodName();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const initial = { fee: String(Number(method.fee)), freeFrom: method.freeFrom == null ? "" : String(Number(method.freeFrom)), sortOrder: String(Number(method.sortOrder)) };
  const [values, setValues] = useState(initial);
  const server = useServerErrors(null, { fee: t("fee"), freeFrom: t("freeFrom"), sortOrder: t("order") });
  const changed = JSON.stringify(values) !== JSON.stringify(initial);

  async function save(isEnabled: boolean) {
    server.clear();
    try {
      await call(
        api.PUT("/api/admin/checkout/delivery-methods/{code}", {
          params: { path: { code: method.code } },
          body: {
            isEnabled,
            fee: Number(values.fee.replace(",", ".")),
            freeFrom: values.freeFrom.trim() === "" ? null : Number(values.freeFrom.replace(",", ".")),
            sortOrder: Number(values.sortOrder),
          },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["checkout", "delivery"] });
      notify.saved();
    } catch (error) {
      server.show(error);
    }
  }

  const input = (key: keyof typeof values, label: string, suffix?: string, placeholder?: string) => (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {label}
      <Input
        aria-label={`${label} ${name(method.code)}`}
        inputMode="decimal"
        className="w-24"
        placeholder={placeholder}
        value={values[key]}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
      />
      {suffix}
    </label>
  );

  return (
    <li className="flex flex-col gap-2 py-3" data-testid={`delivery-${method.code}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={method.isEnabled} aria-label={`${t("enabled")} ${name(method.code)}`} onCheckedChange={(c) => save(c)} />
        <span className="flex-1 font-medium">{name(method.code)}</span>
        {input("fee", t("fee"), "MDL")}
        {input("freeFrom", t("freeFrom"), "MDL", t("never"))}
        {input("sortOrder", t("order"))}
        <Button variant="outline" size="sm" disabled={!changed} onClick={() => save(method.isEnabled)}>
          {t("save")}
        </Button>
      </div>
      <ServerErrors messages={server.messages} />
    </li>
  );
}

function ShopCard() {
  const t = useTranslations("admin.settings");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const shop = useShopSettings();
  const [values, setValues] = useState<{ lowStockAt: string; vatRate: string } | null>(null);
  const server = useServerErrors(null, { lowStockAt: t("lowStockAt"), vatRate: t("vatRate") });

  if (!shop.data) {
    return <Skeleton className="h-32 w-full" />;
  }

  const saved = { lowStockAt: String(Number(shop.data.lowStockAt)), vatRate: String(Number(shop.data.vatRate)) };
  const current = values ?? saved;
  const changed = current.lowStockAt !== saved.lowStockAt || current.vatRate !== saved.vatRate;

  async function save() {
    server.clear();
    try {
      const result = await call(
        api.PUT("/api/admin/settings/shop", {
          body: { lowStockAt: Number(current.lowStockAt), vatRate: Number(current.vatRate.replace(",", ".")) },
        }),
      );
      queryClient.setQueryData(["settings", "shop"], result);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      setValues(null);
      notify.saved();
    } catch (error) {
      server.show(error);
    }
  }

  const field = (key: "lowStockAt" | "vatRate", label: string, hint: string, suffix: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <Input
          aria-label={label}
          inputMode="decimal"
          className="w-24"
          value={current[key]}
          onChange={(e) => setValues({ ...current, [key]: e.target.value })}
        />
        <span className="text-muted-foreground">{suffix}</span>
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("shop")}</CardTitle>
        <CardDescription>{t("shopHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("lowStockAt", t("lowStockAt"), t("lowStockAtHint"), t("pieces"))}
          {field("vatRate", t("vatRate"), t("vatRateHint"), "%")}
        </div>
        <ServerErrors messages={server.messages} />
        <Button className="self-end" disabled={!changed} onClick={save}>{t("save")}</Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const t = useTranslations("admin.settings");
  const payments = useQuery({ queryKey: ["checkout", "payment"], queryFn: () => call(api.GET("/api/admin/checkout/payment-methods")) });
  const deliveries = useQuery({ queryKey: ["checkout", "delivery"], queryFn: () => call(api.GET("/api/admin/checkout/delivery-methods")) });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ShopCard />
      <Card>
        <CardHeader>
          <CardTitle>{t("payments")}</CardTitle>
          <CardDescription>{t("paymentsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.isPending && <Skeleton className="h-10 w-full" />}
          <ul className="divide-y">
            {payments.data?.map((m) => <PaymentRow key={`${m.code}-${m.isEnabled}-${m.sortOrder}`} method={m} />)}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("deliveries")}</CardTitle>
          <CardDescription>{t("deliveriesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.isPending && <Skeleton className="h-10 w-full" />}
          <ul className="divide-y">
            {deliveries.data?.map((m) => <DeliveryRow key={`${m.code}-${m.isEnabled}-${m.fee}-${m.freeFrom}-${m.sortOrder}`} method={m} />)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
