"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { api, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";

export function PackingSlip({ id }: { id: string }) {
  const t = useTranslations("admin.orders");
  const tm = useTranslations("admin.orders.methods");
  const order = useQuery({ queryKey: ["order", id], queryFn: () => call(api.GET("/api/admin/orders/{id}", { params: { path: { id } } })) });
  const library = useQuery({ queryKey: ["attributes", ""], queryFn: () => call(api.GET("/api/admin/attributes", {})) });

  if (!order.data) {
    return <p className="p-8 text-sm text-muted-foreground">…</p>;
  }

  const o = order.data;
  const method = (code: string) => (tm.has(code) ? tm(code) : code);
  const option = (code: string, value: string) => {
    const attribute = library.data?.find((a) => a.code === code);
    return attribute ? `${textOf(attribute.name)}: ${textOf(attribute.options.find((x) => x.code === value)?.label) || value}` : `${code}: ${value}`;
  };
  const collect = o.paymentStatus === "Unpaid" && o.paymentMethod === "CashOnDelivery";

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <span className="text-sm text-neutral-500">{t("slip.hint")}</span>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          {t("print")}
        </Button>
      </div>
      <header className="flex items-start justify-between border-b border-black pb-4">
        <Image src="/brand/wordmark-black.png" alt="Depad" width={110} height={49} loading="eager" className="h-auto w-24" />
        <div className="text-right">
          <div className="text-2xl font-bold">#{Number(o.number)}</div>
          <div className="text-sm">{formatDate(o.createdAt)}</div>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-6 py-4 text-sm">
        <div>
          <h2 className="mb-1 text-xs font-bold uppercase">{t("slip.to")}</h2>
          <div className="text-base font-semibold">{`${o.firstName} ${o.lastName}`}</div>
          <div>{o.phoneDisplay}</div>
          <div>{`${o.deliveryCity}, ${o.deliveryPoint}`}</div>
          <div className="text-neutral-600">{method(o.deliveryMethod)}</div>
        </div>
        <div>
          <h2 className="mb-1 text-xs font-bold uppercase">{t("payment")}</h2>
          <div>{method(o.paymentMethod)}</div>
          {collect ? (
            <div className="mt-1 text-lg font-bold" data-testid="slip-collect">{t("slip.collect", { total: formatMoney(o.total) })}</div>
          ) : (
            <div className="mt-1 font-semibold">{t(`paymentStatuses.${o.paymentStatus}`)}</div>
          )}
          {o.waybillNumber && <div className="mt-1">{t("waybill")}: {o.waybillNumber}</div>}
        </div>
      </section>
      {o.customerNote && (
        <section className="mb-4 rounded border border-black p-2 text-sm">
          <span className="font-bold">{t("customerNote")}: </span>
          {o.customerNote}
        </section>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2">✓</th>
            <th className="py-1 pr-2">{t("slip.item")}</th>
            <th className="py-1 pr-2">SKU</th>
            <th className="py-1 text-right">{t("slip.qty")}</th>
          </tr>
        </thead>
        <tbody>
          {o.lines.map((line) => (
            <tr key={line.variantId} className="border-b border-neutral-300 align-top">
              <td className="py-2 pr-2"><span className="inline-block size-4 border border-black" /></td>
              <td className="py-2 pr-2">
                <div className="font-medium">{textOf(line.productName)}</div>
                <div className="text-xs">{Object.entries(line.options).map(([c, v]) => option(c, v)).join(" · ")}</div>
              </td>
              <td className="py-2 pr-2 font-mono text-xs">{line.sku}</td>
              <td className="py-2 text-right text-base font-bold">{Number(line.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs text-neutral-500">{t("slip.thanks")}</p>
    </div>
  );
}
