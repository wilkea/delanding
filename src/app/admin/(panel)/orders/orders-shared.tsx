"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Schemas } from "@/lib/api/types";

export type OrderStatus = Schemas["OrderStatus"];
export type Order = Schemas["OrderAdminResponse"];

const tone: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  New: "default",
  Confirmed: "default",
  Packed: "default",
  Shipped: "secondary",
  Delivered: "secondary",
  Cancelled: "outline",
  ReturnedToSender: "outline",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("admin.orders.statuses");
  return <Badge variant={tone[status]}>{t(status)}</Badge>;
}

export function usePaymentLabel() {
  const t = useTranslations("admin.orders.methods");
  return (code: string) => (t.has(code) ? t(code) : code);
}
