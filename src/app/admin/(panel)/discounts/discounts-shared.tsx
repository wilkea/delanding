"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Schemas } from "@/lib/api/types";

export type Discount = Schemas["DiscountResponse"];
export type DiscountState = "Active" | "Scheduled" | "Ended" | "Off";

export function stateOf(discount: Discount, now = new Date()): DiscountState {
  if (!discount.isActive) {
    return "Off";
  }

  if (new Date(discount.startsAt) > now) {
    return "Scheduled";
  }

  return discount.endsAt && new Date(discount.endsAt) < now ? "Ended" : "Active";
}

export function DiscountStateBadge({ discount }: { discount: Discount }) {
  const t = useTranslations("admin.discounts.states");
  const state = stateOf(discount);
  const variant = state === "Active" ? "default" : state === "Scheduled" ? "secondary" : "outline";
  return <Badge variant={variant}>{t(state)}</Badge>;
}

export function gives(discount: Pick<Discount, "kind" | "percent" | "buyQuantity" | "freeQuantity">) {
  return discount.kind === "Percentage"
    ? `−${Number(discount.percent)} %`
    : `${Number(discount.buyQuantity)}+${Number(discount.freeQuantity)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
