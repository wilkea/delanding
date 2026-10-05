import { PackingSlip } from "./packing-slip";

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PackingSlip id={id} />;
}
