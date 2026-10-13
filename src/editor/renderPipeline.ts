import {
  createDefaultPipeline,
  ensurePipelineBufferCapacity,
  runPipeline,
} from "@/editor/pixel-pipeline";
import { projectHealingOpsToCanvas } from "@/editor/pixel-pipeline/processors/healing";
import type { HealingOp } from "@/store/healingStore";
import type {
  ColorAdjustments,
  DenoiseSettings,
  LightAdjustments,
  SharpeningSettings,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "@/store/cropStore";

type PipelineInputs = {
  geometryOptics?: import("@/store/geometryOpticsStore").GeometryOpticsSettings;
  healingOps?: import("@/editor/pixel-pipeline/processors/healing").HealingCanvasOp[];

  whiteBalance?: WhiteBalanceSettings;
  lightAdjustments?: LightAdjustments;
  toneCurve?: ToneCurveSettings;
  colorAdjustments?: ColorAdjustments;
  denoise?: DenoiseSettings;
  sharpening?: SharpeningSettings;
};

export type ImageProcessingInputs = Omit<PipelineInputs, "healingOps"> & {
  healingOps?: HealingOp[];
};

export function createProcessedImageCanvas(
  image: HTMLImageElement | HTMLCanvasElement,
  inputs: ImageProcessingInputs,
): HTMLCanvasElement | null {
  if (image.width <= 0 || image.height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  const healingOps = inputs.healingOps?.length
    ? projectHealingOpsToCanvas({
        ops: inputs.healingOps,
        imageSize: image,
        draw: { zoomLevel: 1, offset: { x: 0, y: 0 }, rotationDegrees: 0 },
      })
    : undefined;
  return applyPixelPipelineToCanvas(canvas, { ...inputs, healingOps }) ? canvas : null;
}

export function applyPixelPipelineToCanvas(
  canvas: HTMLCanvasElement,
  inputs: PipelineInputs,
): boolean {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const width = canvas.width;
  const height = canvas.height;

  const pipeline = createDefaultPipeline();

  const context = {
    width,
    height,

    geometryOptics: inputs.geometryOptics,
    healingOps: inputs.healingOps,

    whiteBalance: inputs.whiteBalance,
    lightAdjustments: inputs.lightAdjustments,
    toneCurve: inputs.toneCurve,
    colorAdjustments: inputs.colorAdjustments,
    denoise: inputs.denoise,
    sharpening: inputs.sharpening,
  };

  const hasEnabledProcessor = pipeline.some((processor) => processor.isEnabled(context));
  if (!hasEnabledProcessor) {
    return true;
  }

  const imageData = ctx.getImageData(0, 0, width, height);

  const buffers = {
    in: new Uint8ClampedArray(imageData.data.length),
    out: new Uint8ClampedArray(imageData.data.length),
    temp: new Uint8ClampedArray(imageData.data.length),
  };

  ensurePipelineBufferCapacity(buffers, imageData.data.length);
  buffers.in.set(imageData.data);

  runPipeline(pipeline, buffers, context);

  ctx.putImageData(new ImageData(buffers.out, width, height), 0, 0);
  return true;
}
