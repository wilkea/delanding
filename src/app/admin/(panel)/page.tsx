"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "./use-current-user";

export default function DashboardPage() {
  const t = useTranslations("admin.dashboard");
  const user = useCurrentUser();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-2">
      <h1 className="font-heading text-2xl font-medium">{t("title")}</h1>
      {user.data ? (
        <p className="text-muted-foreground">{t("subtitle", { email: user.data.email })}</p>
      ) : (
        <Skeleton className="h-5 w-64" />
      )}
      <p className="mt-6 rounded-lg border border-dashed bg-background p-6 text-sm text-muted-foreground">{t("comingSoon")}</p>
    </div>
  );
}
