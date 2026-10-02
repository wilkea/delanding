"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useRef, useState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageHeader } from "@/components/admin/page-header";
import { useNotify } from "@/components/admin/use-notify";
import { acceptedImages, useUpload, type Media } from "@/components/admin/use-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, call } from "@/lib/api/client";
import { textOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const pageSize = 40;

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function usageHref(kind: string, id: string) {
  return kind.toLowerCase() === "product" ? `/admin/catalog/products/${id}` : null;
}

export default function MediaPage() {
  const t = useTranslations("admin.media");
  const tc = useTranslations("admin.common");
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { upload, uploading } = useUpload();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const media = useQuery({
    queryKey: ["media", { search: deferred, page }],
    queryFn: () => call(api.GET("/api/admin/media", { params: { query: { search: deferred || undefined, page, pageSize } } })),
    placeholderData: keepPreviousData,
  });
  const total = Number(media.data?.totalCount ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  async function remove(item: Media) {
    try {
      await call(api.DELETE("/api/admin/media/{id}", { params: { path: { id: item.id } } }));
      await queryClient.invalidateQueries({ queryKey: ["media"] });
      notify.deleted();
    } catch (error) {
      notify.failed(error);
    }
  }

  async function addFiles(files: FileList | File[]) {
    const uploaded = await upload(files);
    if (uploaded.length > 0) {
      notify.saved();
      setPage(1);
    }
  }

  return (
    <div
      className={cn("mx-auto max-w-6xl rounded-xl", dropping && "ring-2 ring-primary ring-offset-8")}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        if (e.dataTransfer.files.length > 0) {
          void addFiles(e.dataTransfer.files);
        }
      }}
    >
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading > 0 ? t("uploading", { count: uploading }) : t("upload")}
          </Button>
        }
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={acceptedImages}
        className="hidden"
        data-testid="media-upload"
        onChange={(e) => {
          if (e.target.files?.length) {
            void addFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t("search")}
          aria-label={t("search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={t("title")}>
        {media.isPending && Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
        {media.data?.items.length === 0 && (
          <li className="col-span-full rounded-lg border-2 border-dashed p-10 text-center text-sm text-muted-foreground">{t("empty")}</li>
        )}
        {media.data?.items.map((item) => (
          <li key={item.id} className="flex flex-col overflow-hidden rounded-lg border bg-background" data-testid="media-item">
            {/* eslint-disable-next-line @next/next/no-img-element -- served and resized by the API, not by next/image */}
            <img src={item.url} alt="" className="aspect-square w-full bg-muted object-cover" loading="lazy" />
            <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
              <span className="truncate font-medium" title={item.fileName}>
                {item.fileName}
              </span>
              <span className="text-muted-foreground">
                {Number(item.width)} × {Number(item.height)} · {size(Number(item.sizeBytes))}
              </span>
              {item.usedBy.length > 0 ? (
                <span className="text-muted-foreground">
                  {t("usedBy")}{" "}
                  {item.usedBy.map((use, i) => {
                    const href = usageHref(use.kind, use.id);
                    return (
                      <span key={`${use.kind}-${use.id}`}>
                        {i > 0 && ", "}
                        {href ? (
                          <Link className="text-primary hover:underline" href={href}>
                            {textOf(use.name)}
                          </Link>
                        ) : (
                          textOf(use.name)
                        )}
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("unused")}</span>
              )}
              <div className="mt-auto flex justify-end">
                <ConfirmButton
                  title={t("deleteTitle", { name: item.fileName })}
                  description={item.usedBy.length > 0 ? t("deleteUsedHint") : t("deleteHint")}
                  onConfirm={() => remove(item)}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`${tc("delete")} ${item.fileName}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("count", { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("previous")} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span>{t("page", { page, pages })}</span>
          <Button variant="outline" size="icon" aria-label={t("next")} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
