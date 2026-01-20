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
  DenoiseSettings,
  LightAdjustments,
  SharpeningSettings,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "@/store/cropStore";
import { useCropStore } from "@/store/cropStore";
import { useColorStore } from "@/store/colorStore";
import { useDenoiseStore } from "@/store/denoiseStore";
import { projectHealingOpsToCanvas } from "@/editor/pixel-pipeline/processors/healing";
import { useGeometryOpticsStore } from "@/store/geometryOpticsStore";
import { useHealingStore } from "@/store/healingStore";
import { useLightStore } from "@/store/lightStore";
import { useSharpeningStore } from "@/store/sharpeningStore";
import { useToneCurveStore } from "@/store/toneCurveStore";
import { getEffectiveAdjustments } from "@/lib/presets";
import { usePresetStore } from "@/store/presetStore";
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
  cropCommit?: {
    outputWidth: number;
    outputHeight: number;
    bakedOffset: { x: number; y: number };
    rotationDegrees: number;
  } | null,
  whiteBalance?: WhiteBalanceSettings,
  lightAdjustments?: LightAdjustments,
  toneCurve?: ToneCurveSettings,
  colorAdjustments?: ColorAdjustments,
  denoise?: DenoiseSettings,
  sharpening?: SharpeningSettings,
  cache?: RenderCache,
  geometryOptics?: import("@/store/geometryOpticsStore").GeometryOpticsSettings,
  healingOps?: import("@/store/healingStore").HealingOp[],
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

    if (cropCommit) {
      drawImageWithRotation(
        ctx,
        imageRef,
        1,
        cropCommit.bakedOffset,
        cropCommit.rotationDegrees,
      );
    } else {
      drawImageWithRotation(ctx, imageRef, zoomLevel, offset, rotation);
    }

    ctx.restore();
    return;
  }

  const baseKey = cropCommit
    ? `${canvasWidth}x${canvasHeight}:${cropCommit.outputWidth}x${cropCommit.outputHeight}:${cropCommit.bakedOffset.x}:${cropCommit.bakedOffset.y}:${cropCommit.rotationDegrees}`
    : `${canvasWidth}x${canvasHeight}:${zoomLevel}:${offset.x}:${offset.y}:${rotation}`;

  if (cache.baseKey !== baseKey) {
    cache.baseCanvas.width = canvasWidth;
    cache.baseCanvas.height = canvasHeight;

    const baseCtx = cache.baseCanvas.getContext("2d", { willReadFrequently: true });
    if (!baseCtx) return;

    baseCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    baseCtx.save();

    if (cropCommit) {
      drawImageWithRotation(
        baseCtx,
        imageRef,
        1,
        cropCommit.bakedOffset,
        cropCommit.rotationDegrees,
      );
    } else {
      drawImageWithRotation(baseCtx, imageRef, zoomLevel, offset, rotation);
    }

    baseCtx.restore();

    const imageData = baseCtx.getImageData(0, 0, canvasWidth, canvasHeight);

    cache.basePixels = new Uint8ClampedArray(imageData.data);

    ensurePipelineBufferCapacity(cache.buffers, imageData.data.length);
    cache.buffers.in.set(cache.basePixels);

    cache.baseKey = baseKey;
  }

   const projectedHealingOps =
     healingOps && healingOps.length > 0
       ? projectHealingOpsToCanvas({
           ops: healingOps,
           imageSize: { width: imageRef.width, height: imageRef.height },
           draw: cropCommit
             ? {
                 zoomLevel: 1,
                 offset: cropCommit.bakedOffset,
                 rotationDegrees: cropCommit.rotationDegrees,
               }
             : {
                 zoomLevel,
                 offset,
                 rotationDegrees: rotation,
               },
         })
       : undefined;

   const context: PixelPipelineContext = {
     width: canvasWidth,
     height: canvasHeight,

     geometryOptics,
     healingOps: projectedHealingOps,

     whiteBalance,
     lightAdjustments,
     toneCurve,
     colorAdjustments,
     denoise,
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
  cursor?: string;
  isPickingWhiteBalance: boolean;
  onPickWhiteBalance: import("react").MouseEventHandler<HTMLCanvasElement>;
  isPickingPointColor: boolean;
  onPickPointColor: import("react").MouseEventHandler<HTMLCanvasElement>;
};

export function EditorCanvas({
  canvasRef,
  imageRef,
  zoomLevel,
  offset,
  rotation,
  listeners,
  cursor,
  isPickingWhiteBalance,
  onPickWhiteBalance,
  isPickingPointColor,
  onPickPointColor,
}: Props) {
  const cropCommitted = useCropStore((state) => state.cropCommitted);
  const cropCommit = useCropStore((state) => state.cropCommit);
  const whiteBalance = useWhiteBalanceStore((state) => state.whiteBalance);
  const lightAdjustments = useLightStore((state) => state.lightAdjustments);
  const colorAdjustments = useColorStore((state) => state.colorAdjustments);
  const preset = usePresetStore((state) => state.preset);

  const effectiveAdjustments = getEffectiveAdjustments({
    manual: {
      whiteBalance,
      light: lightAdjustments,
      color: colorAdjustments,
    },
    preset,
  });
  const toneCurve = useToneCurveStore((state) => state.toneCurve);
  const denoise = useDenoiseStore((state) => state.denoise);
  const sharpening = useSharpeningStore((state) => state.sharpening);
  const geometryOptics = useGeometryOpticsStore((state) => state.settings);
  const healingOps = useHealingStore((state) => state.healingOps);

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
          cropCommitted ? cropCommit : null,
          effectiveAdjustments.whiteBalance,
          effectiveAdjustments.light,
          toneCurve,
          effectiveAdjustments.color,
          denoise,
          sharpening,
          renderCacheRef.current ?? undefined,
          geometryOptics,
          healingOps,
        );
    });
    }, [
      canvasRef,
      cropCommit,
      cropCommitted,
      denoise,
      effectiveAdjustments.color,
      effectiveAdjustments.light,
      effectiveAdjustments.whiteBalance,
      geometryOptics,
      healingOps,
      imageRef,
      offset,
      rotation,
      sharpening,
      toneCurve,
      zoomLevel,
    ]);



  return (
    <canvas
      ref={canvasRef}
      {...listeners}
      aria-label="Image preview"
      onClick={(event) => {
        onPickWhiteBalance(event);
        onPickPointColor(event);
      }}
      style={{
        cursor: isPickingWhiteBalance || isPickingPointColor ? "crosshair" : cursor,
      }}
    >
      Image preview
    </canvas>
  );
}
