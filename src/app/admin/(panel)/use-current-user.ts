"use client";

import { useQuery } from "@tanstack/react-query";
import { api, call } from "@/lib/api/client";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => call(api.GET("/api/auth/me")),
    staleTime: 5 * 60 * 1000,
  });
}
