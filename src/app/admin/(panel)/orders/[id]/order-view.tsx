"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Check, ClipboardCopy, Link2, PackageCheck, PackageOpen, Printer, RotateCcw, Truck, Undo2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { OrderStatusBadge, usePaymentLabel, type Order } from "../orders-shared";

type Action = "pack" | "ship" | "unpack" | "deliver" | "returnToSender" | "cancel" | "link" | null;

function useOptionLabels() {
  const library = useQuery({ queryKey: ["attributes", ""], queryFn: () => call(api.GET("/api/admin/attributes", {})) });
  return (code: string, option: string) => {
    const attribute = library.data?.find((a) => a.code === code);
    return attribute ? `${textOf(attribute.name)}: ${textOf(attribute.options.find((o) => o.code === option)?.label) || option}` : `${code}: ${option}`;
  };
}

function ActionDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  onClose,
  onConfirm,
  messages,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  messages: string[];
  children?: ReactNode;
}) {
  const tc = useTranslations("admin.common");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <ServerErrors messages={messages} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm [overflow-wrap:anywhere]">{children || "—"}</dd>
    </div>
  );
}

export function OrderView({ id }: { id: string }) {
  const t = useTranslations("admin.orders");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const paymentLabel = usePaymentLabel();
  const optionLabel = useOptionLabels();
  const order = useQuery({ queryKey: ["order", id], queryFn: () => call(api.GET("/api/admin/orders/{id}", { params: { path: { id } } })) });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => call(api.GET("/api/admin/inventory/locations")) });
  const [action, setAction] = useState<Action>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [waybill, setWaybill] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const server = useServerErrors(null, {
    locationId: t("house"),
    waybillNumber: t("waybill"),
    note: t("note"),
    status: t("status"),
  });

  if (!order.data) {
    return <Skeleton className="mx-auto h-96 max-w-5xl" />;
  }

  const o = order.data;
  const activeLocations = (locations.data ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }));
  const locationName = locations.data?.find((l) => l.id === o.locationId)?.name;
  const noteValue = adminNote ?? o.adminNote ?? "";

  function open(next: Action) {
    server.clear();
    setLocationId(null);
    setWaybill("");
    setNote("");
    setAction(next);
  }

  async function run(request: () => Promise<Order>, closeAfter = true) {
    server.clear();
    try {
      const updated = await request();
      queryClient.setQueryData(["order", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      notify.saved();
      if (closeAfter) {
        setAction(null);
      }
    } catch (error) {
      server.show(error);
    }
  }

  const path = { params: { path: { id } } };
  const confirm = () => run(() => call(api.POST("/api/admin/orders/{id}/confirm", path)));
  const status = o.status;
  const canCancel = status === "New" || status === "Confirmed" || status === "Packed";
  const totalItems = o.lines.reduce((sum, l) => sum + Number(l.quantity), 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/orders" aria-label={t("title")} className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-heading text-2xl font-medium">#{Number(o.number)}</h1>
        <OrderStatusBadge status={status} />
        {o.refundNeeded && <Badge variant="destructive">{t("refundNeeded")}</Badge>}
        <span className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href={`/admin/print/orders/${o.id}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
            <Printer className="size-4" />
            {t("print")}
          </Link>
          <Button variant="outline" onClick={() => open("link")}>
            <Link2 className="size-4" />
            {t("newLink")}
          </Button>
        </div>
      </div>

      <ServerErrors messages={action ? [] : server.messages} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t(`nextStep.${status}`)}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {status === "New" && (
              <Button onClick={confirm}><Check className="size-4" />{t("actions.confirm")}</Button>
            )}
            {status === "Confirmed" && (
              <Button onClick={() => open("pack")}><PackageCheck className="size-4" />{t("actions.pack")}</Button>
            )}
            {status === "Packed" && (
              <>
                <Button variant="outline" onClick={() => open("unpack")}><PackageOpen className="size-4" />{t("actions.unpack")}</Button>
                <Button onClick={() => open("ship")}><Truck className="size-4" />{t("actions.ship")}</Button>
              </>
            )}
            {status === "Shipped" && (
              <>
                <Button variant="outline" onClick={() => open("returnToSender")}><Undo2 className="size-4" />{t("actions.returnToSender")}</Button>
                <Button onClick={() => open("deliver")}><Check className="size-4" />{t("actions.deliver")}</Button>
              </>
            )}
            {status === "Delivered" && (
              <Link href={`/admin/returns/new?order=${o.id}`} className={buttonVariants()}>
                <RotateCcw className="size-4" />
                {t("actions.createReturn")}
              </Link>
            )}
            {canCancel && (
              <Button variant="ghost" className="text-destructive" onClick={() => open("cancel")}><Ban className="size-4" />{t("actions.cancel")}</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("customer")}</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label={t("name")}>{`${o.firstName} ${o.lastName}`}</Detail>
              <Detail label={t("phone")}><a className="text-primary hover:underline" href={`tel:${o.phone}`}>{o.phoneDisplay}</a></Detail>
              <Detail label={t("email")}><a className="text-primary hover:underline" href={`mailto:${o.email}`}>{o.email}</a></Detail>
              <Detail label={t("customerNote")}>{o.customerNote}</Detail>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("deliveryAndPayment")}</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label={t("delivery")}>{paymentLabel(o.deliveryMethod)}</Detail>
              <Detail label={t("address")}>{`${o.deliveryCity}, ${o.deliveryPoint}`}</Detail>
              <Detail label={t("payment")}>{paymentLabel(o.paymentMethod)}</Detail>
              <Detail label={t("paymentStatus")}>
                {t(`paymentStatuses.${o.paymentStatus}`)}
                {o.paidAt && ` · ${formatDate(o.paidAt)}`}
                {o.paymentReference && ` · ${o.paymentReference}`}
              </Detail>
              <Detail label={t("house")}>{locationName}</Detail>
              <Detail label={t("waybill")}>{o.waybillNumber}</Detail>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("items", { count: totalItems })}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="divide-y rounded-lg border">
            {o.lines.map((line) => (
              <li key={line.variantId} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{textOf(line.productName)}</div>
                  <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(line.options).map(([code, option]) => optionLabel(code, option)).join(" · ")}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div>{Number(line.quantity)} × {formatMoney(line.unitPrice)}</div>
                  {Number(line.discount) > 0 && <div className="text-xs text-emerald-700">−{formatMoney(line.discount)}</div>}
                  <div className="font-medium">{formatMoney(line.total)}</div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">{t("subtotal")}</dt>
            <dd className="text-right">{formatMoney(o.subtotal)}</dd>
            {Number(o.discountTotal) > 0 && (
              <>
                <dt className="text-muted-foreground">
                  {t("discount")}
                  {o.promoCode ? ` (${o.promoCode})` : textOf(o.offerName) ? ` (${textOf(o.offerName)})` : ""}
                </dt>
                <dd className="text-right text-emerald-700">−{formatMoney(o.discountTotal)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("deliveryFee")}</dt>
            <dd className="text-right">{Number(o.deliveryFee) === 0 ? t("free") : formatMoney(o.deliveryFee)}</dd>
            <dt className="font-medium">{t("total")}</dt>
            <dd className="text-right font-medium" data-testid="order-total">{formatMoney(o.total)}</dd>
          </dl>
        </CardContent>
      </Card>

      {o.returns.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("returns")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {o.returns.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <Link className="font-medium text-primary hover:underline" href={`/admin/returns/${r.id}`}>R-{Number(r.number)}</Link>
                  <span className="text-muted-foreground">{t("returnItems", { count: Number(r.itemCount) })}</span>
                  <Badge variant="secondary">{t(`returnStatuses.${r.status}`)}</Badge>
                  {r.refundedAmount != null && <span>{formatMoney(r.refundedAmount)}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("internalNote")}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Textarea
              aria-label={t("internalNote")}
              rows={3}
              placeholder={t("internalNoteHint")}
              value={noteValue}
              onChange={(e) => setAdminNote(e.target.value)}
            />
            <Button
              variant="outline"
              className="self-end"
              disabled={adminNote === null || adminNote === (o.adminNote ?? "")}
              onClick={() =>
                run(async () => {
                  const saved = await call(api.PUT("/api/admin/orders/{id}/admin-note", { ...path, body: { note: noteValue.trim() || null } }));
                  setAdminNote(null);
                  return saved;
                })
              }
            >
              {t("saveNote")}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm" aria-label={t("history")}>
              {[...o.history].reverse().map((h, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium">{t(`statuses.${h.to}`)}</span>
                    <span className="text-muted-foreground"> · {h.by ?? t(`actors.${h.actor}`)}</span>
                    {h.note && <span className="block text-xs">{h.note}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(h.at)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <ActionDialog
        open={action === "pack"}
        title={t("dialogs.packTitle")}
        description={t("dialogs.packHint")}
        confirmLabel={t("actions.pack")}
        messages={server.messages}
        onClose={() => setAction(null)}
        onConfirm={() => run(() => call(api.POST("/api/admin/orders/{id}/pack", { ...path, body: { locationId: locationId ?? "" } })))}
      >
        <Field>
          <FieldLabel htmlFor="pack-house">{t("house")}</FieldLabel>
          <SimpleSelect id="pack-house" value={locationId} placeholder={t("chooseHouse")} options={activeLocations} onChange={setLocationId} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={action === "ship"}
        title={t("dialogs.shipTitle")}
        description={t("dialogs.shipHint")}
        confirmLabel={t("actions.ship")}
        messages={server.messages}
        onClose={() => setAction(null)}
        onConfirm={() => run(() => call(api.POST("/api/admin/orders/{id}/ship", { ...path, body: { waybillNumber: waybill.trim() } })))}
      >
        <Field>
          <FieldLabel htmlFor="ship-waybill">{t("waybill")}</FieldLabel>
          <Input id="ship-waybill" inputMode="numeric" placeholder="20450000000000" value={waybill} onChange={(e) => setWaybill(e.target.value)} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={action === "unpack"}
        title={t("dialogs.unpackTitle")}
        description={t("dialogs.unpackHint")}
        confirmLabel={t("actions.unpack")}
        messages={server.messages}
        onClose={() => setAction(null)}
        onConfirm={() => run(() => call(api.POST("/api/admin/orders/{id}/unpack", path)))}
      />
      <ActionDialog
        open={action === "deliver"}
        title={t("dialogs.deliverTitle")}
        description={o.paymentStatus === "Unpaid" ? t("dialogs.deliverCodHint", { total: formatMoney(o.total) }) : undefined}
        confirmLabel={t("actions.deliver")}
        messages={server.messages}
        onClose={() => setAction(null)}
        onConfirm={() => run(() => call(api.POST("/api/admin/orders/{id}/deliver", path)))}
      />
      <ActionDialog
        open={action === "returnToSender"}
        title={t("dialogs.returnToSenderTitle")}
        description={t("dialogs.returnToSenderHint")}
        confirmLabel={t("actions.returnToSender")}
        messages={server.messages}
        onClose={() => setAction(null)}
        onConfirm={() =>
          run(() => call(api.POST("/api/admin/orders/{id}/return-to-sender", { ...path, body: { locationId: locationId ?? "", note: note.trim() || null } })))
        }
      >
        <Field>
          <FieldLabel htmlFor="rts-house">{t("house")}</FieldLabel>
          <SimpleSelect id="rts-house" value={locationId} placeholder={t("chooseHouse")} options={activeLocations} onChange={setLocationId} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rts-note">{t("note")}</FieldLabel>
          <Input id="rts-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ActionDialog>
      <ActionDialog
        open={action === "cancel"}
        destructive
        title={t("dialogs.cancelTitle", { number: Number(o.number) })}
        description={o.paymentStatus === "Paid" ? t("dialogs.cancelPaidHint") : status === "Packed" ? t("dialogs.cancelPackedHint") : t("dialogs.cancelHint")}
        confirmLabel={t("actions.cancel")}
        messages={server.messages}
        onClose={() => setAction(null)}
        onConfirm={() => run(() => call(api.POST("/api/admin/orders/{id}/cancel", { ...path, body: { note: note.trim() || null } })))}
      >
        <Field>
          <FieldLabel htmlFor="cancel-note">{t("cancelReason")}</FieldLabel>
          <Input id="cancel-note" placeholder={t("cancelReasonHint")} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ActionDialog>
      <Dialog open={action === "link"} onOpenChange={(v) => !v && (setAction(null), setLink(null))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogs.linkTitle")}</DialogTitle>
            <DialogDescription>{t("dialogs.linkHint")}</DialogDescription>
          </DialogHeader>
          {link ? (
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label={t("dialogs.linkTitle")} onFocus={(e) => e.target.select()} />
              <Button
                variant="outline"
                size="icon"
                aria-label={t("copy")}
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  notify.saved();
                }}
              >
                <ClipboardCopy className="size-4" />
              </Button>
            </div>
          ) : (
            <ServerErrors messages={server.messages} />
          )}
          <DialogFooter>
            {!link && (
              <Button
                onClick={async () => {
                  server.clear();
                  try {
                    const result = await call(api.POST("/api/admin/orders/{id}/resend-link", path));
                    setLink(`${window.location.origin}/order/${result.accessToken}`);
                  } catch (error) {
                    server.show(error);
                  }
                }}
              >
                {t("dialogs.linkCreate")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
