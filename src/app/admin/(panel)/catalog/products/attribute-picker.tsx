"use client";

import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { textOf } from "@/lib/api/types";
import { AttributeDialog } from "../attributes/attribute-dialog";
import type { Attribute } from "./product-values";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: Attribute[];
  exclude: Set<string>;
  onPick: (attribute: Attribute) => void;
};

export function AttributePicker({ open, onOpenChange, library, exclude, onPick }: Props) {
  const t = useTranslations("admin.products");
  const ta = useTranslations("admin.attributes");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const term = search.trim().toLowerCase();
  const candidates = library.filter(
    (a) =>
      !exclude.has(a.code) &&
      (!term || a.code.includes(term) || Object.values(a.name).some((n) => n.toLowerCase().includes(term))),
  );

  function pick(attribute: Attribute) {
    onPick(attribute);
    setSearch("");
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addAttribute")}</DialogTitle>
            <DialogDescription>{t("addAttributeHint")}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" autoFocus placeholder={ta("search")} aria-label={ta("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <ul className="max-h-72 overflow-y-auto rounded-lg border" aria-label={t("library")}>
            {candidates.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">{t("nothingFound")}</li>}
            {candidates.map((attribute) => (
              <li key={attribute.id} className="border-b last:border-b-0">
                <button type="button" className="flex w-full items-center justify-between gap-3 p-2.5 text-left hover:bg-muted" onClick={() => pick(attribute)}>
                  <span>
                    <span className="block text-sm font-medium">{textOf(attribute.name)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{attribute.code}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{ta(`types.${attribute.dataType}`)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t("createAttribute")}
          </Button>
        </DialogContent>
      </Dialog>
      <AttributeDialog open={creating} onOpenChange={setCreating} onSaved={pick} />
    </>
  );
}
