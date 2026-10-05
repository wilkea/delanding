"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Banknote, PackageCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, call } from "@/lib/api/client";
import { textOf, type Schemas } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { ReturnStatusBadge, type Return } from "../returns-shared";

type Condition = Schemas["ItemCondition"];
type Inspection = { condition: Condition; locationId: string | null };

export function ReturnView({ id }: { id: string }) {
  const t = useTranslations("admin.returns");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["return", id], queryFn: () => call(api.GET("/api/admin/returns/{id}", { params: { path: { id } } })) });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => call(api.GET("/api/admin/inventory/locations")) });
  const [dialog, setDialog] = useState<"receive" | "refund" | null>(null);
  const [inspections, setInspections] = useState<Record<string, Inspection>>({});
  const [amount, setAmount] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [busy, setBusy] = useState(false);
  const server = useServerErrors(null, { items: t("items"), amount: t("amount"), note: t("note"), status: t("status") });

  if (!data.data) {
    return <Skeleton className="mx-auto h-96 max-w-4xl" />;
  }

  const r = data.data;
  const active = (locations.data ?? []).filter((l) => l.isActive);
  const placesFor = (condition: Condition) =>
    active.filter((l) => (condition === "Resellable" ? l.isSellable : !l.isSellable)).map((l) => ({ value: l.id, label: l.name }));
  const inspectionOf = (variantId: string): Inspection => inspections[variantId] ?? { condition: "Resellable", locationId: null };

  async function run(request: () => Promise<Return>) {
    server.clear();
    setBusy(true);
    try {
      const updated = await request();
      queryClient.setQueryData(["return", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["returns"] });
      await queryClient.invalidateQueries({ queryKey: ["order", r.orderId] });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      notify.saved();
      setDialog(null);
    } catch (error) {
      server.show(error);
    } finally {
      setBusy(false);
    }
  }

  const path = { params: { path: { id } } };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/returns" aria-label={t("title")} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-heading text-2xl font-medium">R-{Number(r.number)}</h1>
        <ReturnStatusBadge status={r.status} />
        <Link href={`/admin/orders/${r.orderId}`} className="text-sm text-primary hover:underline">
          {t("forOrder", { number: Number(r.orderNumber) })}
        </Link>
        <span className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {r.status === "Open" && (
            <>
              <ConfirmButton
                title={t("cancelTitle", { number: Number(r.number) })}
                description={t("cancelHint")}
                confirmLabel={t("cancel")}
                onConfirm={() => run(() => call(api.POST("/api/admin/returns/{id}/cancel", path)))}
                trigger={<Button variant="ghost" className="text-destructive"><Ban className="size-4" />{t("cancel")}</Button>}
              />
              <Button onClick={() => { server.clear(); setDialog("receive"); }}><PackageCheck className="size-4" />{t("receive")}</Button>
            </>
          )}
          {r.status === "Received" && (
            <Button
              onClick={() => {
                server.clear();
                setAmount(String(Number(r.paidForItems)));
                setRefundNote("");
                setDialog("refund");
              }}
            >
              <Banknote className="size-4" />
              {t("markRefunded")}
            </Button>
          )}
        </div>
      </div>

      <ServerErrors messages={dialog ? [] : server.messages} />

      <Card>
        <CardHeader><CardTitle>{t("items")}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="divide-y rounded-lg border">
            {r.lines.map((line) => (
              <li key={line.variantId} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{textOf(line.productName)}</div>
                  <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                  <div className="text-xs">
                    {t(`reasons.${line.reason}`)}
                    {line.note && ` — ${line.note}`}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div>{Number(line.quantity)} × {formatMoney(line.paidPerUnit)}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-right text-sm">
            {t("paidForTheseItems")}: <span className="font-medium">{formatMoney(r.paidForItems)}</span>
          </p>
          {r.note && <p className="text-sm"><span className="text-muted-foreground">{t("note")}: </span>{r.note}</p>}
        </CardContent>
      </Card>

      {r.received.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("received")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm" aria-label={t("received")}>
              {r.received.map((item, i) => (
                <li key={i}>
                  {r.lines.find((l) => l.variantId === item.variantId)?.sku} · {Number(item.quantity)} × {t(`conditions.${item.condition}`)} → {item.locationName}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {r.refundedAmount != null && (
        <Card>
          <CardHeader><CardTitle>{t("refund")}</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="text-lg font-medium" data-testid="refunded-amount">{formatMoney(r.refundedAmount)}</div>
            {r.refundNote && <div>{r.refundNote}</div>}
            {r.refundedAt && <div className="text-xs text-muted-foreground">{formatDate(r.refundedAt)}</div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-1 text-sm" aria-label={t("history")}>
            {[...r.history].reverse().map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">{t(`statuses.${h.to}`)}</span>
                  {h.by && <span className="text-muted-foreground"> · {h.by}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(h.at)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Dialog open={dialog === "receive"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("receiveTitle")}</DialogTitle>
            <DialogDescription>{t("receiveHint")}</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-3">
            {r.lines.map((line) => {
              const inspection = inspectionOf(line.variantId);
              return (
                <li key={line.variantId} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]">
                  <div className="text-sm">
                    <div className="font-mono text-xs">{line.sku}</div>
                    <div>{Number(line.quantity)} × {textOf(line.productName)}</div>
                  </div>
                  <SimpleSelect
                    aria-label={`${t("condition")} ${line.sku}`}
                    className="w-36"
                    value={inspection.condition}
                    options={(["Resellable", "Damaged"] as Condition[]).map((c) => ({ value: c, label: t(`conditions.${c}`) }))}
                    onChange={(c) => setInspections((all) => ({ ...all, [line.variantId]: { condition: c as Condition, locationId: null } }))}
                  />
                  <SimpleSelect
                    aria-label={`${t("place")} ${line.sku}`}
                    className="w-44"
                    value={inspection.locationId}
                    placeholder={t("choosePlace")}
                    options={placesFor(inspection.condition)}
                    onChange={(l) => setInspections((all) => ({ ...all, [line.variantId]: { ...inspection, locationId: l } }))}
                  />
                </li>
              );
            })}
          </ul>
          <ServerErrors messages={server.messages} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{tc("cancel")}</Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(() =>
                  call(
                    api.POST("/api/admin/returns/{id}/receive", {
                      ...path,
                      body: {
                        items: r.lines.map((line) => ({
                          variantId: line.variantId,
                          quantity: Number(line.quantity),
                          condition: inspectionOf(line.variantId).condition,
                          locationId: inspectionOf(line.variantId).locationId ?? "",
                        })),
                      },
                    }),
                  ),
                )
              }
            >
              {t("receive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "refund"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("refundTitle")}</DialogTitle>
            <DialogDescription>{t("refundHint", { paid: formatMoney(r.paidForItems) })}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="refund-amount">{t("amount")}</FieldLabel>
            <Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="refund-note">{t("note")}</FieldLabel>
            <Input id="refund-note" placeholder={t("refundNoteHint")} value={refundNote} onChange={(e) => setRefundNote(e.target.value)} />
          </Field>
          <ServerErrors messages={server.messages} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{tc("cancel")}</Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(() =>
                  call(api.POST("/api/admin/returns/{id}/refund", { ...path, body: { amount: Number(amount.replace(",", ".")), note: refundNote.trim() || null } })),
                )
              }
            >
              {t("markRefunded")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
