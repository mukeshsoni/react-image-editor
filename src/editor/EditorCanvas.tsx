import { useEffect, useRef } from "react";

import { getCropDrawTransform } from "@/editor/cropCommitted";
import { createProcessedImageCanvas } from "@/editor/renderPipeline";
import type { ImageProcessingInputs } from "@/editor/renderPipeline";
import { drawImageWithRotation } from "@/export-download";
import { getEffectiveAdjustments } from "@/lib/presets";
import { useColorStore } from "@/store/colorStore";
import { useCropStore } from "@/store/cropStore";
import type { CropCommit } from "@/store/cropStore";
import { useDenoiseStore } from "@/store/denoiseStore";
import { useGeometryOpticsStore } from "@/store/geometryOpticsStore";
import { useHealingStore } from "@/store/healingStore";
import { useLightStore } from "@/store/lightStore";
import { usePresetStore } from "@/store/presetStore";
import { useSharpeningStore } from "@/store/sharpeningStore";
import { useToneCurveStore } from "@/store/toneCurveStore";
import { useWhiteBalanceStore } from "@/store/whiteBalanceStore";

type RenderCache = {
  image: HTMLImageElement | null;
  inputs: ImageProcessingInputs | null;
  canvas: HTMLCanvasElement | null;
};

function renderImageToCanvas(
  canvas: HTMLCanvasElement | null,
  image: HTMLImageElement,
  zoomLevel: number,
  offset: { x: number; y: number },
  rotation: number,
  cropCommit: CropCommit | null,
  inputs: ImageProcessingInputs,
  cache: RenderCache,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const inputsChanged = (Object.keys(inputs) as Array<keyof ImageProcessingInputs>)
    .some((key) => inputs[key] !== cache.inputs?.[key]);
  if (cache.image !== image || inputsChanged || !cache.canvas) {
    const processed = createProcessedImageCanvas(image, inputs);
    if (!processed) return;
    cache.image = image;
    cache.inputs = inputs;
    cache.canvas = processed;
  }

  // The processed pixels are independent of the camera and viewport dimensions.
  // Only drawing runs during zoom/pan; filters run when the image or edits change.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const draw = cropCommit
    ? getCropDrawTransform(cropCommit, zoomLevel, offset)
    : { zoomLevel, offset, rotationDegrees: rotation };

  ctx.save();
  if (cropCommit) {
    ctx.beginPath();
    ctx.rect(offset.x, offset.y, cropCommit.outputWidth * zoomLevel, cropCommit.outputHeight * zoomLevel);
    ctx.clip();
  }
  drawImageWithRotation(ctx, cache.canvas, draw.zoomLevel, draw.offset, draw.rotationDegrees);
  ctx.restore();
}

type Props = {
  canvasRef: import("react").RefObject<HTMLCanvasElement | null>;
  imageRef: import("react").RefObject<HTMLImageElement | null>;
  zoomLevel: number;
  offset: { x: number; y: number };
  rotation: number;
  cropMode?: boolean;
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
  cropMode = false,
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

  const renderCacheRef = useRef<RenderCache>({ image: null, inputs: null, canvas: null });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!imageRef.current) return;

      renderImageToCanvas(
        canvasRef.current,
        imageRef.current,
        zoomLevel,
        offset,
        rotation,
        cropCommitted && !cropMode ? cropCommit : null,
        {
          whiteBalance: effectiveAdjustments.whiteBalance,
          lightAdjustments: effectiveAdjustments.light,
          toneCurve,
          colorAdjustments: effectiveAdjustments.color,
          denoise,
          sharpening,
          geometryOptics,
          healingOps,
        },
        renderCacheRef.current,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [
    canvasRef,
    cropCommit,
    cropCommitted,
    cropMode,
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
      className="block h-full w-full"
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
