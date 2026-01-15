import {
  createDefaultPipeline,
  ensurePipelineBufferCapacity,
  runPipeline,
} from "@/editor/pixel-pipeline";
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
