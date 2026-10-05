"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, call } from "@/lib/api/client";
import { textOf, type Schemas } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export type DocumentType = Schemas["StockDocumentType"];
export type StockRow = Schemas["StockOverviewRow"];
export type Location = Schemas["StockLocationResponse"];

export { formatDate, formatMoney } from "@/lib/format";

export function useLocations() {
  return useQuery({ queryKey: ["locations"], queryFn: () => call(api.GET("/api/admin/inventory/locations")) });
}

export function Quantity({ value }: { value: number | string }) {
  const n = Number(value);
  return <span className={cn("font-mono tabular-nums", n > 0 ? "text-emerald-700" : n < 0 ? "text-destructive" : "")}>{n > 0 ? `+${n}` : n}</span>;
}

export function DocumentBadge({ type }: { type: DocumentType }) {
  const t = useTranslations("admin.inventory.types");
  return <Badge variant="secondary">{t(type)}</Badge>;
}

export function VariantPicker({ exclude, onPick, label }: { exclude: Set<string>; onPick: (row: StockRow) => void; label: string }) {
  const t = useTranslations("admin.inventory");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const term = useDeferredValue(search.trim());
  const results = useQuery({
    queryKey: ["stock", { search: term, page: 1, pageSize: 8 }],
    queryFn: () => call(api.GET("/api/admin/inventory/stock", { params: { query: { search: term, page: 1, pageSize: 8 } } })),
    enabled: term.length >= 2,
  });
  const rows = (results.data?.items ?? []).filter((r) => !exclude.has(r.variantId));

  return (
    <div
      className="relative max-w-md"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-8"
        aria-label={label}
        placeholder={label}
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && term.length >= 2 && (
        <ul role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover shadow-md">
          {results.isFetching && rows.length === 0 && <li className="p-3 text-sm text-muted-foreground">{t("searching")}</li>}
          {!results.isFetching && rows.length === 0 && <li className="p-3 text-sm text-muted-foreground">{t("noVariants")}</li>}
          {rows.map((row) => (
            <li key={row.variantId} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  onPick(row);
                  setSearch("");
                }}
              >
                <span>
                  <span className="block font-mono text-sm">{row.sku}</span>
                  <span className="text-xs text-muted-foreground">{textOf(row.productName)}</span>
                </span>
                <span className="text-xs text-muted-foreground">{t("onHandShort", { count: Number(row.total) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
