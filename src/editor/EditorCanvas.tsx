import { useEffect, useRef } from "react";

import { drawImageWithRotation } from "@/export-download";

import {
  createDefaultPipeline,
  ensurePipelineBufferCapacity,
  runPipeline,
} from "@/editor/pixel-pipeline";
import type { PixelPipelineContext, PipelineBuffers } from "@/editor/pixel-pipeline";

import type {
  ColorAdjustments,
  LightAdjustments,
  SharpeningSettings,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "@/store/cropStore";
import { useColorStore } from "@/store/colorStore";
import { useLightStore } from "@/store/lightStore";
import { useSharpeningStore } from "@/store/sharpeningStore";
import { useToneCurveStore } from "@/store/toneCurveStore";
import { useWhiteBalanceStore } from "@/store/whiteBalanceStore";

type RenderCache = {
  baseCanvas: HTMLCanvasElement;
  baseKey: string;
  adjustedCanvas: HTMLCanvasElement;
  basePixels: Uint8ClampedArray;
  pipeline: ReadonlyArray<import("@/editor/pixel-pipeline").PixelProcessor>;
  buffers: PipelineBuffers;
};

function renderImageToCanvas(
  canvasRef: HTMLCanvasElement | null,
  imageRef: HTMLImageElement | HTMLCanvasElement,
  zoomLevel: number,
  offset: { x: number; y: number },
  rotation: number,
  whiteBalance?: WhiteBalanceSettings,
  lightAdjustments?: LightAdjustments,
  toneCurve?: ToneCurveSettings,
  colorAdjustments?: ColorAdjustments,
  sharpening?: SharpeningSettings,
  cache?: RenderCache,
) {
  if (!canvasRef) return;

  const ctx = canvasRef.getContext("2d");
  if (!ctx) return;

  const canvasWidth = canvasRef.width;
  const canvasHeight = canvasRef.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const shouldProcessPixels = cache != null;

  if (!shouldProcessPixels) {
    ctx.save();
    drawImageWithRotation(ctx, imageRef, zoomLevel, offset, rotation);
    ctx.restore();
    return;
  }

  const baseKey = `${canvasWidth}x${canvasHeight}:${zoomLevel}:${offset.x}:${offset.y}:${rotation}`;

  if (cache.baseKey !== baseKey) {
    cache.baseCanvas.width = canvasWidth;
    cache.baseCanvas.height = canvasHeight;

    const baseCtx = cache.baseCanvas.getContext("2d", { willReadFrequently: true });
    if (!baseCtx) return;

    baseCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    baseCtx.save();
    drawImageWithRotation(baseCtx, imageRef, zoomLevel, offset, rotation);
    baseCtx.restore();

    const imageData = baseCtx.getImageData(0, 0, canvasWidth, canvasHeight);

    cache.basePixels = new Uint8ClampedArray(imageData.data);

    ensurePipelineBufferCapacity(cache.buffers, imageData.data.length);
    cache.buffers.in.set(cache.basePixels);

    cache.baseKey = baseKey;
  }

  const context: PixelPipelineContext = {
    width: canvasWidth,
    height: canvasHeight,

    whiteBalance,
    lightAdjustments,
    toneCurve,
    colorAdjustments,
    sharpening,
  };

  cache.buffers.in.set(cache.basePixels);
  runPipeline(cache.pipeline, cache.buffers, context);

  cache.adjustedCanvas.width = canvasWidth;
  cache.adjustedCanvas.height = canvasHeight;

  const adjustedCtx = cache.adjustedCanvas.getContext("2d");
  if (!adjustedCtx) return;

  const adjustedData = new ImageData(cache.buffers.out, canvasWidth, canvasHeight);
  adjustedCtx.putImageData(adjustedData, 0, 0);

  ctx.save();
  ctx.drawImage(cache.adjustedCanvas, 0, 0);
  ctx.restore();
}

type Props = {
  canvasRef: import("react").RefObject<HTMLCanvasElement | null>;
  imageRef: import("react").RefObject<HTMLImageElement | null>;
  zoomLevel: number;
  offset: { x: number; y: number };
  rotation: number;
  listeners: import("react").ComponentPropsWithoutRef<"canvas">;
  isPickingWhiteBalance: boolean;
  onPickWhiteBalance: import("react").MouseEventHandler<HTMLCanvasElement>;
};

export function EditorCanvas({
  canvasRef,
  imageRef,
  zoomLevel,
  offset,
  rotation,
  listeners,
  isPickingWhiteBalance,
  onPickWhiteBalance,
}: Props) {
  const whiteBalance = useWhiteBalanceStore((state) => state.whiteBalance);
  const lightAdjustments = useLightStore((state) => state.lightAdjustments);
  const colorAdjustments = useColorStore((state) => state.colorAdjustments);
  const toneCurve = useToneCurveStore((state) => state.toneCurve);
  const sharpening = useSharpeningStore((state) => state.sharpening);

  const renderRef = useRef<number | null>(null);
  const renderCacheRef = useRef<RenderCache | null>(null);

  if (!renderCacheRef.current && typeof document !== "undefined") {
    renderCacheRef.current = {
      baseCanvas: document.createElement("canvas"),
      baseKey: "",
      adjustedCanvas: document.createElement("canvas"),
      basePixels: new Uint8ClampedArray(0),
      pipeline: createDefaultPipeline(),
      buffers: {
        in: new Uint8ClampedArray(0),
        out: new Uint8ClampedArray(0),
        temp: new Uint8ClampedArray(0),
      },
    };
  }

  useEffect(() => {
    if (renderRef.current) {
      cancelAnimationFrame(renderRef.current);
    }

    renderRef.current = requestAnimationFrame(() => {
      if (!imageRef.current) return;

      renderImageToCanvas(
        canvasRef.current,
        imageRef.current,
        zoomLevel,
        offset,
        rotation,
        whiteBalance,
        lightAdjustments,
        toneCurve,
        colorAdjustments,
        sharpening,
        renderCacheRef.current ?? undefined,
      );
    });
  }, [
    canvasRef,
    colorAdjustments,
    imageRef,
    lightAdjustments,
    offset,
    rotation,
    toneCurve,
    whiteBalance,
    zoomLevel,
    sharpening,
  ]);

  return (
    <canvas
      ref={canvasRef}
      {...listeners}
      onClick={onPickWhiteBalance}
      style={{ cursor: isPickingWhiteBalance ? "crosshair" : undefined }}
    />
  );
}
