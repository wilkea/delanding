"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Images, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type DragEvent } from "react";
import { CropEditor, type Framing } from "@/components/admin/crop-editor";
import { LocalizedInput } from "@/components/admin/localized-input";
import { ServerErrors, useServerErrors } from "@/components/admin/server-errors";
import { SimpleSelect } from "@/components/admin/simple-select";
import { acceptedImages, useUpload, type Media } from "@/components/admin/use-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { api, call } from "@/lib/api/client";
import { cleanLocalized, textOf, type Localized } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { MediaPicker } from "../../media/media-picker";
import type { Product } from "./product-values";

type Photo = { key: string; mediaId: string; variantId: string | null; alt: Localized; framing: Framing; url: string; original: string; fileName: string };

const ALL_VARIANTS = "all";

let counter = 0;
const key = () => `p${++counter}`;

const original = (url: string) => url.split("?")[0];

function fromProduct(product: Product): Photo[] {
  return product.images.map((image) => ({
    key: key(),
    mediaId: image.mediaId,
    variantId: image.variantId,
    alt: { ...image.alt },
    framing: {
      crop: image.framing.crop
        ? { x: Number(image.framing.crop.x), y: Number(image.framing.crop.y), width: Number(image.framing.crop.width), height: Number(image.framing.crop.height) }
        : null,
      focalX: image.framing.focalX == null ? null : Number(image.framing.focalX),
      focalY: image.framing.focalY == null ? null : Number(image.framing.focalY),
      rotation: Number(image.framing.rotation),
    },
    url: image.url,
    original: original(image.url),
    fileName: image.fileName,
  }));
}

function fromMedia(media: Media): Photo {
  return {
    key: key(),
    mediaId: media.id,
    variantId: null,
    alt: {},
    framing: { crop: null, focalX: null, focalY: null, rotation: 0 },
    url: media.url,
    original: original(media.url),
    fileName: media.fileName,
  };
}

