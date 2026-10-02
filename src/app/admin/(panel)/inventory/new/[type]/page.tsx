import { notFound } from "next/navigation";
import { DocumentForm, type FormType } from "./document-form";

const types: FormType[] = ["receipt", "adjustment", "count", "transfer"];

export default async function NewDocumentPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!types.includes(type as FormType)) {
    notFound();
  }

  return <DocumentForm type={type as FormType} />;
}
