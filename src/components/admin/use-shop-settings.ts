"use client";

import { useQuery } from "@tanstack/react-query";
import { api, call } from "@/lib/api/client";

export function useShopSettings() {
  return useQuery({ queryKey: ["settings", "shop"], queryFn: () => call(api.GET("/api/admin/settings/shop")) });
}
