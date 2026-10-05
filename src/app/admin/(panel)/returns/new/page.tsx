import { notFound } from "next/navigation";
import { NewReturnForm } from "./new-return-form";

export default async function NewReturnPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  if (!order) {
    notFound();
  }

  return <NewReturnForm orderId={order} />;
}
