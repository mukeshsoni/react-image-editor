import type {
  ColorAdjustments,
  DenoiseSettings,
  LightAdjustments,
  SharpeningSettings,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "@/store/cropStore";
import type { GeometryOpticsSettings } from "@/store/geometryOpticsStore";

export type PipelineBuffers = {
  in: Uint8ClampedArray;
  out: Uint8ClampedArray;
  temp: Uint8ClampedArray;
};

export function ensurePipelineBufferCapacity(
  buffers: PipelineBuffers,
  byteLength: number,
): void {
  if (buffers.in.length !== byteLength) {
    buffers.in = new Uint8ClampedArray(byteLength);
  }

  if (buffers.out.length !== byteLength) {
    buffers.out = new Uint8ClampedArray(byteLength);
  }

  if (buffers.temp.length !== byteLength) {
    buffers.temp = new Uint8ClampedArray(byteLength);
  }
}

export type PixelPipelineContext = {
  width?: number;
  height?: number;

  geometryOptics?: GeometryOpticsSettings;

  whiteBalance?: WhiteBalanceSettings;
  lightAdjustments?: LightAdjustments;
  toneCurve?: ToneCurveSettings;
  colorAdjustments?: ColorAdjustments;
  denoise?: DenoiseSettings;

  sharpening?: SharpeningSettings;
};
