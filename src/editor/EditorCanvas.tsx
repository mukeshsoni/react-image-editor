import { useEffect, useRef } from "react";

import {
  applyColorAdjustmentsToRgbaBytes,
  hasNonNeutralColorAdjustments,
} from "@/lib/color-adjustments";
import { applyLightAdjustmentsToRgbaBytes } from "@/lib/light-adjustments";
import {
  applyToneCurveToRgbaBytes,
  createToneCurveLuts,
  hasNonNeutralToneCurve,
} from "@/lib/tone-curve";
import {
  applyWhiteBalanceToRgbaBytes,
  hasNonNeutralWhiteBalance,
} from "@/lib/white-balance";

import { drawImageWithRotation } from "@/export-download";
import type {
  ColorAdjustments,
  LightAdjustments,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "@/store/cropStore";

type RenderCache = {
  baseCanvas: HTMLCanvasElement;
  baseKey: string;
  adjustedCanvas: HTMLCanvasElement;
  in: Uint8ClampedArray;
  out: Uint8ClampedArray;
  temp: Uint8ClampedArray;
  toneCurveKey?: string;
  toneCurveLuts?: ReturnType<typeof createToneCurveLuts>;
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
  cache?: RenderCache,
) {
  if (!canvasRef) return;

  const ctx = canvasRef.getContext("2d");
  if (!ctx) return;

  // We restrict the canvas width to the canvas container width
  const canvasWidth = canvasRef.width;
  const canvasHeight = canvasRef.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const shouldApplyWhiteBalance =
    whiteBalance != null && hasNonNeutralWhiteBalance(whiteBalance);

  const shouldApplyLight =
    lightAdjustments != null &&
    (lightAdjustments.exposure !== 0 ||
      lightAdjustments.contrast !== 0 ||
      lightAdjustments.highlights !== 0 ||
      lightAdjustments.shadows !== 0 ||
      lightAdjustments.whites !== 0 ||
      lightAdjustments.blacks !== 0);

  const shouldApplyToneCurve = toneCurve != null && hasNonNeutralToneCurve(toneCurve);

  const shouldApplyColor =
    colorAdjustments != null && hasNonNeutralColorAdjustments(colorAdjustments);

  const shouldProcessPixels =
    (shouldApplyWhiteBalance ||
      shouldApplyLight ||
      shouldApplyToneCurve ||
      shouldApplyColor) &&
    cache;

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
    cache.in = imageData.data;
    cache.out = new Uint8ClampedArray(cache.in.length);
    cache.temp = new Uint8ClampedArray(cache.in.length);

    cache.baseKey = baseKey;
  }

  const source = cache.in;
  const dest = cache.out;

  if (shouldApplyWhiteBalance && whiteBalance) {
    applyWhiteBalanceToRgbaBytes(source, dest, whiteBalance);
  } else {
    dest.set(source);
  }

  if (shouldApplyLight && lightAdjustments) {
    if (cache.temp.length !== dest.length) {
      cache.temp = new Uint8ClampedArray(dest.length);
    }

    applyLightAdjustmentsToRgbaBytes(dest, cache.temp, lightAdjustments);
    dest.set(cache.temp);
  }

  if (shouldApplyToneCurve && toneCurve) {
    const toneCurveKey = JSON.stringify(toneCurve);
    if (cache.toneCurveKey !== toneCurveKey || !cache.toneCurveLuts) {
      cache.toneCurveLuts = createToneCurveLuts(toneCurve);
      cache.toneCurveKey = toneCurveKey;
    }

    if (cache.temp.length !== dest.length) {
      cache.temp = new Uint8ClampedArray(dest.length);
    }

    applyToneCurveToRgbaBytes(dest, cache.temp, cache.toneCurveLuts);
    dest.set(cache.temp);
  }

  if (shouldApplyColor && colorAdjustments) {
    if (cache.temp.length !== dest.length) {
      cache.temp = new Uint8ClampedArray(dest.length);
    }

    applyColorAdjustmentsToRgbaBytes(dest, cache.temp, colorAdjustments);
    dest.set(cache.temp);
  }

  cache.adjustedCanvas.width = canvasWidth;
  cache.adjustedCanvas.height = canvasHeight;

  const adjustedCtx = cache.adjustedCanvas.getContext("2d");
  if (!adjustedCtx) return;

  const adjustedData = new ImageData(dest, canvasWidth, canvasHeight);
  adjustedCtx.putImageData(adjustedData, 0, 0);

  ctx.save();
  ctx.drawImage(cache.adjustedCanvas, 0, 0);
  ctx.restore();
}

type Props = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  zoomLevel: number;
  offset: { x: number; y: number };
  rotation: number;
  whiteBalance: WhiteBalanceSettings;
  lightAdjustments: LightAdjustments;
  toneCurve: ToneCurveSettings;
  colorAdjustments: ColorAdjustments;
  listeners: React.ComponentPropsWithoutRef<"canvas">;
  isPickingWhiteBalance: boolean;
  onPickWhiteBalance: React.MouseEventHandler<HTMLCanvasElement>;
};

export function EditorCanvas({
  canvasRef,
  imageRef,
  zoomLevel,
  offset,
  rotation,
  whiteBalance,
  lightAdjustments,
  toneCurve,
  colorAdjustments,
  listeners,
  isPickingWhiteBalance,
  onPickWhiteBalance,
}: Props) {
  const renderRef = useRef<number | null>(null);
  const renderCacheRef = useRef<RenderCache | null>(null);

  if (!renderCacheRef.current && typeof document !== "undefined") {
    renderCacheRef.current = {
      baseCanvas: document.createElement("canvas"),
      baseKey: "",
      adjustedCanvas: document.createElement("canvas"),
      in: new Uint8ClampedArray(0),
      out: new Uint8ClampedArray(0),
      temp: new Uint8ClampedArray(0),
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
