"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import type { Media } from "@/components/admin/use-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, call } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function MediaPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (media: Media[]) => void }) {
  const t = useTranslations("admin.media");
  const tc = useTranslations("admin.common");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [selected, setSelected] = useState<Media[]>([]);
  const media = useQuery({
    queryKey: ["media", { search: deferred, page: 1 }],
    queryFn: () => call(api.GET("/api/admin/media", { params: { query: { search: deferred || undefined, page: 1, pageSize: 60 } } })),
    enabled: open,
  });

  function toggle(item: Media) {
    setSelected((list) => (list.some((m) => m.id === item.id) ? list.filter((m) => m.id !== item.id) : [...list, item]));
  }

  function close(open: boolean) {
    if (!open) {
      setSelected([]);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("pickTitle")}</DialogTitle>
        </DialogHeader>
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder={t("search")} aria-label={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label={t("title")}>
          {media.isPending && Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}
          {media.data?.items.length === 0 && <li className="col-span-full p-6 text-center text-sm text-muted-foreground">{tc("empty")}</li>}
          {media.data?.items.map((item) => {
            const isSelected = selected.some((m) => m.id === item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={item.fileName}
                  onClick={() => toggle(item)}
                  className={cn("relative block w-full overflow-hidden rounded-md border-2", isSelected ? "border-primary" : "border-transparent")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- served and resized by the API, not by next/image */}
                  <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                  {isSelected && (
                    <span className="absolute top-1 right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                  <span className="block truncate px-1 py-0.5 text-left text-xs">{item.fileName}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              onPick(selected);
              close(false);
            }}
          >
            {t("addSelected", { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
