import { ProductEditor } from "../product-editor";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <ProductEditor typeId={type} />;
}
