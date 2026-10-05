"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { useNotify } from "@/components/admin/use-notify";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { reasons, type ReturnReason } from "../returns-shared";

type LineInput = { quantity: string; reason: ReturnReason; note: string };

export function NewReturnForm({ orderId }: { orderId: string }) {
  const t = useTranslations("admin.returns");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const router = useRouter();
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ["order", orderId], queryFn: () => call(api.GET("/api/admin/orders/{id}", { params: { path: { id: orderId } } })) });
  const existing = useQueries({
    queries: (order.data?.returns ?? [])
      .filter((r) => r.status !== "Cancelled")
      .map((r) => ({ queryKey: ["return", r.id], queryFn: () => call(api.GET("/api/admin/returns/{id}", { params: { path: { id: r.id } } })) })),
  });
  const [inputs, setInputs] = useState<Record<string, LineInput>>({});
  const [note, setNote] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const server = useServerErrors(null, { lines: t("items"), note: t("note"), orderId: t("order") });

  if (!order.data || existing.some((q) => q.isPending)) {
    return <Skeleton className="mx-auto h-96 max-w-3xl" />;
  }

  const o = order.data;
  const alreadyReturned = (variantId: string) =>
    existing.reduce((sum, q) => sum + (q.data?.lines ?? []).filter((l) => l.variantId === variantId).reduce((s, l) => s + Number(l.quantity), 0), 0);
  const lines = o.lines.map((line) => {
    const input = inputs[line.variantId] ?? { quantity: "", reason: "WrongSize" as ReturnReason, note: "" };
    const paidPerUnit = Math.round((Number(line.total) / Number(line.quantity)) * 100) / 100;
    return { line, input, paidPerUnit, left: Number(line.quantity) - alreadyReturned(line.variantId) };
  });
  const chosen = lines.filter((l) => Number(l.input.quantity) > 0);
  const paidTotal = chosen.reduce((sum, l) => sum + Number(l.input.quantity) * l.paidPerUnit, 0);

  const update = (variantId: string, patch: Partial<LineInput>) =>
    setInputs((all) => ({ ...all, [variantId]: { ...(all[variantId] ?? { quantity: "", reason: "WrongSize", note: "" }), ...patch } }));

  async function save() {
    server.clear();
    setLineErrors({});
    setBusy(true);
    try {
      const created = await call(
        api.POST("/api/admin/returns", {
          body: {
            orderId,
            note: note.trim() || null,
            lines: chosen.map((l) => ({ variantId: l.line.variantId, quantity: Number(l.input.quantity), reason: l.input.reason, note: l.input.note.trim() || null })),
          },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      await queryClient.invalidateQueries({ queryKey: ["returns"] });
      notify.saved();
      router.push(`/admin/returns/${created.id}`);
    } catch (error) {
      server.show(error);
      if (error instanceof ApiError) {
        const perLine: Record<string, string[]> = {};
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const match = /^lines\[(\d+)\]/.exec(key);
          const variantId = match ? chosen[Number(match[1])]?.line.variantId : undefined;
          if (variantId) {
            perLine[variantId] = [...(perLine[variantId] ?? []), ...messages];
          }
        }
        setLineErrors(perLine);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-16">
      <PageHeader
        title={t("newTitle", { number: Number(o.number) })}
        description={t("newHint")}
        actions={
          <Link href={`/admin/orders/${orderId}`} className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft className="size-4" />#{Number(o.number)}
          </Link>
        }
      />
      <Card>
        <CardContent className="flex flex-col divide-y">
          {lines.map(({ line, input, paidPerUnit, left }) => (
            <div key={line.variantId} className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]" data-testid={`return-line-${line.sku}`}>
              <div>
                <div className="font-medium">{textOf(line.productName)}</div>
                <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                <div className="text-xs text-muted-foreground">{t("lineInfo", { left, bought: Number(line.quantity), paid: formatMoney(paidPerUnit) })}</div>
                {lineErrors[line.variantId] && <p className="mt-1 text-xs text-destructive">{lineErrors[line.variantId].join(" ")}</p>}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Input
                  aria-label={`${t("quantity")} ${line.sku}`}
                  inputMode="numeric"
                  className="w-20 text-right"
                  placeholder="0"
                  disabled={left <= 0}
                  value={input.quantity}
                  onChange={(e) => update(line.variantId, { quantity: e.target.value })}
                />
                <SimpleSelect
                  aria-label={`${t("reason")} ${line.sku}`}
                  className="w-48"
                  value={input.reason}
                  disabled={left <= 0}
                  options={reasons.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
                  onChange={(r) => update(line.variantId, { reason: r as ReturnReason })}
                />
                {input.reason === "Other" && (
                  <Input
                    aria-label={`${t("note")} ${line.sku}`}
                    className="w-full"
                    placeholder={t("otherNote")}
                    value={input.note}
                    onChange={(e) => update(line.variantId, { note: e.target.value })}
                  />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Field>
        <FieldLabel htmlFor="return-note">{t("note")}</FieldLabel>
        <Textarea id="return-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-right text-sm">
        {t("paidForTheseItems")}: <span className="font-medium" data-testid="paid-total">{formatMoney(paidTotal)}</span>
      </p>
      <ServerErrors messages={server.messages} />
      <div className="flex justify-end gap-2">
        <Link href={`/admin/orders/${orderId}`} className={buttonVariants({ variant: "outline" })}>{tc("cancel")}</Link>
        <Button disabled={busy || chosen.length === 0} onClick={save}>{t("create")}</Button>
      </div>
    </div>
  );
}
