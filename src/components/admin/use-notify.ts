"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";

export function useNotify() {
  const t = useTranslations("admin");

  return {
    saved: () => toast.success(t("saved")),
    deleted: () => toast.success(t("deleted")),
    failed: (error: unknown) => {
      if (error instanceof ApiError && error.status === 0) {
        toast.error(t("errors.unreachable"));
      } else if (error instanceof ApiError && error.status !== 401) {
        toast.error(error.message || t("errors.unexpected"));
      } else if (!(error instanceof ApiError)) {
        toast.error(t("errors.unexpected"));
      }
    },
  };
}
