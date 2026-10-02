"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, call } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

export type Media = Schemas["MediaResponse"];

export const acceptedImages = "image/jpeg,image/png,image/webp";

function reason(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  const details = Object.values(error.fieldErrors).flat();
  return details.length > 0 ? details.join(" ") : error.message || fallback;
}

export function useUpload() {
  const t = useTranslations("admin.media");
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(0);

  async function upload(files: FileList | File[]): Promise<Media[]> {
    const list = Array.from(files);
    const uploaded: Media[] = [];
    setUploading(list.length);

    for (const file of list) {
      const body = new FormData();
      body.append("file", file);
      try {
        uploaded.push(await call(api.POST("/api/admin/media", { body: body as never })));
      } catch (error) {
        toast.error(t("uploadFailed", { name: file.name }), { description: reason(error, t("uploadFailedHint")) });
      } finally {
        setUploading((n) => n - 1);
      }
    }

    if (uploaded.length > 0) {
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    }

    return uploaded;
  }

  return { upload, uploading };
}
