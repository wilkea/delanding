"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, call } from "@/lib/api/client";
import { textOf, type Schemas } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VariantPicker, type StockRow } from "../inventory/inventory-shared";

type Line = { variantId: string; sku: string; name: string; quantity: string };
type Preview = Schemas["PricePreviewResponse"];

export function TryCart() {
  const t = useTranslations("admin.discounts.tryCart");
  const tc = useTranslations("admin.common");
  const [lines, setLines] = useState<Line[]>([]);
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const server = useServerErrors(null, { lines: t("cart"), promoCode: t("code"), selectedOfferId: t("offer") });

  async function calculate(offerId: string | null = selected) {
    server.clear();
    setBusy(true);
    try {
      const result = await call(
        api.POST("/api/admin/pricing/preview", {
          body: {
            lines: lines.map((l) => ({ variantId: l.variantId, quantity: Number(l.quantity) || 0 })),
            promoCode: code.trim() || null,
            selectedOfferId: offerId,
          },
        }),
      );
      setPreview(result);
      setSelected(result.selectedOfferId ?? null);
    } catch (error) {
      setPreview(null);
      server.show(error);
    } finally {
      setBusy(false);
    }
  }

  function add(row: StockRow) {
    setLines((all) => [...all, { variantId: row.variantId, sku: row.sku, name: textOf(row.productName), quantity: "1" }]);
    setPreview(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <VariantPicker label={t("add")} exclude={new Set(lines.map((l) => l.variantId))} onPick={add} />
        {lines.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {lines.map((line, index) => (
              <li key={line.variantId} className="flex items-center gap-3 p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs">{line.sku}</div>
                  <div className="text-xs text-muted-foreground">{line.name}</div>
                </div>
                <Input
                  aria-label={`${t("quantity")} ${line.sku}`}
                  inputMode="numeric"
                  className="w-16 text-right"
                  value={line.quantity}
                  onChange={(e) => {
                    const quantity = e.target.value;
                    setLines((all) => all.map((l, i) => (i === index ? { ...l, quantity } : l)));
                    setPreview(null);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${tc("remove")} ${line.sku}`}
                  onClick={() => {
                    setLines((all) => all.filter((_, i) => i !== index));
                    setPreview(null);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={t("code")}
            placeholder={t("codePlaceholder")}
            className="w-48 font-mono uppercase"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setPreview(null);
            }}
          />
          <Button disabled={busy || lines.length === 0} onClick={() => calculate(null)}>{t("calculate")}</Button>
        </div>
        <ServerErrors messages={server.messages} />
        {preview && (
          <div className="flex flex-col gap-3" data-testid="cart-preview">
            {preview.promoCode && preview.promoCodeStatus && preview.promoCodeStatus !== "Valid" && (
              <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">{t(`codeStatus.${preview.promoCodeStatus}`, { code: preview.promoCode })}</p>
            )}
            {preview.offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOffers", { total: formatMoney(preview.total) })}</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label={t("offers")}>
                {preview.offers.map((offer) => (
                  <li key={offer.id}>
                    <button
                      type="button"
                      onClick={() => calculate(offer.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm",
                        selected === offer.id ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{offer.code ?? (textOf(offer.name) || t(`offerTypes.${offer.type}`))}</span>
                        {offer.id === preview.bestOfferId && <Badge variant="secondary">{t("best")}</Badge>}
                        {selected === offer.id && <Badge>{t("chosen")}</Badge>}
                      </span>
                      <span className="tabular-nums">
                        <span className="text-emerald-700">−{formatMoney(offer.discountTotal)}</span> · <span className="font-medium">{formatMoney(offer.total)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <table className="w-full text-sm">
              <tbody>
                {preview.lines.map((l) => (
                  <tr key={l.variantId} className="border-t">
                    <td className="py-1 font-mono text-xs">{l.sku}</td>
                    <td className="py-1 text-right tabular-nums">{Number(l.quantity)} × {formatMoney(l.unitPrice)}</td>
                    <td className="py-1 text-right text-emerald-700 tabular-nums">{Number(l.discount) > 0 ? `−${formatMoney(l.discount)}` : ""}</td>
                    <td className="py-1 text-right font-medium tabular-nums">{formatMoney(l.total)}</td>
                  </tr>
                ))}
                <tr className="border-t">
                  <td colSpan={3} className="py-1 font-medium">{t("total")}</td>
                  <td className="py-1 text-right font-medium tabular-nums" data-testid="cart-total">{formatMoney(preview.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
