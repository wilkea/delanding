"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Schemas } from "@/lib/api/types";

const priceFormat = new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 });

export function formatPrice(amount: number | string) {
  return `${priceFormat.format(Number(amount))} MDL`;
}

export function StatusBadge({ status }: { status: Schemas["ProductStatus"] }) {
  const t = useTranslations("admin.products.statuses");
  const variant = status === "Active" ? "default" : status === "Draft" ? "secondary" : "outline";
  return <Badge variant={variant}>{t(status)}</Badge>;
}
