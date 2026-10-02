"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api/client";

export function Providers({ children }: { children: ReactNode }) {
  const t = useTranslations("admin.errors");

  const [queryClient] = useState(() => {
    const report = (error: Error) => {
      if (error instanceof ApiError && (error.status === 401 || Object.keys(error.fieldErrors).length > 0)) {
        return;
      }

      toast.error(error instanceof ApiError && error.status === 0 ? t("unreachable") : error.message || t("unexpected"));
    };

    return new QueryClient({
      queryCache: new QueryCache({ onError: report }),
      mutationCache: new MutationCache({ onError: report }),
      defaultOptions: {
        queries: {
          retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          refetchOnWindowFocus: false,
        },
      },
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
