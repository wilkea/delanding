import { ReturnView } from "./return-view";

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReturnView id={id} />;
}
