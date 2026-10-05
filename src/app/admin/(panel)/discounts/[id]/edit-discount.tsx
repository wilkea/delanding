"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { api, call } from "@/lib/api/client";
import { DiscountForm } from "../discount-form";

export function EditDiscount({ id }: { id: string }) {
  const discount = useQuery({ queryKey: ["discount", id], queryFn: () => call(api.GET("/api/admin/discounts/{id}", { params: { path: { id } } })) });

  if (!discount.data) {
    return <Skeleton className="mx-auto h-96 max-w-3xl" />;
  }

  return <DiscountForm key={discount.data.id} discount={discount.data} />;
}
