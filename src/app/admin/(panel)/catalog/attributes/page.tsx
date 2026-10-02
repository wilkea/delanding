"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageHeader } from "@/components/admin/page-header";
import { useNotify } from "@/components/admin/use-notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, call } from "@/lib/api/client";
import { textOf, type Schemas } from "@/lib/api/types";
import { AttributeDialog } from "./attribute-dialog";

type Attribute = Schemas["AttributeResponse"];

export default function AttributesPage() {
  const t = useTranslations("admin.attributes");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<Attribute | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const attributes = useQuery({
    queryKey: ["attributes", deferredSearch],
    queryFn: () => call(api.GET("/api/admin/attributes", { params: { query: { search: deferredSearch || undefined } } })),
  });

  function open(attribute: Attribute | null) {
    setEditing(attribute);
    setDialogOpen(true);
  }

  async function remove(attribute: Attribute) {
    try {
      await call(api.DELETE("/api/admin/attributes/{id}", { params: { path: { id: attribute.id } } }));
      await queryClient.invalidateQueries({ queryKey: ["attributes"] });
      notify.deleted();
    } catch (error) {
      notify.failed(error);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => open(null)}>
            <Plus className="size-4" />
            {t("new")}
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder={t("search")} aria-label={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("code")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("options")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {attributes.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {attributes.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {tc("empty")}
                </TableCell>
              </TableRow>
            )}
            {attributes.data?.map((attribute) => (
              <TableRow key={attribute.id}>
                <TableCell>
                  <div className="font-medium">{textOf(attribute.name)}</div>
                  {attribute.name.ru && <div className="text-xs text-muted-foreground">{attribute.name.ru}</div>}
                </TableCell>
                <TableCell className="font-mono text-xs">{attribute.code}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{t(`types.${attribute.dataType}`)}</Badge>
                    {attribute.unit && <Badge variant="outline">{attribute.unit}</Badge>}
                    {attribute.isFilterable && <Badge variant="outline">{t("filterable")}</Badge>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {attribute.options.map((o) => textOf(o.label)).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" aria-label={`${tc("edit")} ${attribute.code}`} onClick={() => open(attribute)}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmButton
                      title={t("deleteTitle", { name: textOf(attribute.name) })}
                      description={t("deleteHint")}
                      onConfirm={() => remove(attribute)}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`${tc("delete")} ${attribute.code}`}>
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <AttributeDialog open={dialogOpen} onOpenChange={setDialogOpen} attribute={editing} />
    </div>
  );
}
