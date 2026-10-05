import { EditDiscount } from "./edit-discount";

export default async function DiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditDiscount id={id} />;
}
