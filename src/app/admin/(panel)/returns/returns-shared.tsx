"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Schemas } from "@/lib/api/types";

export type ReturnStatus = Schemas["ReturnStatus"];
export type Return = Schemas["ReturnResponse"];
export type ReturnReason = Schemas["ReturnReason"];

export const reasons: ReturnReason[] = ["ChangedMind", "WrongSize", "Defective", "WrongItemSent", "NotAsDescribed", "Other"];

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  const t = useTranslations("admin.returns.statuses");
  const variant = status === "Open" ? "default" : status === "Received" ? "secondary" : "outline";
  return <Badge variant={variant}>{t(status)}</Badge>;
}
