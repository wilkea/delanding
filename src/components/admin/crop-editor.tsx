"use client";

import { Crosshair, Crop as CropIcon, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CropBox = { x: number; y: number; width: number; height: number };
export type Framing = { crop: CropBox | null; focalX: number | null; focalY: number | null; rotation: number };

type Drag = { kind: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; start: CropBox };

const ratios = [
  { key: "free", value: null },
  { key: "square", value: 1 },
  { key: "fourThree", value: 4 / 3 },
  { key: "wide", value: 16 / 9 },
] as const;

const whole: CropBox = { x: 0, y: 0, width: 1, height: 1 };
const minSize = 0.05;
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 10000) / 10000;

function fit(ratio: number, imageWidth: number, imageHeight: number): CropBox {
  const heightForFullWidth = imageWidth / ratio / imageHeight;
  if (heightForFullWidth <= 1) {
    return { x: 0, y: (1 - heightForFullWidth) / 2, width: 1, height: heightForFullWidth };
  }

  const width = (imageHeight * ratio) / imageWidth;
  return { x: (1 - width) / 2, y: 0, width, height: 1 };
}

export function CropEditor({ src, value, onChange }: { src: string; value: Framing; onChange: (value: Framing) => void }) {
  const t = useTranslations("admin.crop");
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<"crop" | "focal">("crop");
  const [ratio, setRatio] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const crop = value.crop ?? whole;
  const turned = value.rotation === 90 || value.rotation === 270;
  const imageWidth = image ? (turned ? image.naturalHeight : image.naturalWidth) : 1;
  const imageHeight = image ? (turned ? image.naturalWidth : image.naturalHeight) : 1;
  const scale = Math.min(560 / imageWidth, 380 / imageHeight, 1);
  const displayWidth = Math.round(imageWidth * scale);
  const displayHeight = Math.round(imageHeight * scale);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  useEffect(() => {
    const target = canvas.current;
    if (!image || !target) {
      return;
    }

    target.width = displayWidth;
    target.height = displayHeight;
    const context = target.getContext("2d")!;
    context.save();
    context.translate(displayWidth / 2, displayHeight / 2);
    context.rotate((value.rotation * Math.PI) / 180);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    context.drawImage(image, -w / 2, -h / 2, w, h);
    context.restore();

    const output = preview.current;
    if (output) {
      const ratioOut = (crop.width * imageWidth) / (crop.height * imageHeight);
      output.width = ratioOut >= 1 ? 200 : Math.round(200 * ratioOut);
      output.height = ratioOut >= 1 ? Math.round(200 / ratioOut) : 200;
      output
        .getContext("2d")!
        .drawImage(target, crop.x * displayWidth, crop.y * displayHeight, crop.width * displayWidth, crop.height * displayHeight, 0, 0, output.width, output.height);
    }
  }, [image, value.rotation, crop.x, crop.y, crop.width, crop.height, displayWidth, displayHeight, scale, imageWidth, imageHeight]);

  function setCrop(next: CropBox) {
    const isWhole = next.x <= 0.0001 && next.y <= 0.0001 && next.width >= 0.9999 && next.height >= 0.9999;
    onChange({
      ...value,
      crop: isWhole ? null : { x: round(next.x), y: round(next.y), width: round(next.width), height: round(next.height) },
    });
  }

  function chooseRatio(next: number | null) {
    setRatio(next);
    setCrop(next ? fit(next, imageWidth, imageHeight) : whole);
  }

  function rotate(by: number) {
    onChange({ crop: null, focalX: null, focalY: null, rotation: (value.rotation + by + 360) % 360 });
    setRatio(null);
  }

  function start(kind: Drag["kind"]) {
    return (event: ReactPointerEvent) => {
      if (mode !== "crop") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
      setDrag({ kind, startX: event.clientX, startY: event.clientY, start: crop });
    };
  }

  function move(event: ReactPointerEvent) {
    if (!drag) {
      return;
    }

    const dx = (event.clientX - drag.startX) / displayWidth;
    const dy = (event.clientY - drag.startY) / displayHeight;
    const s = drag.start;

    if (drag.kind === "move") {
      setCrop({ ...s, x: clamp(s.x + dx, 0, 1 - s.width), y: clamp(s.y + dy, 0, 1 - s.height) });
      return;
    }

    const left = drag.kind === "nw" || drag.kind === "sw";
    const top = drag.kind === "nw" || drag.kind === "ne";
    const anchorX = left ? s.x + s.width : s.x;
    const anchorY = top ? s.y + s.height : s.y;
    let width = clamp(left ? s.width - dx : s.width + dx, minSize, left ? anchorX : 1 - anchorX);
    let height = clamp(top ? s.height - dy : s.height + dy, minSize, top ? anchorY : 1 - anchorY);

    if (ratio) {
      height = (width * imageWidth) / (imageHeight * ratio);
      const maxHeight = top ? anchorY : 1 - anchorY;
      if (height > maxHeight) {
        height = maxHeight;
        width = (height * imageHeight * ratio) / imageWidth;
      }
    }

    setCrop({ x: left ? anchorX - width : anchorX, y: top ? anchorY - height : anchorY, width, height });
  }

  function setFocal(event: ReactPointerEvent<HTMLDivElement>) {
    if (mode !== "focal") {
      return;
    }

    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    onChange({ ...value, focalX: round(clamp((x - crop.x) / crop.width)), focalY: round(clamp((y - crop.y) / crop.height)) });
  }

  const handle = (kind: Drag["kind"], className: string) => (
    <span
      role="presentation"
      onPointerDown={start(kind)}
      data-testid={`crop-handle-${kind}`}
      className={cn("absolute size-4 rounded-sm border-2 border-white bg-primary shadow", className)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5" role="group" aria-label={t("mode")}>
          <Button type="button" size="sm" variant={mode === "crop" ? "secondary" : "ghost"} aria-pressed={mode === "crop"} onClick={() => setMode("crop")}>
            <CropIcon className="size-4" />
            {t("crop")}
          </Button>
          <Button type="button" size="sm" variant={mode === "focal" ? "secondary" : "ghost"} aria-pressed={mode === "focal"} onClick={() => setMode("focal")}>
            <Crosshair className="size-4" />
            {t("focal")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("ratio")}>
          {ratios.map((r) => (
            <Button key={r.key} type="button" size="sm" variant={ratio === r.value ? "secondary" : "outline"} aria-pressed={ratio === r.value} onClick={() => chooseRatio(r.value)}>
              {t(`ratios.${r.key}`)}
            </Button>
          ))}
        </div>
        <Button type="button" size="icon" variant="outline" aria-label={t("rotateLeft")} onClick={() => rotate(-90)}>
          <RotateCcw className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" aria-label={t("rotateRight")} onClick={() => rotate(90)}>
          <RotateCw className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setRatio(null);
            onChange({ crop: null, focalX: null, focalY: null, rotation: 0 });
          }}
        >
          <Undo2 className="size-4" />
          {t("reset")}
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div
          data-testid="crop-area"
          className={cn("relative touch-none overflow-hidden rounded-md bg-muted select-none", mode === "focal" && "cursor-crosshair")}
          style={{ width: displayWidth, height: displayHeight }}
          onPointerDown={setFocal}
          onPointerMove={move}
          onPointerUp={() => setDrag(null)}
        >
          <canvas ref={canvas} className="block" />
          {image && (
            <div
              data-testid="crop-frame"
              onPointerDown={start("move")}
              className={cn("absolute border-2 border-white", mode === "crop" ? "cursor-move" : "pointer-events-none")}
              style={{
                left: crop.x * displayWidth,
                top: crop.y * displayHeight,
                width: crop.width * displayWidth,
                height: crop.height * displayHeight,
                boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.45)",
              }}
            >
              {mode === "crop" && (
                <>
                  {handle("nw", "top-0 left-0 cursor-nwse-resize")}
                  {handle("ne", "top-0 right-0 cursor-nesw-resize")}
                  {handle("sw", "bottom-0 left-0 cursor-nesw-resize")}
                  {handle("se", "right-0 bottom-0 cursor-nwse-resize")}
                </>
              )}
              {value.focalX != null && value.focalY != null && (
                <span
                  data-testid="focal-point"
                  className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/60 shadow"
                  style={{ left: `${value.focalX * 100}%`, top: `${value.focalY * 100}%` }}
                />
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("preview")}</span>
          <canvas ref={preview} className="rounded-md border" />
          <span className="text-xs text-muted-foreground" data-testid="crop-size">
            {Math.round(crop.width * imageWidth)} × {Math.round(crop.height * imageHeight)} px
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{mode === "crop" ? t("cropHint") : t("focalHint")}</p>
    </div>
  );
}