export function ProductPhotos({ product }: { product: Product }) {
  const t = useTranslations("admin.photos");
  const tp = useTranslations("admin.products");
  const queryClient = useQueryClient();
  const { upload, uploading } = useUpload();
  const [photos, setPhotos] = useState<Photo[]>(() => fromProduct(product));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [picking, setPicking] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const server = useServerErrors(null, { images: tp("photos") });

  async function save(next: Photo[]) {
    const previous = photos;
    setPhotos(next);
    server.clear();
    setSaving(true);
    try {
      const saved = await call(
        api.PUT("/api/admin/products/{id}/images", {
          params: { path: { id: product.id } },
          body: {
            images: next.map((p) => ({
              mediaId: p.mediaId,
              variantId: p.variantId,
              alt: cleanLocalized(p.alt),
              framing: { crop: p.framing.crop, focalX: p.framing.focalX, focalY: p.framing.focalY, rotation: p.framing.rotation },
            })),
          },
        }),
      );
      queryClient.setQueryData(["product", product.id], saved);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["media"] });
      setPhotos(fromProduct(saved));
      return true;
    } catch (error) {
      setPhotos(previous);
      server.show(error);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | File[]) {
    const uploaded = await upload(files);
    if (uploaded.length > 0) {
      await save([...photos, ...uploaded.map(fromMedia)]);
    }
  }

  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= photos.length) {
      return;
    }

    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void save(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropping(false);
    if (event.dataTransfer.files.length > 0) {
      void addFiles(event.dataTransfer.files);
    }
  }

  const variantOptions = [
    { value: ALL_VARIANTS, label: t("allVariants") },
    ...product.variants.map((v) => ({ value: v.id, label: [v.sku, ...Object.values(v.options)].join(" · ") })),
  ];

  return (
    <div
      className={cn("flex flex-col gap-3 rounded-lg", dropping && "ring-2 ring-primary ring-offset-4")}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <ServerErrors messages={server.messages} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5" aria-label={tp("photos")}>
        {photos.map((photo, index) => (
          <li
            key={photo.key}
            draggable
            onDragStart={() => setDragged(index)}
            onDragOver={(e) => dragged != null && e.preventDefault()}
            onDrop={(e) => {
              if (dragged != null) {
                e.preventDefault();
                e.stopPropagation();
                moveTo(dragged, index);
                setDragged(null);
              }
            }}
            className={cn("group relative overflow-hidden rounded-lg border bg-muted", dragged === index && "opacity-50")}
            data-testid="photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- served and resized by the API, not by next/image */}
            <img src={photo.url} alt={textOf(photo.alt)} className="aspect-square w-full object-cover" draggable={false} />
            <div className="absolute top-1.5 left-1.5 flex gap-1">
              {index === 0 && <Badge>{t("main")}</Badge>}
              {photo.variantId && <Badge variant="secondary">{product.variants.find((v) => v.id === photo.variantId)?.sku}</Badge>}
            </div>
            <div className="flex items-center justify-between gap-1 border-t bg-background p-1">
              <Button type="button" size="icon" variant="ghost" aria-label={`${t("moveLeft")} ${photo.fileName}`} disabled={index === 0 || saving} onClick={() => moveTo(index, index - 1)}>
                <ArrowLeft className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`${t("edit")} ${photo.fileName}`} disabled={saving} onClick={() => setEditing(photo)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`${t("remove")} ${photo.fileName}`}
                disabled={saving}
                onClick={() => void save(photos.filter((p) => p.key !== photo.key))}
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`${t("moveRight")} ${photo.fileName}`}
                disabled={index === photos.length - 1 || saving}
                onClick={() => moveTo(index, index + 1)}
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </li>
        ))}
        <li className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-center text-xs text-muted-foreground">
          {uploading > 0 || saving ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload className="size-4" />
                {t("upload")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPicking(true)}>
                <Images className="size-4" />
                {t("fromLibrary")}
              </Button>
              <span>{t("dropHint")}</span>
            </>
          )}
        </li>
      </ul>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={acceptedImages}
        className="hidden"
        data-testid="photo-upload"
        onChange={(e) => {
          if (e.target.files?.length) {
            void addFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        onPick={(media) => void save([...photos, ...media.map(fromMedia)])}
      />
      {editing && (
        <PhotoDialog
          photo={editing}
          variantOptions={variantOptions}
          onClose={() => setEditing(null)}
          onSave={async (updated) => {
            if (await save(photos.map((p) => (p.key === updated.key ? updated : p)))) {
              setEditing(null);
            }
          }}
          errors={server.messages}
        />
      )}
    </div>
  );
}

type PhotoDialogProps = {
  photo: Photo;
  variantOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (photo: Photo) => Promise<void>;
  errors: string[];
};

function PhotoDialog({ photo, variantOptions, onClose, onSave, errors }: PhotoDialogProps) {
  const t = useTranslations("admin.photos");
  const tc = useTranslations("admin.common");
  const [draft, setDraft] = useState(photo);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("editTitle", { name: photo.fileName })}</DialogTitle>
        </DialogHeader>
        <CropEditor src={photo.original} value={draft.framing} onChange={(framing) => setDraft({ ...draft, framing })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="photo-alt">{t("alt")}</FieldLabel>
            <LocalizedInput id="photo-alt" value={draft.alt} onChange={(alt) => setDraft({ ...draft, alt })} placeholder={t("altHint")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="photo-variant">{t("variant")}</FieldLabel>
            <SimpleSelect
              id="photo-variant"
              value={draft.variantId ?? ALL_VARIANTS}
              options={variantOptions}
              onChange={(value) => setDraft({ ...draft, variantId: value === ALL_VARIANTS ? null : value })}
            />
          </Field>
        </div>
        <ServerErrors messages={errors} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(draft);
              setBusy(false);
            }}
          >
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
